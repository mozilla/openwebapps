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
**/


;var Manifest = (function() {

    // initialize a manifest object from a javascript manifest representation,
    // validating as we go.
    // throws a developer readable string upon discovery of an invalid manifest.
    function parse(manf) {
        var errorThrow = function(errstr) {
            throw('Invalid manifest: ' + errstr);
        }

        // Validate and clean the request
        if(!manf) {
            errorThrow('null');
        }

        // a table that specifies manfiest properties, and validation functions
        var manfProps = {
            manifest_version: {
                required: true,
                check: function (x) {
                    return ((typeof x === 'string') && /^\d+.\d+$/.test(x));
                }
            },
            name: {
                required: true,
                check: function (x) {
                    // XXX: shall we constrain the allowable chars in a manifest name?
                    return ((typeof x === 'string') && x.length > 0);
                }
            },
            base_url: {
                required: true,
                check: function (x) {
                    if (typeof x !== 'string') return false;
                    try {
                        // will throw if the url is invalid
                        var p = URLParse(x).validate().normalize().path;
                        // urls must end with a slash
                        if (!p.length || p[p.length - 1] != '/') return false;
                    } catch(e) {
                        return false
                    }
                    return true;
                },
                normalize: function(x) {
                    return URLParse(x).normalize().toString();
                }
            },
            default_locale: {
                required: true
            }
        };

        // iterate through required properties, and verify they're present
        for (var prop in manfProps) {
            if (!manfProps.hasOwnProperty(prop) || !manfProps[prop].required) continue;
            if (!(prop in manf)) {
                errorThrow('missing "' + prop + '" property');
            }
        }

        var normalizedManf = {};

        // now verify that each included property is valid
        for (var prop in manf) {
            if (!(prop in manfProps)) errorThrow('unsupported property: ' + prop);
            var pSpec = manfProps[prop];
            if (typeof pSpec.check === 'function' && !(pSpec.check(manf[prop]))) {
                errorThrow('invalid value for "' + prop + '": ' + manf[prop]);
            }
            if (typeof pSpec.normalize === 'function') {
                normalizedManf[prop] = pSpec.normalize(manf[prop]);
            } else {
                normalizedManf[prop] = manf[prop];
            }
        }

        return normalizedManf;
    }

    return {
        parse: parse
    }
})();
