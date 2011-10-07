# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Sync Server
#
# The Initial Developer of the Original Code is the Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2010
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Tarek Ziade (tarek@mozilla.com)
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****
import os
import sys
import subprocess


CURDIR = os.path.dirname(__file__)
REPOS = {'github': ('git', 'https://github.com/mozilla/%s.git'),
         'mozilla': ('hg', 'https://hg.mozilla.org/labs/%s')}
PYTHON = sys.executable


def _get_tags():
    sub = subprocess.Popen('git tag', shell=True, stdout=subprocess.PIPE)
    tags = [line.strip()
            for line in sub.stdout.read().strip().split('\n')
            if line.strip() != '']
    tags.reverse()
    return tags


def verify_tag(tag):
    if tag == 'tip' or tag.isdigit():
        return True
    return tag in _get_tags()


def get_latest_tag():
    tags = _get_tags()
    if len(tags) == 0:
        raise ValueError('Could not find a tag')
    return tags[0]


def _run(command):
    print(command)
    os.system(command)


def _envname(name):
    return name.upper().replace('-', '_')


def _update_cmd(project, latest_tags=False, repo_type='git'):
    if latest_tags:
        if repo_type == 'hg':
            return 'hg up -r "%s"' % get_latest_tag()
        else:
            return 'git checkout -r "%s"' % get_latest_tag()
    else:
        # looking for an environ with a specific tag or rev
        rev = os.environ.get(_envname(project))
        if rev is not None:
            if not verify_tag(rev):
                print('Unknown tag or revision: %s' % rev)
                sys.exit(1)
            if repo_type == 'git':
                return 'git checkout -r "%s"' % rev
            else:
                return 'hg up -r "%s"' % rev
        if repo_type == 'git':
            return 'git checkout'
        else:
            return 'hg up'


def build_app(name, latest_tags, deps):
    # building deps first
    build_deps(deps, latest_tags)

    # build the app now
    if not _has_spec():
        latest_tags = False

    _run(_update_cmd(name, latest_tags))
    #_run('%s setup.py develop' % PYTHON)


def build_deps(deps, latest_tags):
    """Will make sure dependencies are up-to-date"""
    location = os.getcwd()
    # do we want the latest tags ?
    try:
        deps_dir = os.path.abspath(os.environ.get('DEPSDIR', os.path.join(CURDIR, 'deps')))
        if not os.path.exists(deps_dir):
            os.mkdir(deps_dir)

        for dep in deps:
            root, name = dep.split(':')
            repo_type, repo_root = REPOS[root]
            repo = repo_root % name
            target = os.path.join(deps_dir, name)
            if os.path.exists(target):
                os.chdir(target)
                if repo_type == 'git':
                    _run('git pull')
                else:
                    _run('hg pull')
            else:
                if repo_type == 'git':
                    _run('git clone %s %s' % (repo, target))
                else:
                    _run('hg clone %s %s' % (repo, target))

                os.chdir(target)
            update_cmd = _update_cmd(dep, latest_tags, repo_type)
            _run(update_cmd)
            #_run('%s setup.py develop' % PYTHON)
    finally:
        os.chdir(location)


def _has_spec():
    specs = [file_ for file_ in os.listdir('.')
             if file_.endswith('.spec')]
    return len(specs)


def main(project_name, deps):
    # check the provided values in the environ
    latest_tags = 'LATEST_TAGS' in os.environ

    if not latest_tags:
        # if we have some tags in the environ, check that they are all defined
        projects = list(deps)

        # is the root a project itself or just a placeholder ?
        if _has_spec():
            projects.append(project_name)

        tags = {}
        missing = 0
        for project in projects:
            tag = _envname(project)
            if tag in os.environ:
                tags[tag] = os.environ[tag]
            else:
                tags[tag] = 'Not provided'
                missing += 1

        # we want all tag or no tag
        if missing > 0 and missing < len(projects):
            print("You did not specify all tags: ")
            for project, tag in tags.items():
                print('    %s: %s' % (project, tag))
            sys.exit(1)

    build_app(project_name, latest_tags, deps)


if __name__ == '__main__':
    project_name = sys.argv[1]
    deps = [dep.strip() for dep in sys.argv[2].split(',')]
    main(project_name, deps)
