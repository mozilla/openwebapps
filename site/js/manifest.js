/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is manifest.js; substantial portions derived
 * from XAuth code originally produced by Meebo, Inc., and provided
 * under the Apache License, Version 2.0; see http://github.com/xauth/xauth
 *
 * Contributor(s):
 *   Michael Hanson <mhanson@mozilla.com>
 *   Lloyd Hilaiel <lloyd@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/**
  2010-07-14
  First version of server code
  -Michael Hanson. Mozilla

  2010-08-27
  Manifest validation code broken out into a separate file.

  2010-12-04
  Manifest validation re-written for updated specification
**/

;var Manifest = (function() {

    // initialize a manifest object from a javascript manifest representation,
    // validating as we go.
    // throws a developer readable string upon discovery of an invalid manifest.
    function parse(manf) {
        var errorThrow = function(msg, path) {
            if (path != undefined && typeof path != 'object') path = [ path ];
            throw {
                msg: msg,
                path: (path ? path : [ ]),
                toString: function () {
                    if (this.path && this.path.length > 0) return ("(" + this.path.join("/") + ") " + this.msg); 
                    return this.msg;
                }
            };
        };

        // Validate and clean the request
        if(!manf) {
            errorThrow('null');
        }

        // commonly used check functions
        var nonEmptyStringCheck = function(x) {
            if ((typeof x !== 'string') || x.length === 0) errorThrow();
        };

        // a table that specifies manfiest properties, and validation functions
        // each key is the name of a valid top level property.
        // each value is an object with four optional properties:
        //  required: if present and has a truey value, then the prop is required
        //  check: if present and a function for a value, then is passed a value present in manifest for validation
        //  normalize: if present and has a function for a value, then accepts current value
        //             in manifest as argument, and outputs a value to replace it.
        //  may_overlay: if present and hase a truey value, then this property may be overlaid by
        //               content in the locales map. 
        //
        // returning errors:
        //   validation functions throw objects with two fields:
        //     msg: an english, developer readable error message
        //     path: an array of properties that describes which field has the error
        //
        var manfProps = {
            base_url: {
                required: true,
                check: function (x) {
                    if (typeof x !== 'string') errorThrow();
                    try {
                        // will throw if the url is invalid
                        var p = URLParse(x).validate().normalize().path;
                        // urls must end with a slash
                        if (!p.length || p[p.length - 1] != '/') throw "trailing slash required";
                    } catch(e) {
                        errorThrow(e);
                    }
                },
                normalize: function(x) {
                    return URLParse(x).normalize().toString();
                }
            },
            capabilities: {
                check: function(x) {
                    if (!x || typeof x !== 'object' || x.constructor !== Array) errorThrow();
                    for (var i = 0; i < x.length; i++) {
                        if (typeof x[i] !== 'string') errorThrow(undefined, [i]);
                    }
                }
            },
            default_locale: {
                required: true,
                check: nonEmptyStringCheck
            },
            description: {
                may_overlay: true,
                check: nonEmptyStringCheck
            },
            developer: {
                may_overlay: true,
                check: function(x) {
                    if (typeof x !== 'object') errorThrow();
                    for (var k in x) {
                        if (!x.hasOwnProperty(k)) continue;
                        if (!(k in { name:null, url:null})) errorThrow('under developer, only "name" and "url" properties are allowed', k);
                        if (typeof x[k] !== 'string') errorThrow(undefined, k);
                    }
                }
            },
            icons: {
                may_overlay: true,
                check: function (x) {
                    if (typeof x !== 'object') errorThrow();
                    for (var k in x) {
                        if (!x.hasOwnProperty(k)) continue;
                        if (!(k in { 16:null, 48:null, 128:null })) errorThrow('invalid key, expected 16, 48, or 128', k);
                        if (typeof x[k] !== 'string') errorThrow(undefined, k);
                        if (x[k].indexOf('..') != -1) errorThrow(undefined, k);
                    }
                }
            },
            installs_allowed_from: {
                check: function(x) {
                    if (!x || typeof x !== 'object' || x.constructor !== Array) errorThrow("expected array of urls");
                    for (var i = 0; i < x.length; i++) {
                        var path;
                        try {
                            path = URLParse(x[i]).validate().path;
                        } catch (e) {
                            errorThrow(e, i)
                        }
                        // XXX: should this be a warning?  (in other news, should we invent a way to
                        // convey warnings to client code?)
                        if (path && path.length > 1) {
                            errorThrow("path on url is meaningless here", i);
                        }
                    }
                },
                normalize: function(o) {
                    var n = [];
                    for (var i = 0; i < o.length; i++) {
                        n.push(URLParse(o[i]).normalize().toString());
                    }
                    return n;
                }
            },
            launch_path: {
                may_overlay: true,
                check: function (x) {
                    if (typeof x !== 'string' || x.indexOf("..") !== -1) errorThrow();
                },
                normalize: function(x) {
                    // XXX: can/should we do better normalization than this??
                    return ((x.length > 0) ? x : undefined);
                }
            },
            locales: {
                check: function (l) {
                    // XXX: we really need a robust parser for language tags
                    // to do this correctly:
                    // http://www.rfc-editor.org/rfc/bcp/bcp47.txt
                    if (typeof l !== 'object') errorThrow();
                    for (var tag in l) {
                        if (!l.hasOwnProperty(tag)) continue;
                        // XXX: parse and validate language tag (for real)
                        if (typeof tag !== 'string' || tag.length == 0) errorThrow();
                        if (typeof l[tag] !== 'object') errorThrow();

                        // now l[tag] is a locale specific overlay, which is basically
                        // a manifest in its own right.  We'll go validate that.  By passing
                        // true as the second arg ot validateManifestProperties we restrict
                        // allowed manifest fields to only those which may be overlaid. 
                        try {
                            validateManifestProperties(l[tag], true);
                        } catch (e) {
                            e.path.unshift(tag);
                            throw e;
                        }
                    }
                }
            },
            manifest_name: {
                check: function (x) {
                    if (typeof x === 'string') {
                        // See RFC 3986 'segment' production for discussion of allowed chars in manfest_name
                        if (x.length === 0) errorThrow("blank value not allowed");
                        else if (!/^[A-Za-z0-9\-\._~!\$&\'\(\)\*\+\,\;\=\:\@\%]+$/.test(x))
                            errorThrow("invalid characters present");
                    } else {
                        // non-strings not allowed
                        errorThrow();
                    }
                }
            },
            manifest_version: {
                required: true,
                check: function (x) {
                    if (!((typeof x === 'string') && /^\d+.\d+$/.test(x))) errorThrow();
                }
            },
            name: {
                may_overlay: true,
                required: true,
                check: nonEmptyStringCheck
            }
        };

        // a function to extract nested values given an object and array of property names
        function extractValue(obj, props) {
            return ((props.length === 0) ? obj : extractValue(obj[props[0]], props.slice(1)));
        }

        // a function that will validate properties of a manfiest using the
        // manfProps data structure above.
        // returns a normalized version of the manifest, throws upon
        // detection of invalid properties
        function validateManifestProperties(manf, onlyOverlaidFields) {
            var normalizedManf = {};
            for (var prop in manf) {
                if (!manf.hasOwnProperty(prop)) continue;
                if (!(prop in manfProps)) errorThrow('unsupported property', prop);
                var pSpec = manfProps[prop];
                if (onlyOverlaidFields && !pSpec.may_overlay) {
                    errorThrow('may not be overridded per-locale', prop);
                }
                if (typeof pSpec.check === 'function') {
                    try {
                        pSpec.check(manf[prop]);
                    } catch (e) {
                        e.path.unshift(prop);
                        if (!e.msg) e.msg = 'invalid value: ' + extractValue(manf, e.path);
                        console.log(e);
                        throw e;
                    }
                }
                if (typeof pSpec.normalize === 'function') {
                    normalizedManf[prop] = pSpec.normalize(manf[prop]);
                    // special case.  a normalization function can remove properties by
                    // returning undefined.
                    if (normalizedManf[prop] === undefined) delete normalizedManf[prop];
                } else {
                    normalizedManf[prop] = manf[prop];
                }
            }
            return normalizedManf;
        }

        // iterate through required properties, and verify they're present
        for (var prop in manfProps) {
            if (!manfProps.hasOwnProperty(prop) || !manfProps[prop].required) continue;
            if (!(prop in manf)) {
                errorThrow('missing "' + prop + '" property');
            }
        }

        return validateManifestProperties(manf, false);
    }

    return {
        parse: parse
    }
})();
