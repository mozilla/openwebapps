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
*   app: { <application metadata> },
*   installTime: <install timestamp, UTC milliseconds>,
*   installURL: <the URL that invoked the install function>
* }
*
*/

;ClientBridge = (function() {
    var chan = Channel.build({
        window: window.parent,
        origin: "*",
        scope: "openwebapps"
    });

    // Reference shortcut so minifier can save on characters
    var win = window;

    // when we recieve an install message we'll cache the origin
    // so we can instruct the client on how to handle visibility
    var installOrigin;

    // We're the top window, don't do anything
    if(win.top == win) return;

    // unsupported browser
    if(!win.postMessage || !win.localStorage || !win.JSON) return;

    var appStorage = TypedStorage("app").open();
    var stateStorage = TypedStorage("state").open();

    // iterates over all stored applications manifests and passes them to a
    // callback function.  This function should be used instead of manual
    // iteration as it will parse manifests and purge any that are invalid.
    function iterateApps(callback) {
        // we'll automatically clean up malformed installation records as we go
        var toRemove = [];

        var appKeys = appStorage.keys();
        if (appKeys.length == 0) return;

        for (var i=0; i<appKeys.length; i++)
        {
            var aKey = appKeys[i];

            try {
                var install = appStorage.get(aKey);
                install.app = Manifest.validate(install.app);
                callback(aKey, install);
            } catch (e) {
                logError("invalid application detected: " + e);
                toRemove.push(aKey);
            }
        }

        for (var j = 0; j < toRemove.length; j++) {
            appStorage.remove(toRemove[i]);
        }
    }

    // Returns whether the given URL belongs to the specified domain (scheme://hostname[:nonStandardPort])
    function urlMatchesDomain(url, domain)
    {
        try {
            var parsedDomain = Manifest.parseUri(domain);
            var parsedURL = Manifest.parseUri(url);

            if (parsedDomain.protocol.toLowerCase() == parsedURL.protocol.toLowerCase() &&
                parsedDomain.host.toLowerCase() == parsedURL.host.toLowerCase())
            {
                var inputPort = parsedDomain.port ? parsedDomain.port : (parsedDomain.protocol.toLowerCase() == "https" ? 443 : 80);
                var testPort = parsedURL.port ? parsedURL.port : (parsedURL.protocol.toLowerCase() == "https" ? 443 : 80);
                if (inputPort == testPort) return true;
            }
        } catch (e) {
        }
        return false;
    }

    // Returns whether this application runs in the specified domain (scheme://hostname[:nonStandardPort])
    function applicationMatchesDomain(application, domain)
    {
        for (var i=0;i<application.app_urls.length;i++)
        {
            var testURL = application.app_urls[i];
            if (urlMatchesDomain(testURL, domain)) return true;
        }
        return false;
    }

    // Return all installations that belong to the given origin domain
    function getInstallsForOrigin(origin, reqObj)
    {
        var result = [];

        iterateApps(function(key, item) {
            if (applicationMatchesDomain(item.app, origin)) {
                result.push(item);
            }
        });

        return result;
    }

    // Return all installations that were installed by the given origin domain 
    function getInstallsByOrigin(origin, requestObj)
    {
        var result = [];

        iterateApps(function(key, item) {
            if (urlMatchesDomain(item.installURL, origin)) {
                result.push(item);
            }
        });

        return result;
    }

    chan.bind("install", function(t, args) {
        // indicate that response will occur asynchronously, later.
        t.delayReturn(true);

        // Validate and clean the request
        var manf;
        try {
            manf = Manifest.validate(args.manifest);
        } catch(e) {
            throw [ "invalidManifest", "couldn't validate your mainfest: " + e ];
        }

        // cache the installOrigin
        installOrigin = t.origin;

        // cause the UI to display a prompt to the user
        displayInstallPrompt(t.origin, manf, function (allowed) {
            if (allowed) {
                var key = manf.base_url + manf.launch_path;

                // Create installation data structure
                var installation = {
                    app: manf,
                    installTime: new Date().getTime(),
                    installURL: t.origin
                };

                if (args.authorization_url) {
                    installation.authorizationURL = args.authorization_url;
                }

                // Save - blow away any existing value
                appStorage.put(key, installation);

                // Send Response Object
                t.complete(true);
            } else {
                t.error("denied", "User denied installation request");
            }
        });
    });

    chan.bind('verify', function(t, args) {
        // We will look for manifests whose app_urls filter matches the origin.
        // If we find one, we will initiate verification of the user
        // by contacting the authorizationURL defined in the installation record.

        // If we find two... well, for now, we take the first one.
        // Perhaps we should find the first one that has an authorization URL.

        var result = getInstallsForOrigin(t.origin, args);
        if (result.length == 0) return null;
        var install = result[0];

        // Must have authorizationURL
        if (!install.authorizationURL)
        {
            throw ['invalidArguments', 'missing authorization url' ];
        }

        // TODO Could optionally have a returnto
        win.parent.location = install.authorizationURL;

        // return value isn't meaningful.  as a result of overwriting
        // the parent location, we'll be torn down.
        return;
    });

    /** Determines which applications are installed for the origin domain */
    chan.bind('getInstalled', function(t, args) {
        var installsResult = getInstallsForOrigin(t.origin, args);

        // Caller doesn't get to see installs, just apps:
        var result = [];
        for (var i=0;i<installsResult.length;i++)
        {
            result.push(installsResult[i].app);
        }

        return result;
    });

    /** Determines which applications were installed by the origin domain. */
    chan.bind('getInstalledBy', function(t, args) {
        var installsResult = getInstallsByOrigin(t.origin, args);

        // Caller gets to see installURL, installTime, and manifest
        var result = [];
        for (var i=0;i<installsResult.length;i++)
        {
            result.push({
                installURL: installsResult[i].installURL,
                installTime: installsResult[i].installTime,
                manifest: installsResult[i].app,
            });
        }

        return result;
    });


    /* a function to check that an invoking page has "management" permission
     * all this means today is that the invoking page (dashboard) is served
     * from the same domain as the application repository. */
    function verifyMgmtPermission(origin) {
        var loc = win.location;
        // make an exception for local testing, who via postmessage events
        // have an origin of "null"
        if ((origin === 'null' && window.location.protocol === 'file:') ||
            ((loc.protocol + "//" + loc.host) === origin))
        {
            return;
        }
        throw [ 'permissionDenied',
                "to access open web apps management apis, you must be on the same domain " +
                "as the application repostiory" ];
    }

    /* Management APIs for dashboards live beneath here */ 

    // A function which given an installation record, builds an object suitable
    // to return to a dashboard.  this function may filter information which is
    // not relevant, and also serves as a place where we can rewrite the internal
    // JSON representation into what the client expects (allowing us to change
    // the internal representation as neccesary)
    function generateExternalView(key, item) {
        // XXX: perhaps localization should happen here?  be sent as an argument
        // to the list function?

        return {
            id: key,
            installURL: item.installURL,
            installTime: item.installTime,
            icons: item.app.icons,
            name: item.app.name,
            description: item.app.description,
            launchURL: item.app.base_url + item.app.launch_path,
            developer: item.app.developer
        };
    }

    chan.bind('list', function(t, args) {
        verifyMgmtPermission(t.origin);

        var installed = [];

        iterateApps(function(key, item) {
            installed.push(generateExternalView(key, item));
        });

        return installed;
    });

    chan.bind('remove', function(t, key) {
        verifyMgmtPermission(t.origin);
        var item = appStorage.get(key);
        if (!item) throw [ "noSuchApplication", "no application exists with the id: " + key ]; 
        appStorage.remove(key);
        return true;
    });

    chan.bind('loadState', function(t, did) {
        verifyMgmtPermission(t.origin);
        return stateStorage.get(did);
    });

    chan.bind('saveState', function(t, args) {
        verifyMgmtPermission(t.origin);
        // storing null purges state
        if (args.state === null) {
            stateStorage.remove(args.did);
        } else  {
            stateStorage.put(args.did, args.state);
        }
        return true;
    });

    /* this seemed a good idea, however launching applications from inside an iframe
     * is too fragile given the abundance of popup blockers.  given that, it seems
     * wiser to return a launchurl in list.
    chan.bind('launch', function(t, key) {
        verifyMgmtPermission(t.origin);

        var item = appStorage.get(key);
        if (item) {
            try {
                item = JSON.parse(item);
                item.app = Manifest.validate(item.app);
            } catch (e) {
                logError("invalid application removed: " + e);
                appStorage.remove(key);
                item = null;
            }
        }
        if (!item) throw [ "noSuchApplication", "no application exists with the id: " + key ]; 

        win.open(item.app.base_url + item.app.launch_path, "__" + key);

        return true;
    });
     */

    /**
       help with debugging issues
       We can eventually toggle this using a debug.myapps.org store
    **/
    function logError(message) {
        if(win.console && win.console.log) {
            win.console.log('App Repo error: ' + message);
        }
    }

    return {
        showDialog: function() { chan.notify({ method: "showme" }); },
        hideDialog: function() { chan.notify({ method: "hideme" }); }
    }
})();
