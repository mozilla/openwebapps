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
        scope: "openwebapps",
        debugOutput: true
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

    // Reference shortcut so minifier can save on characters
    var storage = win.localStorage;
  
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
        var toRemove = [];

        for (var i =0;i<storage.length;i++)
        {
            var key = localStorage.key(i);
            var item = localStorage.getItem(key);
            try {
                // validate the manifest
                var install = JSON.parse(item);
                install.app = Manifest.validate(install.app);

                if (applicationMatchesDomain(install.app, origin)) {      
                    result.push(install);
                }

            } catch(e) {
                toRemove.push(key);
            }
        }

        // Clean up
        if (toRemove.length > 0) {
            for (var i=0;i<toRemove.length;i++) {
                storage.removeItem(toRemove[i]);
            }
        }

        return result;
    }
    
    // Return all installations that were installed by the given origin domain 
    function getInstallsByOrigin(origin, requestObj)
    {
        var result = [];
        var toRemove = [];

        for (var i =0;i<storage.length;i++)
        {
            var key = localStorage.key(i);
            var item = localStorage.getItem(key);
            try {
                // validate the manifest
                var install = JSON.parse(item);
                install.app = Manifest.validate(install.app);

                if (urlMatchesDomain(install.installURL, origin)) {
                    result.push(install);
                }

            } catch(e) {
                toRemove.push(key);
            }
        }

        // Clean up
        if (toRemove.length > 0) {
            for (var i=0;i<toRemove.length;i++) {
                storage.removeItem(toRemove[i]);
            }
        }
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
            throw [ "invalidManifest", "couldn't validate your mainfest" ];
        }

        // cache the installOrigin
        installOrigin = t.origin;

        // cause the UI to display a prompt to the user
        displayInstallPrompt(t.origin, manf, function (allowed) {
            if (allowed) {
                var key = manf.base_url;

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
                storage.setItem(key, JSON.stringify(installation));
                    
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


    /* Management APIs for dashboards live beneath here */ 
    chan.bind('list', function(t, args) {
        throw 'notImplemented';
    });

    chan.bind('remove', function(t, args) {
        throw 'notImplemented';
    });

    chan.bind('launch', function(t, args) {
        throw 'notImplemented';
    });

    /**
       help with debugging issues
       We can eventually toggle this using a debug.myapps.org store
    **/
    function logError(requestObj, message, originHostname) {
        if(!requestObj || (typeof requestObj.id != 'number') ) {
            return;
        }
        if(win.console && win.console.log) {
            win.console.log(requestObj.cmd + ' Error: ' + message);
        }
    }

    return {
        showDialog: function() { chan.notify({ method: "showme" }); },
        hideDialog: function() { chan.notify({ method: "hideme" }); }
    }
})();
