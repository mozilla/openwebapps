"""This is a script for people using Windows, to reintroduce symlinks
into their git checkouts of this project.

This project uses symlinks for sharing modules between different
implementations.  All the "master" files are in /jslibs/

**This script must be run with administrator privileges**

This is because symlinks on Windows require these permissions (and
only work in Windows Vista and 7).  To start it as an administrator,
probably the easiest way is to open cmd.exe as an administrator and
then run this script.

If you cannot run this as administrator, you can use the --copy option
to make copies of files; you cannot edit the resulting copies however.

This is implemented in Python, which is also used elsewhere in the
project, so we hope you'll have it installed.
"""

import os
import subprocess
import optparse

parser = optparse.OptionParser(
    usage='%prog [OPTIONS]',
    description='Setup symlinks on Windows (not needed no Mac or Linux)')

parser.add_option(
    '-n', '--simulate',
    action='store_true',
    help="Do not actually create the symlinks")

parser.add_option(
    '--git-cmd', metavar="COMMAND_NAME",
    default="git.cmd",
    help="Name of the git command (default: git.cmd)")

parser.add_option(
    '-c', '--copy', action='store_true',
    help="Copy the files instead of using MKLINK; does not require admin privileges")


def main():
    options, args = parser.parse_args()
    proc = subprocess.Popen([options.git_cmd, 'ls-files', '-s'], stdout=subprocess.PIPE)
    stdout, stderr = proc.communicate()
    lines = stdout.splitlines()
    for line in lines:
        parts = line.split()
        if parts[0] == '120000':
            fn = parts[3]
            fn = fn.replace('/', '\\')
            symlink(fn, options.simulate, options.git_cmd, options.copy)


def symlink(fn, simulate, git_cmd, copy):
    if not os.path.exists(fn):
        proc = subprocess.Popen([git_cmd, 'checkout', fn])
        proc.communicate()
    fp = open(fn)
    name = fp.read().strip()
    fp.close()
    if len(name.splitlines()) > 1 and WARNING_MARKER not in name:
        print 'File has already been symlinked or copied:'
        print '  %s' % fn
        return
    if WARNING_MARKER in name:
        print 'File %s is a copy; refreshing copy' % fn
        os.unlink(fn)
        proc = subprocess.Popen([git_cmd, 'checkout', fn])
        proc.communicate()
        fp = open(fn)
        name = fp.read().strip()
        fp.close()
        assert len(name.splitlines()) == 1
    name = name.replace('/', '\\')
    os.unlink(fn)
    if not simulate and not copy:
        # This is so bizarre...
        print 'Symlinking %s -> %s' % (fn, name)
        proc = subprocess.Popen(['cmd', '/c', 'mklink', os.path.basename(fn), name], cwd=os.path.dirname(fn) or '.', shell=True)
        proc.communicate()
        if proc.returncode:
            print 'Command failed; maybe you need to run as administrator?'
    elif not simulate and copy:
        print 'Copying %s to %s' % (os.path.join(os.path.dirname(fn), name), fn)
        fp = open(os.path.join(os.path.dirname(fn), name))
        content = fp.read()
        fp.close()
        if name.endswith('.js'):
            content = (WARNING % name) + '\r\n' + content
        fp = open(fn, 'w')
        fp.write(content)
        fp.close()
    proc = subprocess.Popen([git_cmd, 'update-index', '--assume-unchanged', fn])
    proc.communicate()

WARNING_MARKER = 'WARNING-COPIED-FILE'

WARNING = '/* %s: this file is a copy of %%s - do not edit this copy! */' % WARNING_MARKER

if __name__ == '__main__':
    main()
