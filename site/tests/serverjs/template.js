/*jslint laxbreak: true, eqeqeq: true, undef: true, regexp: false */
/*global require, process, exports */

var sys = require('sys');
var string_utils = require('./utils/string');
var html = require('./utils/html');
var iter = require('./utils/iter');
var import = require('./utils/import').import;

function normalize(value) {
    if (typeof value !== 'string') { return value; }

    if (value === 'true') { return true; }
    if (value === 'false') { return false; }
    if (/^\d/.exec(value)) { return value - 0; }

    var isStringLiteral = /^(["'])(.*?)\1$/.exec(value);
    if (isStringLiteral) { return isStringLiteral.pop(); }

    return value;
}

/***************** TOKEN **********************************/

function Token(type, contents) {
    this.type = type;
    this.contents = contents;
}

import(Token.prototype, {
    split_contents: function () {
        return string_utils.smart_split(this.contents);
    }
});

/***************** TOKENIZER ******************************/

function tokenize(input) {
    var re = /(?:\{\{|\}\}|\{%|%\})|[\{\}|]|[^\{\}%|]+/g;
    var token_list = [];

    function consume(re, input) {
        var m = re.exec(input);
        return m ? m[0] : null;
    }

    function consume_until() {
        var next, s = '';
        var slice = Array.prototype.slice;
        while (next = consume(re, input)) {
            if (slice.apply(arguments).indexOf(next) > -1) {
                return [s, next];
            }
            s += next;
        }
        return [s];
    }

    function literal() {
        var res = consume_until("{{", "{%");

        if (res[0]) { token_list.push( new Token('text', res[0]) ); }
        
        if (res[1] === "{{") { return variable_tag; }
        if (res[1] === "{%") { return template_tag; }
        return undefined;
    }

    function variable_tag() {
        var res = consume_until("}}");

        if (res[0]) { token_list.push( new Token('variable', res[0].trim()) ); }
        if (res[1]) { return literal; }
        return undefined;
    }

    function template_tag() {
        var res = consume_until("%}"),
            parts = res[0].trim().split(/\s/, 1);

        token_list.push( new Token(parts[0], res[0].trim()) );

        if (res[1]) { return literal; }
        return undefined;
    }

    var state = literal;

    while (state) {
        state = state();
    }

    return token_list;
}

/*********** FilterExpression **************************/

// groups are: 1=variable, 2=constant, 3=filter_name, 4=filter_constant_arg, 5=filter_variable_arg
var filter_re = /("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')|([\w\.]+|[\-+\.]?\d[\d\.e]*)|(?:\|(\w+)(?::(?:("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')|([\w\.]+|[\-+\.]?\d[\d\.e]*)))?)/g;

var FilterExpression = function (expression, constant) {

    filter_re.lastIndex = 0;

    this.filter_list = [];

    var parsed = this.consume(expression);

    //sys.debug(expression + ' => ' + sys.inspect( parsed ) );

    if (!parsed) {
        throw this.error(expression);
    }
    if (constant !== undefined) {
        if (parsed.variable !== undefined || parsed.constant !== undefined) {
            throw this.error(expression + ' - did not expect variable when constant is defined');
        }
        parsed.constant = constant;
    }

    while (parsed) {
        if (parsed.constant !== undefined && parsed.variable !== undefined) {
            throw this.error(expression + ' - did not expect both variable and constant');
        }
        if ((parsed.constant !== undefined || parsed.variable !== undefined) &&
            (this.variable !== undefined || this.constant !== undefined)) {
            throw this.error(expression + ' - did not expect variable or constant at this point');
        }
        if (parsed.constant !== undefined) { this.constant = normalize(parsed.constant); }
        if (parsed.variable !== undefined) { this.variable = normalize(parsed.variable); }

        if (parsed.filter_name) { 
            this.filter_list.push( this.make_filter_token(parsed) );
        }

        parsed = this.consume(expression);

        //sys.debug(expression + ' => ' + sys.inspect( parsed ) );
    }

    //sys.debug(expression + ' => ' + sys.inspect( this ) );

};

import(FilterExpression.prototype, {

    consume: function (expression) {
        var m = filter_re.exec(expression);
        return m ?
            { constant: m[1], variable: m[2], filter_name: m[3], filter_arg: m[4], filter_var_arg: m[5] }
            : null;
    },

    make_filter_token: function (parsed) {
        var token = { name: parsed.filter_name };
        if (parsed.filter_arg !== undefined) { token.arg = normalize(parsed.filter_arg); }
        if (parsed.filter_var_arg !== undefined) { token.var_arg = normalize(parsed.filter_var_arg); }
        return token;
    },

    error: function (s) {
        throw s + "\ncan't parse filterexception at char " + filter_re.lastIndex + ". Make sure there is no spaces between filters or arguments\n";
    },

    resolve: function (context) {
        var value;
        if (this.hasOwnProperty('constant')) {
            value = this.constant;
        } else {
            value = context.get(this.variable);
        }

        var safety = {
            is_safe: false,
            must_escape: context.autoescaping
        };

        var out = this.filter_list.reduce( function (p,c) {

            var filter = context.filters[c.name];

            var arg;
            if (c.arg) {
                arg = c.arg;
            } else if (c.var_arg) {
                arg = context.get(c.var_arg);
            }

            if ( filter && typeof filter === 'function') {
                return filter(p, arg, safety);
            } else {
                // throw 'Cannot find filter';
                sys.debug('Cannot find filter ' + c.name);
                return p;
            }
        }, value);

        if (safety.must_escape && !safety.is_safe) {
            if (typeof out === 'string') {
                return html.escape(out);
            } else if (out instanceof Array) {
                return out.map( function (o) { return typeof o === 'string' ? html.escape(o) : o; } );
            }
        }
        return out;
    }
});

/*********** PARSER **********************************/

function Parser(input) {
    this.token_list = tokenize(input);
    this.indent = 0;
    this.blocks = {};

    var defaults = require('./template_defaults');
    this.tags = defaults.tags;
    this.nodes = defaults.nodes;
}

function parser_error(e) {
    return 'Parsing exception: ' + JSON.stringify(e, 0, 2);
}

function make_nodelist() {
    var node_list = [];
    node_list.evaluate = function (context, callback) {
        iter.reduce(this, function (p, c, idx, list, next) {
            c(context, function (error, result) { next(error, p + result); });
        }, '', callback);
    };
    node_list.only_types = function (/*args*/) {
        var args = Array.prototype.slice.apply(arguments);
        return this.filter( function (x) { return args.indexOf(x.type) > -1; } );
    };
    node_list.append = function (node, type) {
        node.type = type;
        this.push(node);
    };
    return node_list;
}

import(Parser.prototype, {

    parse: function () {
    
        var stoppers = Array.prototype.slice.apply(arguments);
        var node_list = make_nodelist();
        var token = this.token_list[0];
        var tag = null;

        //sys.debug('' + this.indent++ + ':starting parsing with stoppers ' + stoppers.join(', '));

        while (this.token_list.length) {
            if (stoppers.indexOf(this.token_list[0].type) > -1) {
                //sys.debug('' + this.indent-- + ':parse done returning at ' + token[0] + ' (length: ' + node_list.length + ')');
                return node_list;
            }

            token = this.next_token();

            //sys.debug('' + this.indent + ': ' + token);

            tag = this.tags[token.type];
            if (tag && typeof tag === 'function') {
                node_list.append( tag(this, token), token.type );
            } else {
                //throw parser_error('Unknown tag: ' + token[0]);
                node_list.append(
                    this.nodes.TextNode('[[ UNKNOWN ' + token.type + ' ]]'),
                    'UNKNOWN'
                );
            }
        }
        if (stoppers.length) {
            throw new parser_error('Tag not found: ' + stoppers.join(', '));
        }

        //sys.debug('' + this.indent-- + ':parse done returning end (length: ' + node_list.length + ')');

        return node_list;
    },

    next_token: function () {
        return this.token_list.shift();
    },

    delete_first_token: function () {
        this.token_list.shift();
    },

    make_filterexpression: function (expression, constant) {
        return new FilterExpression(expression, constant);
    }

});

/*************** Context *********************************/

function Context(o) {
    this.scope = [ o || {} ];
    this.extends = '';
    this.blocks = {};
    this.autoescaping = true;
    this.filters = require('./template_defaults').filters;
}

import(Context.prototype, {
    get: function (name) {

        if (typeof name !== 'string') { return name; }

        var normalized = normalize(name);
        if (name !== normalized) { return normalized; }

        var parts = name.split('.');
        name = parts.shift();

        var val, level, next;
        for (level = 0; level < this.scope.length; level++) {
            if (this.scope[level].hasOwnProperty(name)) {
                val = this.scope[level][name];
                while (parts.length && val) {
                    next = val[parts.shift()];

                    if (typeof next === 'function') {
                        val = next.apply(val);
                    } else {
                        val = next;
                    }
                }

                if (typeof val === 'function') {
                    return val();
                } else { 
                    return val;
                }
            }
        }

        return '';
    },
    set: function (name, value) {
        this.scope[0][name] = value;
    },
    push: function (o) {
        this.scope.unshift(o || {});
    },
    pop: function () {
        return this.scope.shift();
    },
});


/*********** Template **********************************/

function Template(input) {
    var parser = new Parser(input);
    this.node_list = parser.parse();
}

import(Template.prototype, {
    render: function (o, callback) {

        if (!callback) { throw 'template.render() must be called with a callback'; }

        var context = (o instanceof Context) ? o : new Context(o || {});
        context.extends = '';

        this.node_list.evaluate(context, function (error, rendered) {
            if (error) { return callback(error); }

            if (context.extends) {
                var template_loader = require('./loader');
                template_loader.load_and_render(context.extends, context, callback);
            } else {
                callback(false, rendered);
            }
        });
    }
});

/********************************************************/

exports.parse = function (input) {
    return new Template(input);
};


// exported for test
exports.Context = Context;
exports.FilterExpression = FilterExpression;
exports.tokenize = tokenize;
exports.make_nodelist = make_nodelist;




