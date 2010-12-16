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

;Repo = (function() {
    var appStorage = TypedStorage().open("app");
    var stateStorage = TypedStorage().open("state");


    // iterates over all stored applications manifests and passes them to a
    // callback function.  This function should be used instead of manual
    // iteration as it will parse manifests and purge any that are invalid.
    function iterateApps(cb) {
        // we'll automatically clean up malformed installation records as we go
        var toRemove = [];

        appStorage.iterate(function(key, item) {
            try {
                item.app = Manifest.parse(item.app);
                cb(key, item);
            } catch (e) {
                console.log("invalid application detected: " + e);
                toRemove.push(key);
            }
        });

        for (var j = 0; j < toRemove.length; j++) {
            appStorage.remove(toRemove[j]);
        }
    }

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
    function applicationMatchesDomain(application, domain)
    {
        var testURL = application.base_url;
        if (urlMatchesDomain(testURL, domain)) return true;
        return false;
    }

    // Return all installations that belong to the given origin domain
    function getInstallsForOrigin(origin)
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
    function getInstallsByOrigin(origin)
    {
        var result = [];

        iterateApps(function(key, item) {
            if (urlMatchesDomain(item.installURL, origin))
            {
                result.push(item);
            }
        });

        return result;
    }

    var installFunc = function(origin, args, cb) {
        // Validate and clean the request
        var manf;
        try {
            manf = Manifest.parse(args.manifest);
        } catch(e) {
            cb({error: [ "invalidManifest", "couldn't validate your mainfest: " + e]});
            return;
        }

        // display an install prompt
        Prompt.show(function(allowed) {
            if (allowed) {
                // Create installation data structure
                var installation = {
                    app: manf,
                    installTime: new Date().getTime(),
                    installURL: origin
                };

                if (args.authorization_url) {
                    installation.authorizationURL = args.authorization_url;
                }

                // Save - blow away any existing value
                appStorage.put(manf.base_url, installation);

                // Send Response Object
                cb(true);
            } else {
                cb({error: ["denied", "User denied installation request"]});
            }
        });
    };


    /** Determines which applications are installed for the origin domain */
    var getInstalledFunc = function(origin) {
        var installsResult = getInstallsForOrigin(origin);

        // Caller doesn't get to see installs, just apps:
        var result = [];
        for (var i=0;i<installsResult.length;i++)
        {
            result.push(installsResult[i].app);
        }

        return result;
    };

    /** Determines which applications were installed by the origin domain. */
    var getInstalledByFunc = function(origin) {
        var installsResult = getInstallsByOrigin(origin);
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
    };


/*

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
*/



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
            launchURL: item.app.base_url + (item.app.launch_path ? item.app.launch_path : ""),
            developer: item.app.developer
        };
    }

    var listFunc = function() {
        var installed = [];
        iterateApps(function(key, item) {
            installed.push(generateExternalView(key, item));
        });
        return installed;
    };

    var removeFunc = function(id) {
        var item = appStorage.get(id);
        if (!item) return {error: [ "noSuchApplication", "no application exists with the id: " + id]}; 
        appStorage.remove(id);
        return true;
    };

    var launchFunc = function(id) {
        console.log("launching app: " + id);
        var i = appStorage.get(id);
        if (!i || !i.app.base_url) return false;
        var baseURL = i.app.base_url;
        var launchURL = baseURL + (i.app.launch_path ? i.app.launch_path : "");
        var appName = i.app.name;
        var parsedBaseURL = URLParse(baseURL).normalize();
        
        // determine if this application is running in some tab in some window
        chrome.windows.getAll({populate:true}, function(windows) { 
            for (var i = 0; i < windows.length; i++) {
                var w = windows[i];
                for (var j = 0; j < w.tabs.length; j++) {
                    var t = w.tabs[j];
                    if (parsedBaseURL.contains(t.url)) {
                        console.log("found application running (" + appName + "), focusing");
                        chrome.windows.update(w.id, { focused: true });                        
                        chrome.tabs.update(t.id, { selected: true });
                        return;
                    }
                }
            }
            console.log("app not running (" + appName + "), spawning");
            chrome.tabs.create({url: launchURL});
        });

        return true;
    }

    var loadStateFunc = function(id) {
        return stateStorage.get(id); 
    };

    var saveStateFunc = function(id, state) {
        // storing null purges state
        if (state === undefined) {
            stateStorage.remove(id);
        } else  {
            stateStorage.put(id, state);
        }
        return true;
    };

    return {
        list: listFunc,
        install: installFunc,
        remove: removeFunc,
        getInstalled: getInstalledFunc,
        getInstalledBy: getInstalledByFunc,
        loadState: loadStateFunc,
        saveState: saveStateFunc,
        launch: launchFunc
    }
})();
