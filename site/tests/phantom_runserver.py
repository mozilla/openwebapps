#!/usr/bin/env python

import optparse
import subprocess
import os
import signal
import sys

here = os.path.dirname(os.path.abspath(__file__))

SERVER_PORT = 60173

parser = optparse.OptionParser(
    usage='%prog [TESTS]',
    description='Run the tests with phantomjs, and also run the node server')


def main():
    options, args = parser.parse_args()
    print 'Running server'
    env = os.environ.copy()
    env['PRIMARY_PORT'] = str(SERVER_PORT)
    server_proc = subprocess.Popen(
        ['node', 'run.js'], cwd=here, env=env)
    ## FIXME: this doesn't generally give an error fast enough to work
    if server_proc.returncode:
        print 'ERROR in node server'
        sys.exit(2)
    phantom_proc = subprocess.Popen(
        ['pyphantomjs', 'js/phantomrunner.js', '--server-port', str(SERVER_PORT)], cwd=here)
    phantom_proc.communicate()
    os.kill(server_proc.pid, signal.SIGKILL)
    sys.exit(phantom_proc.returncode)


if __name__ == '__main__':
    main()
