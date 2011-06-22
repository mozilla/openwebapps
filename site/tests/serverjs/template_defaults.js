/*jslint eqeqeq: true, undef: true, regexp: false */
/*global require, process, exports, escape */

var sys = require('sys');
var string_utils = require('./utils/string');
var date_utils = require('./utils/date');
var html = require('./utils/html');
var iter = require('./utils/iter');
var import = require('./utils/import').import;

import(GLOBAL, require('./utils/tags'));

/* TODO: Missing filters

    Don't know how:
        iriencode

    Not implemented (yet):
        unordered_list

NOTE:
    stringformat() filter is regular sprintf compliant and doesn't have real python syntax

Missing tags:

    ssi (will require ALLOWED_INCLUDE_ROOTS somehow)
    debug

NOTE:
    cycle tag does not support legacy syntax (row1,row2,row3)
    load takes a path - like require. Loaded module must expose tags and filters objects.
    url tag relies on app being set in process.djangode_urls 
*/

var filters = exports.filters = {
    add: function (value, arg) {
        value = value - 0;
        arg = arg - 0;
        return (isNaN(value) || isNaN(arg)) ? '' : (value + arg);
    },
    addslashes: function (value, arg) { return string_utils.add_slashes("" + value); },
    capfirst: function (value, arg) { return string_utils.cap_first("" + value); },
    center: function (value, arg) { return string_utils.center("" + value, arg - 0); },
    cut: function (value, arg) { return ("" + value).replace(new RegExp(arg, 'g'), ""); },
    date: function (value, arg) {
        // TODO: this filter may be unsafe...
        return (value instanceof Date) ? date_utils.format_date(value, arg) : '';
    },
    'default': function (value, arg) {
        // TODO: this filter may be unsafe...
        return value ? value : arg;
    },
    default_if_none: function (value, arg) {
        // TODO: this filter may be unsafe...
        return (value === null || value === undefined) ? arg : value;
    },

    dictsort: function (value, arg) {
        var clone = value.slice(0);
        clone.sort(function (a, b) { return a[arg] < b[arg] ? -1 : a[arg] > b[arg] ? 1 : 0; });
        return clone;
    },

    dictsortreversed: function (value, arg) {
        var tmp = filters.dictsort(value, arg);
        tmp.reverse();
        return tmp;
    },
    divisibleby: function (value, arg) { return value % arg === 0; },

    escape: function (value, arg, safety) {
        safety.must_escape = true;
        return value;
    },
    escapejs: function (value, arg) { return escape(value || ''); },
    filesizeformat: function (value, arg) {
        var bytes = value - 0;
        if (isNaN(bytes)) { return "0 bytes"; }
        if (bytes <= 1) { return '1 byte'; }
        if (bytes < 1024) { return bytes.toFixed(0) + ' bytes'; }
        if (bytes < 1024 * 1024) { return (bytes / 1024).toFixed(1) + 'KB'; }
        if (bytes < 1024 * 1024 * 1024) { return (bytes / (1024 * 1024)).toFixed(1) + 'MB'; }
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + 'GB';
    },
    first: function (value, arg) { return (value instanceof Array) ? value[0] : ""; },
    fix_ampersands: function (value, arg, safety) {
        safety.is_safe = true;
        return ("" + value).replace('&', '&amp;');
    },
    floatformat: function (value, arg) {
        arg = arg - 0 || -1;
        var num = value - 0,
            show_zeroes = arg > 0,
            fix = Math.abs(arg);
        if (isNaN(num)) {
            return '';
        }
        var s = num.toFixed(fix);
        if (!show_zeroes && s % 1 === 0) {
            return num.toFixed(0);
        }
        return s;
    },
    force_escape: function (value, arg, safety) {
        safety.is_safe = true;
        return html.escape("" + value);
    },
    get_digit: function (value, arg) {
        if (typeof value !== 'number' || typeof arg !== 'number' || arg < 1) { return value; }
        var s = "" + value;
        return s[s.length - arg] - 0;
    },
    iriencode: function (value, arg) {
        // TODO: implement iriencode filter
        throw "iri encoding is not implemented";
    },
    join: function (value, arg) {
        // TODO: this filter may be unsafe...
        return (value instanceof Array) ? value.join(arg) : '';
    },
    last: function (value, arg) { return ((value instanceof Array) && value.length) ? value[value.length - 1] : ''; },
    length: function (value, arg) { return value.length ? value.length : 0; },
    length_is: function (value, arg) { return value.length === arg; },
    linebreaks: function (value, arg, safety) {
        var out = html.linebreaks("" + value, { escape: !safety.is_safe && safety.must_escape });
        safety.is_safe = true;
        return out;
    },
    linebreaksbr: function (value, arg, safety) {
        var out = html.linebreaks("" + value, { onlybr: true, escape: !safety.is_safe && safety.must_escape });
        safety.is_safe = true;
        return out;
    },
    linenumbers: function (value, arg, safety) {
        var lines = String(value).split('\n');
        var len = String(lines.length).length;

        var out = lines
            .map(function (s, idx) {
                if (!safety.is_safe && safety.must_escape) {
                    s = html.escape("" + s);
                }
                return string_utils.sprintf('%0' + len + 'd. %s', idx + 1, s); })
            .join('\n');
        safety.is_safe = true;
        return out;
    },
    ljust: function (value, arg) {
        arg = arg - 0;
        try {
            return string_utils.sprintf('%-' + arg + 's', value).substr(0, arg);
        } catch (e) {
            return '';
        }
    },
    lower: function (value, arg) { return typeof value === 'string' ? value.toLowerCase() : ''; },
    make_list: function (value, arg) { return String(value).split(''); },
    phone2numeric: function (value, arg) {
        value = String(value).toLowerCase();
        return value.replace(/[a-pr-y]/g, function (x) {
            var code = x.charCodeAt(0) - 91;
            if (code > 22) { code = code - 1; }
            return Math.floor(code / 3);
        });
    },
    pluralize: function (value, arg) {
        // TODO: this filter may not be safe
        value = Number(value);
        var plural = arg ? String(arg).split(',') : ['', 's'];
        if (plural.length === 1) { plural.unshift(''); }
        if (isNaN(value)) { return ''; }
        return value === 1 ? plural[0] : plural[1];
    },
    pprint: function (value, arg) { return JSON.stringify(value); },
    random: function (value, arg) {
        return (value instanceof Array) ? value[ Math.floor( Math.random() * value.length ) ] : '';
    },
    removetags: function (value, arg, safety) {
        arg = String(arg).replace(/\s+/g, '|');
        var re = new RegExp( '</?\\s*(' + arg + ')\\b[^>]*/?>', 'ig');
        safety.is_safe = true;
        return String(value).replace(re, '');
    },
    rjust: function (value, arg) {
        try {
            return string_utils.sprintf('%' + arg + 's', value).substr(0, arg);
        } catch (e) {
            return '';
        }
    },
    safe: function (value, arg, safety) {
        safety.is_safe = true;
        return value;
    },
    safeseq: function (value, arg) {
        safety.is_safe = true;
        return value;
    },
    slice: function (value, arg) {
        if (!(value instanceof Array)) { return []; }
        var parts = (arg || '').split(/:/g);
        
        if (parts[1] === '') {
            parts[1] = value.length;
        }
        parts = parts.map(Number);

        if (!parts[2]) {
            return value.slice(parts[0], parts[1]);
        }
        var out = [], i = parts[0], end = parts[1];
        for (;i < end; i += parts[2]) {
            out.push(value[i]);
        }
        return out;

    },
    slugify: function (value, arg) {
        return String(value).toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
    },
    stringformat: function (value, arg) {
        // TODO: this filter may not be safe
        try { return string_utils.sprintf('%' + arg, value); } catch (e) { return ''; }
    },
    striptags: function (value, arg, safety) {
        safety.is_safe = true;
        return String(value).replace(/<(.|\n)*?>/g, '');
    },
    title: function (value, arg) {
        return string_utils.titleCaps( String(value) );
    },
    time: function (value, arg) {
        // TODO: this filter may not be safe
        return (value instanceof Date) ? date_utils.format_time(value, arg) : '';
    },
    timesince: function (value, arg) {
        // TODO: this filter may not be safe (if people decides to put & or " in formatstrings"
        value = new Date(value);
        arg = new Date(arg);
        if (isNaN(value) || isNaN(arg)) { return ''; }
        return date_utils.timesince(value, arg);
    },
    timeuntil: function (value, arg) {
        // TODO: this filter may not be safe (if people decides to put & or " in formatstrings"
        value = new Date(value);
        arg = new Date(arg);
        if (isNaN(value) || isNaN(arg)) { return ''; }
        return date_utils.timeuntil(value, arg);
    },
    truncatewords: function (value, arg) {
        return String(value).split(/\s+/g).slice(0, arg).join(' ') + ' ...';
    },
    truncatewords_html: function (value, arg, safety) {
        safety.is_safe = true;
        return html.truncate_html_words(value, arg - 0);
    },
    upper: function (value, arg) {
        return (value + '').toUpperCase();
    },
    urlencode: function (value, arg) {
        return escape(value);
    },
    urlize: function (value, arg, safety) {
        if (!safety.is_safe && safety.must_escape) {
            var out = html.urlize(value + "", { escape: true });
            safety.is_safe = true;
            return out;
        }
        return html.urlize(value + "");
    },
    urlizetrunc: function (value, arg, safety) {
        if (!safety.is_safe && safety.must_escape) {
            var out = html.urlize(value + "", { escape: true, limit: arg });
            safety.is_safe = true;
            return out;
        }
        return html.urlize(value + "", { limit: arg });
    },
    wordcount: function (value, arg) {
        return (value + "").split(/\s+/g).length;
    },
    wordwrap: function (value, arg) {
        return string_utils.wordwrap(value + "", arg - 0);
    },
    yesno: function (value, arg) {
        var responses = (arg + "").split(/,/g);
        if (responses[2] && (value === undefined || value === null)) { return responses[2]; }
        return (value ? responses[0] : responses[1]) || '';
    }

};


var nodes = exports.nodes = {

    TextNode: function (text) {
        return function (context, callback) { callback(false, text); };
    },

    VariableNode: function (filterexpression) {
        return function (context, callback) {
            callback(false, filterexpression.resolve(context));
        };
    },

    ForNode: function (node_list, empty_list, itemname, listname, isReversed) {

        return function (context, callback) {
            var forloop = { parentloop: context.get('forloop') },
                list = context.get(listname),
                out = '';

            if (! list instanceof Array) { throw 'list not iterable' }
            if (isReversed) { list = list.slice(0).reverse(); }

            if (list.length === 0) {
                if (empty_list) {
                    empty_list.evaluate(context, callback);
                } else {
                    callback(false, '');
                }
                return;
            }

            context.push();
            context.set('forloop', forloop);

            function inner(p, c, idx, list, next) {
                import(forloop, {
                    counter: idx + 1,
                    counter0: idx,
                    revcounter: list.length - idx,
                    revcounter0: list.length - (idx + 1),
                    first: idx === 0,
                    last: idx === list.length - 1
                });
                context.set(itemname, c);

                node_list.evaluate( context, function (error, result) { next(error, p + result); });
            }

            iter.reduce(list, inner, '', function (error, result) {
                context.pop();
                callback(error, result);
            });
        };
    },

    IfNode: function (item_names, not_item_names, operator, if_node_list, else_node_list) {

        return function (context, callback) {

            function not(x) { return !x; }
            function and(p,c) { return p && c; }
            function or(p,c) { return p || c; }

            var items = item_names.map( context.get, context ).concat(
                not_item_names.map( context.get, context ).map( not )
            );

            var isTrue = items.reduce( operator === 'or' ? or : and, true );

            if (isTrue) {
                if_node_list.evaluate(context, function (error, result) { callback(error, result); });
            } else if (else_node_list) {
                else_node_list.evaluate(context, function (error, result) { callback(error, result); });
            } else {
                callback(false, '');
            }
        };
    },

    IfChangedNode: function (node_list, else_list, parts) {
        var last;

        return function (context, callback) {
            node_list.evaluate(context, function (error, result) {
                if (result !== last) {
                    last = result;
                    callback(error, result);
                } else if (!error && else_list) {
                    else_list.evaluate(context, callback);
                } else {
                    callback(error, '');
                }
            });
        };
    },

    IfEqualNode: function (node_list, else_list, first, second) {
        return function (context, callback) {
            if (context.get(first) == context.get(second)) {
                node_list.evaluate(context, callback);
            } else if (else_list) {
                else_list.evaluate(context, callback);
            } else {
                callback(false, '');
            }
        };
    },

    IfNotEqualNode: function (node_list, else_list, first, second) {
        return function (context, callback) {
            if (context.get(first) != context.get(second)) {
                node_list.evaluate(context, callback);
            } else if (else_list) {
                else_list.evaluate(context, callback);
            } else {
                callback(false, '');
            }
        };
    },


    CycleNode: function (items) {

        var cnt = 0;

        return function (context, callback) {

            var choices = items.map( context.get, context );
            var val = choices[cnt];
            cnt = (cnt + 1) % choices.length;
            callback(false, val);
        };
    },

    FilterNode: function (expression, node_list) {
        return function (context, callback) {
            node_list.evaluate( context, function (error, constant) {
                expression.constant = constant;
                callback(error, expression.resolve(context));
            });
        };
    },

    BlockNode: function (node_list, name) {

        /* upon execution each block stores it's nodelist in the context
         * indexed by the blocks name. As templates are executed from child to
         * parent, similar named blocks add their nodelist to an array of
         * nodelists (still indexed by the blocks name). When the root template
         * is reached, the blocks nodelists are executed one after each other
         * and the super variable is updated down through the hierachy.
        */
        return function (context, callback) {

            // init block list if it isn't already
            if (!context.blocks[name]) {
                context.blocks[name] = [];
            }

            // put this block in front of list
            context.blocks[name].unshift( node_list );

            // if this is a root template descend through templates and evaluate blocks for overrides
            if (!context.extends) {

                context.push();

                function inner(p, c, idx, block_list, next) {
                    c.evaluate( context, function (error, result) {
                        context.set('block', { super: result });
                        next(error, result);
                    });
                }
                iter.reduce( context.blocks[name], inner, '', function (error, result) {
                    context.pop();
                    callback(error, result);
                });

            } else {
                // else return empty string
                callback(false, '');
            }
        };
    },

    ExtendsNode: function (item) {
        return function (context, callback) {
            context.extends = context.get(item);
            callback(false, '');
        };
    },

    AutoescapeNode: function (node_list, enable) {

        if (enable.toLowerCase() === 'on') {
            enable = true;
        } else {
            enable = false;
        }

        return function (context, callback) {
            var before = context.autoescaping;
            context.autoescaping = enable;
            node_list.evaluate( context, function ( error, result ) {
                context.autoescaping = before;
                callback(error, result);
            });
        }
    },

    FirstOfNode: function (/*...*/) {
    
        var choices = Array.prototype.slice.apply(arguments);

        return function (context, callback) {
            var i, val, found;
            for (i = 0; i < choices.length; i++) {
                val = context.get(choices[i]);
                if (val) { found = true; break; }
            }
            callback(false, found ? val : '')
        };
    },

    WithNode: function (node_list, variable, name) {
        return function (context, callback) {
            var item = context.get(variable);
            context.push();
            context.set(name, item);
            node_list.evaluate( context, function (error, result) {
                context.pop();
                callback(error, result);
            });
        }
    },

    NowNode: function (format) {
        if (format.match(/^["']/)) {
            format = format.slice(1, -1);
        }
        return function (context, callback) {
            callback(false, date_utils.format_date(new Date(), format));
        };
    },

    IncludeNode: function (name) {
        return function (context, callback) {
            var loader = require('./loader');
            loader.load_and_render(context.get(name), context, callback);
        }
    },

    LoadNode: function (path, package) {
        return function (context, callback) {
            import(context.filters, package.filters);
            callback(false, '');
        }
    },

    TemplateTagNode: function (type) {
        return function (context, callback) {
            var bits = {
                openblock: '{%',
                closeblock: '%}',
                openvariable: '{{',
                closevariable: '}}',
                openbrace: '{',
                closebrace: '}',
                opencomment: '{#',
                closecomment: '#}'
            };
            if (!bits[type]) {
                callback('unknown bit');
            } else {
                callback(false, bits[type]);
            }
        }
    },

    SpacelessNode: function (node_list) {
        return function (context, callback) {
            node_list.evaluate(context, function (error, result) {
                callback(error, html.strip_spaces_between_tags(result + ""));
            });
        }
    },

    WithRatioNode: function (current, max, constant) {
        return function (context, callback) {
            current_val = context.get(current);
            max_val = context.get(max);
            constant_val = context.get(constant);

            callback(false, Math.round(current_val / max_val * constant_val) + "");
        }
    },

    RegroupNode: function (item, key, name) {
        return function (context, callback) {
            var list = context.get(item);
            if (!list instanceof Array) { callback(false, ''); }

            var dict = {};
            var grouped = list
                .map(function (x) { return x[key]; })
                .filter(function (x) { var val = dict[x]; dict[x] = x; return !val; })
                .map(function (grp) {
                    return { grouper: grp, list: list.filter(function (o) { return o[key] === grp }) };
                });

            context.set(name, grouped);
            callback(false, '');
        }
    },

    UrlNode: function (url_name, replacements, item_name) {

        return function (context, callback) {
            var match = process.djangode_urls[context.get(url_name)]
            if (!match) { return callback('no matching urls for ' + url_name); }

            var url = string_utils.regex_to_string(match, replacements.map(function (x) { return context.get(x); }));
            if (url[0] !== '/') { url = '/' + url; }
            
            if (item_name) {
                context.set( item_name, url);
                callback(false, '');
            } else {
                callback(false, url);
            }
        }
    }
};

var tags = exports.tags = {
    'text': function (parser, token) { return nodes.TextNode(token.contents); },

    'variable': function (parser, token) {
        return nodes.VariableNode( parser.make_filterexpression(token.contents) );
    },

    'comment': function (parser, token) {
        parser.parse('end' + token.type);
        parser.delete_first_token();
        return nodes.TextNode('');
    },

    'for': function (parser, token) {
        
        var parts = get_args_from_token(token, { exclude: 2, mustbe: { 2: 'in', 4: 'reversed'} });

        var itemname = parts[0],
            listname = parts[1],
            isReversed = (parts[2] === 'reversed');

        var node_list = parser.parse('empty', 'end' + token.type);
        if (parser.next_token().type === 'empty') {
            var empty_list = parser.parse('end' + token.type);
            parser.delete_first_token();
        }

        return nodes.ForNode(node_list, empty_list, itemname, listname, isReversed);
    },
    
    'if': function (parser, token) {

        var parts = token.split_contents();

        // get rid of if keyword
        parts.shift();

        var operator = '',
            item_names = [],
            not_item_names = [];

        var p, next_should_be_item = true;

        while (p = parts.shift()) {
            if (next_should_be_item) {
                if (p === 'not') {
                    p = parts.shift();
                    if (!p) { throw 'unexpected syntax in "if" tag. Expected item name after not'; }
                    not_item_names.push( p );
                } else {
                    item_names.push( p );
                }
                next_should_be_item = false;
            } else {
                if (p !== 'and' && p !== 'or') { throw 'unexpected syntax in "if" tag. Expected "and" or "or"'; }
                if (operator && p !== operator) { throw 'unexpected syntax in "if" tag. Cannot mix "and" and "or"'; }
                operator = p;
                next_should_be_item = true;
            }
        }

        var node_list, else_list;
        
        node_list = parser.parse('else', 'end' + token.type);
        if (parser.next_token().type === 'else') {
            else_list = parser.parse('end' + token.type);
            parser.delete_first_token();
        }

        return nodes.IfNode(item_names, not_item_names, operator, node_list, else_list);
    },

    'ifchanged': function (parser, token) {
        var parts = get_args_from_token(token);

        var node_list, else_list;
        
        node_list = parser.parse('else', 'end' + token.type);
        if (parser.next_token().type === 'else') {
            else_list = parser.parse('end' + token.type);
            parser.delete_first_token();
        }

        return nodes.IfChangedNode(node_list, else_list, parts);
    },

    'ifequal': function (parser, token) {
        var parts = get_args_from_token(token, { argcount: 2 });

        var node_list, else_list;
        
        node_list = parser.parse('else', 'end' + token.type);
        if (parser.next_token().type === 'else') {
            else_list = parser.parse('end' + token.type);
            parser.delete_first_token();
        }

        return nodes.IfEqualNode(node_list, else_list, parts[0], parts[1]);
    },

    'ifnotequal': function (parser, token) {
        var parts = get_args_from_token(token, { argcount: 2 });

        var node_list, else_list;
        
        node_list = parser.parse('else', 'end' + token.type);
        if (parser.next_token().type === 'else') {
            else_list = parser.parse('end' + token.type);
            parser.delete_first_token();
        }

        return nodes.IfNotEqualNode(node_list, else_list, parts[0], parts[1]);
    },

    'cycle': function (parser, token) {
        var parts = token.split_contents();

        var items = parts.slice(1);
        var as_idx = items.indexOf('as');
        var name = '';

        if (items.length === 1) {
            if (!parser.cycles || !parser.cycles[items[0]]) {
                throw 'no cycle named ' + items[0] + '!';
            } else {
                return parser.cycles[items[0]];
            }
        }

        if (as_idx > 0) {
            if (as_idx === items.length - 1) {
                throw 'unexpected syntax in "cycle" tag. Expected name after as';
            }

            name = items[items.length - 1];
            items = items.slice(0, items.length - 2);

            if (!parser.cycles) { parser.cycles = {}; }
            parser.cycles[name] = nodes.CycleNode(items);
            return parser.cycles[name];
        }

        return nodes.CycleNode(items);
    },

    'filter': function (parser, token) {
        var parts = token.split_contents();
        if (parts.length > 2) { throw 'unexpected syntax in "filter" tag'; }

        var expr = parser.make_filterexpression('|' + parts[1]);

        var node_list = parser.parse('endfilter');
        parser.delete_first_token();

        return nodes.FilterNode(expr, node_list);
    },

    'autoescape': function (parser, token) {
        var parts = get_args_from_token(token, { argcount: 1, mustbe: { 1: ['on', 'off'] }});
        var node_list = parser.parse('end' + token.type);
        parser.delete_first_token();
        return nodes.AutoescapeNode(node_list, parts[0]);
    },
    
    'block': function (parser, token) {
        var parts = get_args_from_token(token, { argcount: 1 });
        var node_list = parser.parse('end' + token.type);
        parser.delete_first_token();
        return nodes.BlockNode(node_list, parts[0]);
    },

    'extends': simple_tag(nodes.ExtendsNode, { argcount: 1 }),

    'firstof': simple_tag(nodes.FirstOfNode),

    'with': function (parser, token) {
        var parts = get_args_from_token(token, { argcount: 3, exclude: 2, mustbe: { 2: 'as' }});
        var node_list = parser.parse('end' + token.type);
        parser.delete_first_token();
        return nodes.WithNode(node_list, parts[0], parts[1], parts[2]);
    },
    
    'now': simple_tag(nodes.NowNode, { argcount: 1 }),
    'include': simple_tag(nodes.IncludeNode, { argcount: 1 }),
    'load': function (parser, token) {
        var parts = get_args_from_token(token, { argcount: 1 });
        var name = parts[0];
        if (name[0] === '"' || name[0] === "'") {
            name = name.substr(1, name.length - 2);
        }

        var package = require(name);
        import(parser.tags, package.tags);

        return nodes.LoadNode(name, package);
    },
    'templatetag': simple_tag(nodes.TemplateTagNode, { argcount: 1 }),
    'spaceless': function (parser, token) {
        var parts = get_args_from_token(token, { argcount: 0 });
        var node_list = parser.parse('end' + token.type);
        parser.delete_first_token();
        return nodes.SpacelessNode(node_list);
    },
    'widthratio': simple_tag(nodes.WithRatioNode, { argcount: 3 }),
    'regroup': simple_tag(nodes.RegroupNode, { argcount: 5, mustbe: { 2: 'by', 4: 'as' }, exclude: [2, 4] }),

    'url': function (parser, token) {
        var parts = token.split_contents();
        parts.shift();

        var url_name = parts.shift();

        if (parts[parts.length - 2] === 'as') {
            var item_name = parts.pop();
            parts.pop();
        }

        // TODO: handle qouted strings with commas in them correctly
        var replacements = parts.join('').split(/\s*,\s*/)

        return nodes.UrlNode(url_name, replacements, item_name);
    }


};

