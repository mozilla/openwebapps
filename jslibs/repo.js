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
 *   Michael Hanson <mhanson@mozilla.com>
 *   Dan Walkowski <dwalkowski@mozilla.com>
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
**/

/*
* The server stores installed application metadata in local storage.
*
* The key for each application is the launch URL of the application;
* installation of a second app with the same launch URL will cause
* the first to be overwritten.
*
* The value of each entry is a serialized structure like this:
* {
*   manifest: { <app manifest> },
*   install_time: <install timestamp, UTC milliseconds>,
*   install_url: <the URL that invoked the install function>
*   origin: <the origin of the app>
* }
*
*/

;Repo = (function() {
    var appStorage = TypedStorage().open("app");
    var stateStorage = TypedStorage().open("state");

    // iterates over all stored applications manifests and passes them to a
    // callback function.  This function should be used instead of manual
    // iteration as it will parse manifests and purge any that are invalid.
    function iterateApps(callback) {
        // we'll automatically clean up malformed installation records as we go
        var toRemove = [];

        var appKeys = appStorage.keys();
        if (appKeys.length === 0) {
          return;
        }

        // manually iterating the apps (rather than using appStorage.iterate() allows
        // us to differentiate between a corrupt application (for purging), and
        // an error inside the caller provided callback function
        for (var i=0; i<appKeys.length; i++)
        {
            var aKey = appKeys[i];

            try {
                var install = appStorage.get(aKey);
                install.manifest = Manifest.validate(install.manifest);
                try {
                  callback(aKey, install);
                } catch (e) {
                  console.log("Error inside iterateApps callback: " + e);
                }
            } catch (e) {
                console.log("invalid application detected: " + e);
                toRemove.push(aKey);
            }
        }

        for (var j = 0; j < toRemove.length; j++) {
            appStorage.remove(toRemove[i]);
        }
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

    // Return all installations that belong to the given origin domain
    function getInstallsForOrigin(origin)
    {
        var result = [];

        iterateApps(function(key, item) {
            if (applicationMatchesDomain(item.origin, origin)) {
                result.push(item);
            }
        });

        return result;
    }

    // Return all installations that were installed by the given origin domain
    function getInstallsByOrigin(origin)
    {
        var result = [];

        iterateApps(function(key, item) {
            if (urlMatchesDomain(item.install_url, origin)) {
                result.push(item);
            }
        });

        return result;
    }

    function mayInstall(installOrigin, manifestToInstall)
    {
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

    // trigger application installation.
    //   origin -- the URL of the site requesting installation
    //   args -- the argument object provided by the calling site upon invocation of
    //           navigator.apps.install()
    //   promptDisplayFunc -- is a callback function that will be invoked to display a
    //           user prompt.  the function should accept 4 arguments which are:
    //             installOrigin --
    //             manifestToInstall --
    //             installationConfirmationFinishCallback --
    //             arguments object
    //   fetchManifestFunc -- a function that can can fetch a manifest from a remote url, accepts
    //             two args, a manifesturl and a callback function that will be invoked with the
    //             manifest JSON text or null in case of error.
    //   cb -- is a caller provided callback that will be invoked when the installation
    //         attempt is complete.

    function install(origin, args, promptDisplayFunc, fetchManifestFunc, cb) {

        function installConfirmationFinish(allowed)
        {
            if (allowed) {
                var key = origin;
                if (manifestToInstall.launch_path) key += manifestToInstall.launch_path;

                // Create installation data structure
                var installation = {
                    manifest: manifestToInstall,
                    origin: appOrigin,
                    install_time: new Date().getTime(),
                    install_url: installOrigin
                };

                if (args.install_data) {
                    installation.install_data = args.install_data;
                }

                // Save - blow away any existing value
                appStorage.put(key, installation);

                if (cb) cb(true);
            } else {
                if (cb) cb({error: ["denied", "User denied installation request"]});
            }
        }

        var manifestToInstall;
        var installOrigin = origin;
        var appOrigin = undefined;

        if (args.url) {
            // extract the application origin from the manifest URL
            try {
              var u = URLParse(args.url);
              u.path = u.query = u.anchor = undefined;
              appOrigin = u.toString();
            } catch(e) {
              cb({error: ["manifestURLError", e.toString()]});
              return;
            }

            // contact our server to retrieve the URL
            fetchManifestFunc(args.url, function(fetchedManifest) {
                if (!fetchedManifest) {
                    cb({error: ["networkError", "couldn't retrieve application manifest from network"]});
                } else {
                    try {
                        fetchedManifest = JSON.parse(fetchedManifest);
                    } catch(e) {
                        cb({error: ["manifestParseError", "couldn't parse manifest JSON from " + args.url]});
                        return;
                    }
                    try {
                        manifestToInstall = Manifest.validate(fetchedManifest);

                        if (!mayInstall(installOrigin, manifestToInstall)) {
                            cb({error: ["permissionDenied", "origin '" + installOrigin + "' may not install this app"]});
                            return;
                        }

                        // if an app with the same origin is currently installed, this is an update
                        var isUpdate = appStorage.has(installOrigin);

                        promptDisplayFunc(installOrigin, manifestToInstall, isUpdate,
                                          installConfirmationFinish);
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

    /** Determines which applications are installed for the origin domain */
    function getInstalled(origin) {
        return getInstallsForOrigin(origin);
    };

    /** Determines which applications were installed by the origin domain. */
    function getInstalledBy(origin) {
        return getInstallsByOrigin(origin);
    };

    /* Management APIs for dashboards live beneath here */

    // A function which given an installation record, builds an object suitable
    // to return to a dashboard.  this function may filter information which is
    // not relevant, and also serves as a place where we can rewrite the internal
    // JSON representation into what the client expects (allowing us to change
    // the internal representation as neccesary)
    function generateExternalView(key, item) {
        return item;
    }

    function list() {
        var installed = {};
        iterateApps(function(key, item) {
            installed[key] = item;
        });
        return installed;
    };

    function remove(key) {
        var item = appStorage.get(key);
        if (!item) throw {error: [ "noSuchApplication", "no application exists with the id: " + key]};
        appStorage.remove(key);
        return true;
    };

    function loadState(id) {
        return stateStorage.get(id);
    };

    function saveState(id, state) {
        // storing null purges state
        if (state === undefined) {
            stateStorage.remove(id);
        } else  {
            stateStorage.put(id, state);
        }
        return true;
    };

    return {
        list: list,
        install: install,
        remove: remove,
        getInstalled: getInstalled,
        getInstalledBy: getInstalledBy,
        loadState: loadState,
        saveState: saveState
    }
})();
