#!/usr/bin/env python
try:
    from lxml import html
except ImportError:
    raise ImportError("You must have lxml installed to use this tool")
import optparse
import urlparse
import urllib
import sys
import subprocess
import os

HTML_COMPRESSOR = 'http://htmlcompressor.googlecode.com/files/htmlcompressor-0.9.8.jar'
YUI_COMPRESSOR = 'http://yuilibrary.com/downloads/yuicompressor/yuicompressor-2.4.2.zip'
here = os.path.dirname(os.path.abspath(__file__))
compressor_dir = here

parser = optparse.OptionParser(
    usage="%prog PAGE.HTML")
parser.add_option(
    '-o', '--output',
    metavar='FILE',
    help='Output to a file (default stdout)')
parser.add_option(
    '-r', '--remote',
    action='store_true',
    help='Fetch and inline remote resources (otherwise only local '
    'files will be inlined)')
parser.add_option(
    '--compress',
    action='store_true',
    help='Use htmlcompressor to compress the HTML after generation')
parser.add_option(
    '--comment',
    metavar="TEXT",
    help="Include the given comment in the generated HTML")
parser.add_option(
    '--compressor-dir',
    metavar="DIR",
    help="Directory in which to find htmlcompressor and yuicompressor jar files")


def main(args=None):
    global compressor_dir
    if args is None:
        args = sys.argv[1:]
    options, args = parser.parse_args(args)
    if not args:
        parser.error(
            'You must give at least one page (piping not supported)')
    if options.compressor_dir:
        compressor_dir = options.compressor_dir
    for arg in args:
        inline_page(arg, options.output, options.remote, options.compress, options.comment)


def inline_page(filename, output, remote, compress, comment):
    page = html.parse(filename).getroot()
    for el in page.xpath('//link[@rel="stylesheet"]'):
        if el.get('type', '').lower() not in ('text/css', ''):
            continue
        content = get_content(filename, el.get('href'), remote)
        if content is None:
            # Failed
            continue
        prev = el.getprevious()
        if (prev is not None and prev.tag == 'style' and prev.get('type') == 'text/css'
            and (not prev.tail or not prev.tail.strip())):
            new_el = prev
            if el.tail and el.tail.strip():
                new_el.tail = (new_el.tail or '') + el.tail
            el.getparent().remove(el)
        else:
            new_el = html.Element('style')
            new_el.set('type', 'text/css')
            new_el.tail = el.tail
            el.getparent().replace(el, new_el)
        add_text(new_el, content)
    for el in page.xpath('//script'):
        if el.get('type', '').lower() not in ('text/javascript', ''):
            continue
        if not el.get('src'):
            continue
        content = get_content(filename, el.get('src'), remote)
        if content is None:
            continue
        prev = el.getprevious()
        if (prev is not None and prev.tag == 'script' and prev.get('type') == 'text/javascript'
            and (not prev.tail or not prev.tail.strip())):
            new_el = prev
            if el.tail and el.tail.strip():
                new_el.tail = (new_el.tail or '') + el.tail
            el.getparent().remove(el)
        else:
            new_el = html.Element('script')
            new_el.set('type', 'text/javascript')
            new_el.tail = el.tail
            el.getparent().replace(el, new_el)
        add_text(new_el, content)
    text = html.tostring(page)
    after_inline_text = text
    if compress:
        text = run_compressor(text)
    if comment:
        text = '<!-- %s -->\n%s' % (comment, text)
    if not output or output == '-':
        sys.stdout.write(text)
    else:
        with open(output, 'w') as fp:
            fp.write(text)
    with open(filename) as fp:
        pre_text = fp.read()
    log('Starting size:')
    log('  %6i (%6i compressed)'
        % (len(pre_text), len(pre_text.encode('zlib'))))
    if compress:
        log('Inlined size:')
        log('  %6i (%6i compressed)'
            % (len(after_inline_text), len(after_inline_text.encode('zip'))))
    log('Ending size:')
    log('  %6i (%6i compressed)'
        % (len(text), len(text.encode('zlib'))))


def add_text(el, content):
    if el.text:
        el.text = el.text + '\n' + content
    else:
        el.text = content


def get_content(relative_to, href, remote):
    path = urlparse.urljoin(relative_to, href)
    if urlparse.urlsplit(path).scheme != '':
        if not remote:
            log('scheme:' + urlparse.urlsplit(path).scheme)
            log('Not fetching file: %s (remote)' % path)
            return None
        else:
            c = urllib.urlopen(path)
            return c.read()
    else:
        with open(path) as fp:
            return fp.read()


def run_compressor(text):
    name = os.path.join(compressor_dir, os.path.basename(HTML_COMPRESSOR))
    if not os.path.exists(name):
        log('You must download htmlcompressor to use --compress')
        log('You can use:')
        log('  wget %s -O %s' % (HTML_COMPRESSOR, name))
        sys.exit(1)
    yui_name = os.path.join(compressor_dir, os.path.splitext(os.path.basename(YUI_COMPRESSOR))[0] + '.jar')
    if not os.path.exists(yui_name):
        print yui_name
        log('You must download YUI Compressor to use --compress')
        log('You can use:')
        log('  cd %s' % compressor_dir)
        log('  wget %s' % YUI_COMPRESSOR)
        log('  unzip -j %s %s/build/%s'
            % (os.path.basename(YUI_COMPRESSOR),
               os.path.splitext(os.path.basename(yui_name))[0],
               os.path.basename(yui_name)))
        sys.exit(1)
    proc = subprocess.Popen(
        ['java', '-jar', name, '--type', 'html', '--remove-quotes',
         '--compress-js', '--compress-css'],
        stdout=subprocess.PIPE, stdin=subprocess.PIPE)
    stdout, stderr = proc.communicate(text)
    return stdout


def log(msg):
    sys.stderr.write(msg + '\n')


if __name__ == '__main__':
    main()
