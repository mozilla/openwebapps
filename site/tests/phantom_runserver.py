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
    server_proc = None
    phantom_proc = None
    try:
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
        phantom_proc = None
        os.kill(server_proc.pid, signal.SIGKILL)
        server_proc = None
        sys.exit(phantom_proc.returncode)
    finally:
        if server_proc is not None:
            print 'Killing node server'
            os.kill(server_proc.pid, signal.SIGKILL)
        if phantom_proc is not None:
            print 'Killing phantomjs process'
            os.kill(phantom_proc.pid, signal.SIGKILL)


if __name__ == '__main__':
    main()
