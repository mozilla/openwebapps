#!/usr/bin/env python

import optparse
import os
import sys
import re

start_re = re.compile('START jschannel.js')
leading_whitespace = re.compile('^\s+')
end_re = re.compile('END jschannel.js')

here = os.path.dirname(os.path.abspath(__file__))
jschannel_default = os.path.join(os.path.dirname(here), 'jschannel.js')

parser = optparse.OptionParser(
    usage="%prog [--jschannel=jschannel.js] [INPUT] [OUTPUT]",
    description="Inlines jschannel into the given file, writing to output or rewriting the file"
    )

parser.add_option(
    '--jschannel', metavar='JSCHANNEL.JS',
    help="Location of jschannel.js (default: %s)" % jschannel_default,
    default=jschannel_default)

def main():
    options, args = parser.parse_args()
    input_fn = os.path.join(os.path.dirname(here), 'include.js')
    output_fn = input_fn
    if args:
        input_fn = args[0]
        if len(args) > 1:
            output_fn = args[1]
    if input_fn == '-':
        input_content = sys.stdin.read()
    else:
        fp = open(input_fn, 'rb')
        input_content = fp.read()
        fp.close()
    fp = open(options.jschannel, 'rb')
    jschannel = fp.read()
    fp.close()
    new_content = []
    started = False
    for line in input_content.splitlines(True):
        if not started and start_re.search(line):
            started = True
            new_content.append(line)
            leading = leading_whitespace.search(line).group(0)
            for js_line in jschannel.splitlines(True):
                new_content.append(leading + js_line)
            continue
        if started and end_re.search(line):
            started = False
        if not started:
            new_content.append(line)
    new_content = ''.join(new_content)
    if output_fn == '-':
        sys.stdout.write(new_content)
    else:
        print 'Writing to %s' % output_fn
        fp = open(output_fn, 'wb')
        fp.write(new_content)
        fp.close()

if __name__ == '__main__':
    main()
