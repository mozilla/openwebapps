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
 * The Original Code is trusted.js; substantial portions derived
 * from XAuth code originally produced by Meebo, Inc., and provided
 * under the Apache License, Version 2.0; see http://github.com/xauth/xauth
 *
 * Contributor(s):
 *     Michael Hanson <mhanson@mozilla.com>
 *     Dan Walkowski <dwalkowski@mozilla.com>
 *     Anant Narayanan <anant@kix.in>
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

/*
* The server stores installed application metadata in local storage.
*
* The key for each application is the launch URL of the application;
* installation of a second app with the same launch URL will cause
* the first to be overwritten.
*
* The value of each entry is a serialized structure like this:
* {
*     manifest: { <app manifest> },
*     install_time: <install timestamp, UTC milliseconds>,
*     install_origin: <the URL that invoked the install function>
*     origin: <the origin of the app>
* }
*
*/
Repo = (function() {
    // A TypedStorage singleton global object is expected to be present
    // Must be provided either by the FF extension, Chrome extension, or in
    // the HTML5 case, localStorage.
    var appStorage = TypedStorage().open("app");
    var stateStorage = TypedStorage().open("state");

    // iterates over all stored applications manifests and passes them to a
    // callback function.    This function should be used instead of manual
    // iteration as it will parse manifests and purge any that are invalid.
    function iterateApps(callback)
    {
        // we'll automatically clean up malformed installation records as we go
        var toRemove = [];
        
        appStorage.keys(function(appKeys) {
            if (appKeys.length === 0) {
                // signifies end of iteration, callback will not be called again
                callback(null, null);
                return;
            }

            // manually iterating the apps (rather than using appStorage.iterate() allows
            // us to differentiate between a corrupt application (for purging), and
            // an error inside the caller provided callback function
            for (var i = 0; i < appKeys.length; i++) {
                var aKey = appKeys[i];
                try {
                    appStorage.get(aKey, function(install) {
                        install.manifest = Manifest.validate(install.manifest);
                        try {
                            callback(aKey, install);
                        } catch (e) {
                            console.log("Error inside iterateApps callback: " + e);
                        }
                    });
                } catch (e) {
                    console.log("invalid application detected: " + e);
                    toRemove.push(aKey);
                }
            }

            for (var j = 0; j < toRemove.length; j++) {
                appStorage.remove(toRemove[j], function() {
                    // nothing to check
                });
            }
            
            // signifies end of iteration, callback will not be called again
            callback(null, null);
        });
    };

    // Returns whether the given URL belongs to the specified domain (scheme://hostname[:nonStandardPort])
    function urlMatchesDomain(url, domain)
    {
        try {
            // special case for local testing
            if (url === "null" && domain === "null") return true;
            var parsedDomain = URLParse(domain).normalize();
            var parsedURL = URLParse(url).normalize();
            return parsedDomain.contains(parsedURL);
        } catch (e) {
            return false;
        }
    }

    // Returns whether this application runs in the specified domain (scheme://hostname[:nonStandardPort])
    function applicationMatchesDomain(testURL, domain)
    {
        if (urlMatchesDomain(testURL, domain)) return true;
        return false;
    }

    // Return all installations that were installed by the given origin
    function getInstallsByOrigin(origin, cb)
    {
        var result = [];

        iterateApps(function(key, item) {
            if (key != null && item != null) {
                if (urlMatchesDomain(item.install_origin, origin)) {
                    result.push(item);
                }
            } else {
                if (cb && typeof cb == 'function')
                    cb(result);
            }
        });
    }

    function mayInstall(installOrigin, appOrigin, manifestToInstall)
    {
        // apps may always trigger install from their own domain
        if (installOrigin === appOrigin) return true;
        
        // chrome code can always do it:
        if (installOrigin == "chrome://openwebapps") return true;

        // otherwise, when installOrigin != appOrigin, we must check the
        // installs_allowed_from member of the manifest
        if (manifestToInstall && manifestToInstall.installs_allowed_from) {
            var iaf = manifestToInstall.installs_allowed_from;
            for (var i = 0; i < iaf.length; i++) {
                if (iaf[i] === '*' || urlMatchesDomain(installOrigin, iaf[i])) {
                    return true;
                }
            }
        }

        return false;
    }

    // given an origin, normalize it (like, http://foo:80 --> http://foo), or
    // https://bar:443 --> https://bar, or even http://baz/ --> http://baz)
    function normalizeOrigin(origin) {
        var url = URLParse(origin).normalize();
        url.path = url.query = url.anchor = undefined;
        return url.toString();
    }


    // trigger application installation.
    //     origin -- the URL of the site requesting installation
    //     args -- the argument object provided by the calling site upon invocation of
    //             navigator.apps.install()
    //     promptDisplayFunc -- is a callback function that will be invoked to display a
    //             user prompt.    the function should accept 4 arguments which are:
    //             installOrigin --
    //             appOrigin --
    //             manifestToInstall --
    //             installationConfirmationFinishCallback --
    //             arguments object
    //     fetchManifestFunc -- a function that can can fetch a manifest from a remote url, accepts
    //             two args, a manifesturl and a callback function that will be invoked with the
    //             manifest JSON text or null in case of error.
    //     cb -- is a caller provided callback that will be invoked when the installation
    //         attempt is complete.

    function install(origin, args, promptDisplayFunc, fetchManifestFunc, cb) {
        origin = normalizeOrigin(origin);

        function installConfirmationFinish(allowed)
        {
            if (allowed) {
                // Create installation data structure
                var installation = {
                    manifest: manifestToInstall,
                    origin: appOrigin,
                    install_time: new Date().getTime(),
                    install_origin: installOrigin
                };

                if (args.install_data) {
                    installation.install_data = args.install_data;
                }

                // Save - blow away any existing value
                appStorage.put(appOrigin, installation, cb);
            } else {
                if (cb) cb({error: ["denied", "User denied installation request"]});
            }
        }

        var manifestToInstall;
        var installOrigin = origin;
        var appOrigin = undefined;

        if (!args || !args.url || typeof(args.url) !== 'string') {
            throw "install missing required url argument";
        }

        if (args.url) {
            // support absolute paths as a developer convenience
            if (0 == args.url.indexOf('/')) {
                args.url = origin + args.url;
            }

            // extract the application origin from the manifest URL
            try {
                appOrigin = normalizeOrigin(args.url);
            } catch(e) {
                cb({error: ["manifestURLError", e.toString()]});
                return;
            }

            // contact our server to retrieve the URL
            fetchManifestFunc(args.url, function(fetchedManifest, contentType) {
                if (!fetchedManifest) {
                    cb({error: ["networkError", "couldn't retrieve application manifest from network"]});
                } else if (!contentType || contentType.indexOf("application/x-web-app-manifest+json") != 0) {
                    cb({error: ["invalidManifest", "application manifests must be of Content-Type \"application/x-web-app-manifest+json\""]});
                } else {
                    try {
                        fetchedManifest = JSON.parse(fetchedManifest);
                    } catch(e) {
                        cb({error: ["manifestParseError", "couldn't parse manifest JSON from " + args.url]});
                        return;
                    }
                    try {
                        manifestToInstall = Manifest.validate(fetchedManifest);

                        if (!mayInstall(installOrigin, appOrigin, manifestToInstall)) {
                            cb({error: ["permissionDenied", "origin '" + installOrigin + "' may not install this app"]});
                            return;
                        }

                        // if an app with the same origin is currently installed, this is an update
                        appStorage.has(appOrigin, function(isUpdate) {
                            promptDisplayFunc(
                                installOrigin, appOrigin, manifestToInstall,
                                isUpdate, installConfirmationFinish
                            );
                        });
                    } catch(e) {
                        cb({error: ["invalidManifest", "couldn't validate your manifest: " + e ]});
                    }
                }
            });
        } else {
            // neither a manifest nor a URL means we cannot proceed.
            cb({error: [ "missingManifest", "install requires a url argument" ]});
        }
    };

    /** Determines if an application is installed for the calling site */
    function amInstalled(origin, cb) {
        var done = false;
        origin = normalizeOrigin(origin);
        
        if (typeof cb != 'function')
            return;
            
        iterateApps(function(key, item) {
            if (!done && item) {
                if (applicationMatchesDomain(item.origin, origin)) {
                    done = true;
                    cb(item);
                }
            }
            if (item == null && key == null && !done) {
                cb(null);
            }
        });
    };

    /** Determines which applications were installed by the origin domain. */
    function getInstalledBy(origin, cb) {
        getInstallsByOrigin(normalizeOrigin(origin), cb);
    };

    /* Management APIs for dashboards live beneath here */

    // A function which given an installation record, builds an object suitable
    // to return to a dashboard.    this function may filter information which is
    // not relevant, and also serves as a place where we can rewrite the internal
    // JSON representation into what the client expects (allowing us to change
    // the internal representation as neccesary)
    function generateExternalView(key, item) {
        return item;
    }

    function list(cb) {
        var installed = {};
        iterateApps(function(key, item) {
            if (key != null && item != null) {
                installed[key] = item;
            } else if (cb && typeof(cb) == 'function') {
                cb(installed);
            }
        });
    };

    function uninstall(origin, cb) {
        origin = normalizeOrigin(origin);
        appStorage.get(origin, function(item) {
            if (!item) {
                cb({error: [ "noSuchApplication", "no application exists with the origin: " + origin ]});
            } else {
                appStorage.remove(origin, function() {
                    if (cb && typeof(cb) == "function")
                        cb(true);
                });
            }
        });
    };

    function loadState(id, cb) {
        stateStorage.get(JSON.stringify(id), cb);
    };

    function saveState(id, state, cb) {
        // storing undefined purges state
        if (state === undefined) {
            stateStorage.remove(JSON.stringify(id), cb);
        } else {
            stateStorage.put(JSON.stringify(id), state, cb);
        }
    };

    return {
        list: list,
        install: install,
        uninstall: uninstall,
        amInstalled: amInstalled,
        getInstalledBy: getInstalledBy,
        loadState: loadState,
        saveState: saveState
    };
})();
