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
#   Shane Caraveo (scaraveo@mozilla.com)
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
import json
from optparse import OptionParser

CURDIR = os.path.dirname(__file__)
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
    os.system(command)


def _update_cmd(tag, type='git'):
    if type == 'git':
        if tag and verify_tag(tag):
            return 'git checkout %s' % tag
        else:
            return 'git pull'
    elif type == 'hg':
        if tag:
            return 'hg up -r "%s"' % tag
        else:
            return 'hg up'


def get_deps_dir(dependencies):
    deps_dir = dependencies.get('location')
    if not os.path.isabs(deps_dir):
        deps_dir = os.path.abspath(os.path.join(CURDIR, deps_dir))
    if not os.path.exists(deps_dir):
        os.mkdir(deps_dir)
    return deps_dir


def pull_app(package, dependencies):
    type, repo, branch, tag = dependencies.get('project')
    name = os.path.basename(repo).split('.')[0]
    update_cmd = _update_cmd("", type)
    print "updating %s with: %s" % (name, update_cmd)
    _run(update_cmd)


def pull_deps(dependencies):
    """Will make sure dependencies are up-to-date"""
    location = os.getcwd()
    # do we want the latest tags ?
    try:
        deps_dir = get_deps_dir(dependencies)
        for project in dependencies.get('projects', []):
            type, repo, branch, tag = project
            name = os.path.basename(repo).split('.')[0]
            target = os.path.join(deps_dir, name)
            if not os.path.exists(target):
                print "cloning ", name
                if type == 'git':
                    _run('git clone %s %s' % (repo, target))
                else:
                    _run('hg clone %s %s' % (repo, target))

            os.chdir(target)
            if type == 'git' and branch:
                print "checkout branch %s for %s" % (branch, name)
                _run('git checkout %s' % branch)
            update_cmd = _update_cmd(tag, type)
            print "updating %s with: %s" % (name, update_cmd)
            _run(update_cmd)
    finally:
        os.chdir(location)


def get_package(package):
    return json.load(open(package))


def get_dependencies(dependencies):
    return json.load(open(dependencies))


def pull_release(options, package, dependencies):
    project = dependencies.get('project', [])
    project[3] = options.reltag
    pull_app(package, dependencies)
    # update dependencies now
    dependencies = get_dependencies(options.dependencies)
    pull_deps(dependencies)


def tag_release(package, dependencies):
    rel_tag = "v%(version)s" % package
    if verify_tag(rel_tag):
        raise Exception("repository already tagged for release")

    location = os.getcwd()
    # get the current revision and branch we're working with, update
    # dependencies.json, then tag the repository we're in
    import copy
    old_deps = copy.copy(dependencies)
    try:
        deps_dir = get_deps_dir(dependencies)
        for project in dependencies.get('projects', []):
            type, repo, branch, tag = project
            name = os.path.basename(repo).split('.')[0]
            target = os.path.join(deps_dir, name)
            os.chdir(target)
            # tag the repo
            if type == 'git':
                # lightweight tags for dependency repos
                p = os.popen("git log --pretty=format:'%h' -n 1")
                project[3] = p.read()
            else:
                raise Exception("tagging not implemented for ", type)
            print "tagging %s with %s" % (name, project[3])
        print dependencies
    finally:
        os.chdir(location)

    dependencies_file = os.path.abspath(os.path.join(CURDIR, 'dependencies.json'))
    json.dump(dependencies, open(dependencies_file, mode="w"), indent=2)

    # now, tag our project
    rel_tag = "v%(version)s" % package
    tag_msg = "release version %(version)s" % package
    print "tagging %s with %s" % (package.get('name'), rel_tag)
    # tag the repo
    if type == 'git':
        # lightweight tags for dependency repos
        _run('git commit %s -m "update dependency tags"' % dependencies_file)
        _run('git tag -a %s -m "%s" && git push origin --tags' % (rel_tag, tag_msg))
    else:
        raise Exception("tagging not implemented for ", type)


if __name__ == '__main__':
    # defaults
    dependencies_file = os.path.abspath(os.path.join(CURDIR, 'dependencies.json'))
    package_file = os.path.abspath(os.path.join(CURDIR, 'package.json'))

    # options
    parser = OptionParser()
    parser.add_option("-v", "--version", dest="version",
                      action="store_true", default=False,
                      help="version from package.json")
    parser.add_option("-r", "--pull-release", dest="reltag",
                      help="pull a specific release from the repositories")
    parser.add_option("-t", "--tag", dest="tag",
                      action="store_true", default=False,
                      help="tag repositories with the release version from package.json")
    parser.add_option("-p", "--package", dest="package",
                      default=package_file,
                      help="Addon SDK package.json file", metavar="FILE")
    parser.add_option("-d", "--dependencies", dest="dependencies", 
                      default=dependencies_file, metavar="FILE",
                      help="repository dependencies.json file")
    (options, args) = parser.parse_args()
    package = get_package(options.package)
    dependencies = get_dependencies(options.dependencies)
    
    if options.version:
        print package.get('version')
        sys.exit(0)
    if options.reltag:
        pull_release(options, package, dependencies)
    else:
        pull_app(package, dependencies)
        pull_deps(dependencies)
    if options.tag:
        tag_release(package, dependencies)
