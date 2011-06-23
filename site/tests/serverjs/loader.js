/*jslint eqeqeq: true, undef: true, regexp: false */
/*global require, process, exports, escape */

var sys = require('sys');
var fs = require('fs');
var template_system = require('./template');

var cache = {};
var template_path = '/tmp';


// TODO: get_template
    // should support subdirectories

var load = exports.load = function (name, callback) {
    if (!callback) { throw 'loader.load() must be called with a callback'; }

    if (cache[name] != undefined) {
        callback(false, cache[name]);
    } else {
        fs.readFile(template_path + '/' + name, function (error, s) {
            if (error) { callback(error); }
            cache[name] = template_system.parse(s);
            callback(false, cache[name]);
        });
    }
};

exports.load_and_render = function (name, context, callback) {
    load(name, function (error, template) {
        if (error) {
            callback(error);
        } else {
            template.render(context, callback);
        }
    });
};

exports.flush = function () {
    cache = {};
};

exports.set_path = function (path) {
    template_path = path;
};

