/*jslint laxbreak: true, eqeqeq: true, undef: true, regexp: false */
/*global require, process, exports */


/* Function: get_args_from_token
       split token contents, remove the first part (the tagname) and return the
       rest. Optionally a set of rules to verify the arguments against can be
       provided.

    Syntax: get_args_from_token(token [,options])

    Arguments:
        token - the token
        options - optional, see options

    Options:
        argcount - number, verify that there is exactly this number of arguments
        exclude - mixed, a number or an array of numbers specifying arguments that should
                  be excluded from the returned list
        mustbe - object, an object with numbers as keys and strings or arrays of strings as
                 values. Arguments specified (by their number) in this object must match one
                 of the values, if they are provided in the token.
    
    Example:
        // token contains "with 100 as hest"
        list = get_args_from_token(token, { exclude: 2 }); // list is [100, "hest"]
        list = get_args_from_token(token, { mustbe: { 2: "is" } }); // throws an error because "as" != "is"
        list = get_args_from_token(token, { argcount: 4 }); // throws an error because there is not 4 arguments
*/
exports.get_args_from_token = function get_args_from_token(token, options) {

    options = options || {};

    var parts = token.split_contents();

    if (options.argcount !== undefined && parts.length !== options.argcount + 1) {
        throw 'unexpected syntax in "' + token.type + '" tag: Wrong number of arguments';
    }

    var i;
    for (i = 1; i < parts.length; i++) {
        if (options.mustbe && options.mustbe[i]) {
            var expected = options.mustbe[i];
            if (expected instanceof Array) {
                if (expected.indexOf(parts[i]) === -1) {
                    throw 'unexpected syntax in "' + token.type + '" tag: Expected one of "' + expected.join('", "') + '"';
                }
            } else if (expected != parts[i]) {
                throw 'unexpected syntax in "' + token.type + '" tag: Expected "' + options.mustbe[i] + '"';
            }
        }
    }

    if (options.exclude) {
        if (!(options.exclude instanceof Array)) { options.exclude = [options.exclude] }
        var include = [];
        for (i = 1; i < parts.length; i++) {
            if (options.exclude.indexOf(i) === -1) { include.push(i); }
        }
        parts = include.map(function (x) { return parts[x]; });
    } else {
        parts = parts.slice(1);
    }

    return parts;
}


/* Function: simple_tag
       Creates a parsefunction for a simple tag. That is a tag that takes a
       number of arguments -- strings or a template variables -- and return a
       string after doing some processing based solely on the input argument
       and some external information.

    Syntax: simple_tag(node[, options]);

    Arguments:
        node - a function that returns a nodefunction when called with the tag arguments
        options - optional, passed on to get_args_from_token()

    Returns:
        a parsefunction
*/
exports.simple_tag = function simple_tag(node, options) {
    return function (parser, token) {
        var parts = get_args_from_token(token, options);
        return node.apply(null, parts);
    };
}

