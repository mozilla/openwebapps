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

'use strict';
/*jslint indent: 2, es5: true, plusplus: false, onevar: false */
/*global document: false, setInterval: false, clearInterval: false,
  Application: false, gBrowser: false, window: false, Components: false,
  PlacesUtils: false, gContextMenu: false,
  XPCOMUtils: false, AddonManager: false,
  BrowserToolboxCustomizeDone: false, InjectorInit: false, injector: false,
  Sync: false, TypedStorage: false */


// This is a quick and dirty hack to get repo working in Firefox
// Once it's working, use the learnings from this to refactor repo.js
// into a cross-platform implementation and pull out the firefox
// bits.

var EXPORTED_SYMBOLS = ["Repo"];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://openwebapps/modules/manifest.js");
Components.utils.import("resource://openwebapps/modules/typed_storage.js");
Components.utils.import("resource://openwebapps/modules/urlmatch.js");

var console = {
  log: function(s) {dump(s+"\n");}
};


function displayInstallPrompt(
    installOrigin, 
    manifestToInstall, 
    installConfirmationFinishFn,
    options)
{
//  window.confirm("Install something?");
  installConfirmationFinishFn(true);
//  { isExternalServer: isExternalServer });
}

var Repo = function(){
/*
    sync:Sync({
      url: '/',
      storage: TypedStorage()
    }),
*/

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
                install.app = Manifest.parse(install.app);
                try {
                  callback(aKey, install);
                } catch (e) {
                  console.log("Error inside iterateApps callback: " + e);
                }
            } catch (e) {
                logError("invalid application detected: " + e);
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
    };

    // Returns whether this application runs in the specified domain (scheme://hostname[:nonStandardPort])
    function applicationMatchesDomain(application, domain)
    {
        var testURL = application.base_url;
        if (urlMatchesDomain(testURL, domain)) return true;
        return false;
    };

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
    };

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
    };

    function install(location, args) {

        function installConfirmationFinish(allowed)
        {
          if (allowed) {
              var key = manifestToInstall.base_url;
              if (manifestToInstall.launch_path) key += manifestToInstall.launch_path;

              // Create installation data structure
              var installation = {
                  app: manifestToInstall,
                  installTime: new Date().getTime(),
                  installURL: installOrigin
              };

              if (args.authorization_url) {
                  installation.authorizationURL = args.authorization_url;
              }

              // Save - blow away any existing value
              appStorage.put(key, installation);

              // Send Response Object
              if (args.callback) args.callback(true);
          } else {
            t.error("denied", "User denied installation request");
          }
        }

        var manifestToInstall;
        var installOrigin = location.href;

        if (args.manifest) {
          // this is a "direct install", which is currently only recommended
          // for developers.  We display a strongly-worded warning message
          // to scare users off.

          // Validate and clean the request
          try {
              manifestToInstall = Manifest.parse(args.manifest);
              displayInstallPrompt(installOrigin, manifestToInstall, installConfirmationFinish,
                                   { isExternalServer: true });
              
          } catch(e) {
              throw [ "invalidManifest", "couldn't validate your manifest: " + e ];
          }
        } else if (args.url) {
          // contact our server to retrieve the URL
          // TODO what sort of portability library should we use?  we don't have jquery as
          // a requirement here yet.
          var xhr = new XMLHttpRequest();
          xhr.open("GET", "https://myapps.mozillalabs.com/getmanifest?url=" + escape(args.url), true);
          xhr.onreadystatechange = function(aEvt) {
            try {
              if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                  try {
                    manifestToInstall = Manifest.parse(JSON.parse(xhr.responseText));
                    
                    // Security check: Does this manifest's calculated manifest URL match where
                    // we got it from?
                    var expectedURL = manifestToInstall.base_url + (manifestToInstall.manifest_name ? manifestToInstall.manifest_name : "manifest.webapp");
                    var isExternalServer = (expectedURL != args.url);

                    displayInstallPrompt(installOrigin, manifestToInstall, installConfirmationFinish, { isExternalServer: isExternalServer });

                  } catch (e) {
                    t.error("invalidManifest", "couldn't validate your manifest: " + e );
                  }
                } else if (xhr.status >= 400 && xhr.status < 500)  {
                  t.error("invalidManifest", "manifest URL did not resolve to a valid manifest");
                } else {
                  t.error("networkError", "couldn't retrieve application manifest from network"); 
                }
              }
            } catch (e) {
              t.error("networkError", "couldn't retrieve application manifest from network");
            }
          }
          xhr.send(null);
        } else {
          // neither a manifest nor a URL means we cannot proceed.
          throw [ "missingManifest", "install requires a url or manifest argument" ];
        }
    };

    function verify(location, args) {
        // We will look for manifests whose app_urls filter matches the origin.
        // If we find one, we will initiate verification of the user
        // by contacting the authorizationURL defined in the installation record.

        // If we find two... well, for now, we take the first one.
        // Perhaps we should find the first one that has an authorization URL.

        var result = getInstallsForOrigin(location.href, args);
        if (result.length == 0) return null;
        var install = result[0];

        // Must have authorizationURL
        if (!install.authorizationURL)
        {
            throw ['invalidArguments', 'missing authorization url' ];
        }

        // TODO Could optionally have a returnto
        location.href = install.authorizationURL;

        // return value isn't meaningful.  as a result of overwriting
        // the parent location, we'll be torn down.
        return;
    };
    
    /** Determines which applications are installed for the origin domain */
    function getInstalled(location, args) {
        var installsResult = getInstallsForOrigin(location.href, args);

        // Caller doesn't get to see installs, just apps:
        var result = [];
        for (var i=0;i<installsResult.length;i++)
        {
            result.push(installsResult[i].app);
        }

        return result;
    };

    /** Determines which applications were installed by the origin domain. */
    function getInstalledBy(location, args) {
        var installsResult = getInstallsByOrigin(location.href, args);

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

    /* a function to check that an invoking page has "management" permission
     * all this means today is that the invoking page (dashboard) is served
     * from the same domain as the application repository. */
    function verifyMgmtPermission(origin) {


      return true;
      /*
      dump("origin is " + origin + "\n");

        var loc = origin;
        // make an exception for local testing, who via postmessage events
        // have an origin of "null"
        if ((origin === 'null' && origin.location.protocol === 'file:') ||
            ((loc.protocol + "//" + loc.host) === origin))
        {
            return;
        }
        throw [ 'permissionDenied',
                "to access open web apps management apis, you must be on the same domain " +
                "as the application repostiory" ];*/
    };

    /* Management APIs for dashboards live beneath here */

    // A function which given an installation record, builds an object suitable
    // to return to a dashboard.  this function may filter information which is
    // not relevant, and also serves as a place where we can rewrite the internal
    // JSON representation into what the client expects (allowing us to change
    // the internal representation as neccesary)
    function generateExternalView(key, item) {
        // XXX: perhaps localization should happen here?  be sent as an argument
        // to the list function?

        var result = {
            id: key,
            installURL: item.installURL,
            installTime: item.installTime,
            launchURL: item.app.base_url + (item.app.launch_path ? item.app.launch_path : ""),
        };

        if (item.app && item.app.icons) result.icons = item.app.icons;
        if (item.app && item.app.name) result.name = item.app.name;
        if (item.app && item.app.description) result.description = item.app.description;
        if (item.app && item.app.developer) result.developer = item.app.developer;
        return result;
    };

    function list(location) {
        verifyMgmtPermission(location.href);

        var installed = [];

        iterateApps(function(key, item) {
            installed.push(generateExternalView(key, item));
        });
        return installed;
    };

    function remove(location, key) {
        verifyMgmtPermission(location.href);
        var item = appStorage.get(key);
        if (!item) throw [ "noSuchApplication", "no application exists with the id: " + key ];
        appStorage.remove(key);
        return true;
    };

    function loadState(location) {
        verifyMgmtPermission(location.href);
        return stateStorage.get(location.href);
    };

    function saveState(location, state) {
        verifyMgmtPermission(location.href);
        // storing undefined purges state
        if (state === undefined) {
            stateStorage.remove(location.href);
        } else  {
            stateStorage.put(location.href, state);
        }
        return true;
    };

    function loginStatus(location, args) {
        verifyMgmtPermission(location.href);
        var loginInfo = {
            loginLink: location.protocol + '//' + location.host + '/login.html',
            logoutLink: location.protocol + '//' + location.host + '/logout'
        };
        var userInfo = sync.readProfile();
        return [userInfo, loginInfo];
    };
    
    /**
       help with debugging issues
       We can eventually toggle this using a debug.myapps.org store
    **/
    function logError(message) {
      dump("App Repo error: " + message + "\n");
    }
    
    return {
      install: install,
      getInstalled: getInstalled,
      getInstalledBy: getInstalledBy,
      list: list,
      remove:remove,
      loadState:loadState,
      saveState:saveState,
      loginStatus:loginStatus
    }
  }();