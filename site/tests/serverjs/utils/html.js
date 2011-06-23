/*jslint laxbreak: true, eqeqeq: true, undef: true, regexp: false */
/*global require, process, exports */

var sys = require('sys');

/*  Function: escape(value);
        Escapes the characters &, <, >, ' and " in string with html entities.
    Arguments:
        value - string to escape
*/
var escape = exports.escape = function (value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/'/g, '&#39;')
        .replace(/"/g, '&qout;');
};

/*  Function: linebreaks(value, options);
        Converts newlines into <p> and <br />s.
    Arguments:
        value - string, the string to convert.
        options - optional, see options
    Options:
        escape - boolean, if true pass the string through escape()
        onlybr - boolean, if true only br tags will be created.
*/
var linebreaks = exports.linebreaks = function (value, options) {
    options = options || {};
    value = value.replace(/\r\n|\r|\n/g, '\n');

    if (options.onlybr) {
        return (options.escape ? escape(value) : value).replace(/\n/g, '<br />');
    }

    var lines = value.split(/\n{2,}/);
    if (options.escape) {
        lines = lines.map( function (x) { return '<p>' + escape(x).replace('\n', '<br />') + '</p>'; } );
    } else {
        lines = lines.map( function (x) { return '<p>' + x.replace('\n', '<br />') + '</p>'; } );
    }
    return lines.join('\n\n');
};


var re_words = /&.*?;|<.*?>|(\w[\w\-]*)/g;
var re_tag = /<(\/)?([^ ]+?)(?: (\/)| .*?)?>/;
var html4_singlets = ['br', 'col', 'link', 'base', 'img', 'param', 'area', 'hr', 'input'];
var truncate_html_words = exports.truncate_html_words = function (input, cnt) {
    var words = 0, pos = 0, elipsis_pos = 0, length = cnt - 0;
    var open_tags = [];

    if (!length) { return ''; }

    re_words.lastIndex = 0;

    while (words <= length) {
        var m = re_words( input );
        if (!m) {
            // parsed through string
            break;
        }

        pos = re_words.lastIndex;

        if (m[1]) {
            // this is not a tag
            words += 1;
            if (words === length) {
                elipsis_pos = pos;
            }
            continue;
        }

        var tag = re_tag( m[0] );
        if (!tag || elipsis_pos) {
            // don't worry about non-tags or tags after truncate point
            continue;
        }

        var closing_tag = tag[1], tagname = tag[2].toLowerCase(), self_closing = tag[3];
        if (self_closing || html4_singlets.indexOf(tagname) > -1) {
            continue;
        } else if (closing_tag) {
            var idx = open_tags.indexOf(tagname);
            if (idx > -1) {
                // SGML: An end tag closes, back to the matching start tag, all unclosed intervening start tags with omitted end tags
                open_tags = open_tags.slice(idx + 1);
            }
        } else {
            open_tags.unshift( tagname );
        }
    }

    if (words <= length) {
        return input;
    }
    return open_tags.reduce( function (p,c) { return p + '</' + c + '>'; }, input.slice(0, elipsis_pos) + ' ...');
};



var punctuation_re = /^((?:\(|<|&lt;)*)(.*?)((?:\.|,|\)|>|\n|&gt;)*)$/;
var simple_email_re = /^\S+@[a-zA-Z0-9._\-]+\.[a-zA-Z0-9._\-]+$/;

function trim_url(url, limit) {
    if (limit === undefined || limit > url.length) { return url; }
    return url.substr(0, limit - 3 > 0 ? limit - 3 : 0) + '...';
}

/* Function: urlize(text, options)
        Converts all urls found in text into links (<a href="URL">URL</a>).
    Arguments:
        text - string, the text to convert.
        options - optional, see options
    Options:
        escape - boolean, if true pass the string through escape()
        limit - number, if defined the shown urls will be truncated with '...' at this length
        nofollow - boolean, if true add rel="nofollow" to <a> tags
*/
function urlize(text, options) {
    options = options || {};

    var words = text.split(/(\s+)/g);
    var nofollow = options.nofollow ? ' rel="nofollow"' : '';

    words.forEach( function (word, i, words) {
        var match;
        if (word.indexOf('.') > -1 || word.indexOf('@') > -1 || word.indexOf(':') > -1) {
            match = punctuation_re(word);
        }

        if (match) {
            var url, lead = match[1], middle = match[2], trail = match[3];
            if (middle.substr(0,7) === 'http://' || middle.substr(0,8) === 'https://') {
                url = encodeURI(middle);
            } else if (middle.substr(0,4) === 'www.' || (
              middle.indexOf('@') === -1 && middle && middle[0].match(/[a-z0-9]/i) &&
              (middle.substr(-4) === '.org' || middle.substr(-4) === '.net' || middle.substr(-4) === '.com'))) {
                url = encodeURI('http://' + middle);
            } else if (middle.indexOf('@') > -1 && middle.indexOf(':') === -1 && simple_email_re(middle)) {
                url = 'mailto:' + middle;
                nofollow = '';
            }

            if (url) {
                var trimmed = trim_url(middle, options.limit);
                if (options.escape) {
                    lead = escape(lead);
                    trail = escape(trail);
                    url = escape(url);
                    trimmed = escape(trimmed);
                }
                middle = '<a href="' + url + '"' + nofollow + '>' + trimmed + '</a>';
                words[i] = lead + middle + trail;
            }
        } else if (options.escape) {
            words[i] = escape(word);
        }
    });
    return words.join('');
}

exports.urlize = urlize;



/* Function: strip_spaces_between_tags
       Returns the given HTML with spaces between tags removed.
   Arguments:
       input: string, the html to process
*/
exports.strip_spaces_between_tags = function (input) {
    return input.replace(/>\s+</g, '><');
}





