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

'use strict';

const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = ["FFRepoImpl"];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://openwebapps/modules/typed_storage.js");

var console = {
    log: function(s) {dump(s+"\n");}
};

// Can't really use Cu.import to get manifest.js and urlmatch.js without
// changing them as they do not define EXPORTED_SYMBOLS (and aren't really
// js modules in the firefox sense). We're okay with using loadSubscript()
// for them instead because they don't pollute the global namespace, and this
// is a hack after all ;)
var loader = Cc["@mozilla.org/moz/jssubscript-loader;1"].
             getService(Components.interfaces.mozIJSSubScriptLoader);
loader.loadSubScript("resource://openwebapps/modules/manifest.js");
loader.loadSubScript("resource://openwebapps/modules/urlmatch.js");

// We want to use as much from the cross-platform repo implementation
// as possible, but we do need to provide a manifest 'fetcher'. Thus, we
// import repo.js into another object
var cR = {};
loader.loadSubScript("resource://openwebapps/modules/repo.js");

function FFRepoImpl() {
    
}
FFRepoImpl.prototype = {
    __proto__: Repo,
    
    install: function _install(location, args, window) {
        function displayPrompt(installOrigin, manifestToInstall, 
            installConfirmationFinishFn, options)
        {
            let acceptButton = new Object();
            let declineButton = new Object();

            let message = "Are you sure you want to install " +
                manifestToInstall.name + "?";

            acceptButton.label = "Install";
            acceptButton.accessKey = "i";
            acceptButton.callback = function() {
                installConfirmationFinishFn(true);
            };

            declineButton.label = "Cancel";
            declineButton.accessKey = 'c';
            declineButton.callback = function() {
                installConfirmationFinishFn(false);
            };

            /* old doorhanger deprecated in favor of new styling
            let nb = window.gBrowser.getNotificationBox();
            nb.appendNotification(
              message, "openwebapps-install-notification",
              "chrome://openwebapps/skin/install.png"
              null,
              nb.PRIORITY_INFO_HIGH, [ acceptButton, declineButton ]);
            */
            let ret = window.PopupNotifications.show(
                window.gBrowser.selectedBrowser,
                "openwebapps-install-notification",
                message, null, acceptButton, [declineButton], {
                    "persistence": 1,
                    "persistWhileVisible": true
                }
            );
        }

        function fetchManifest(url, cb)
        {
            // contact our server to retrieve the URL
            var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
                    createInstance(Ci.nsIXMLHttpRequest);
            xhr.open("GET", url, true);
            xhr.onreadystatechange = function(aEvt) {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        cb(xhr.responseText);
                    } else {
                        cb(null);
                    }
                }
            }
            xhr.send(null);
        }
        
        return Repo.install(location, args, displayPrompt, fetchManifest,
            function(result) {
                // install is complete
                // TODO: implement notifications
                
                if (result !== true) {
                  dump("Failed install: " + JSON.stringify(result) + "\n");
                  args.callback(false);
                } else {
                  args.callback(true);
                }
            }
        );
    },
    
    // we are overriding the common repo.js method because that one has
    // not been implemented yet
    verify: function _verify(location, args) {
        // We will look for manifests whose app_urls filter matches the origin.
        // If we find one, we will initiate verification of the user
        // by contacting the authorizationURL defined in the installation record.

        // If we find two... well, for now, we take the first one.
        // Perhaps we should find the first one that has an authorization URL.

        var result = getInstallsForOrigin(location.href, args);
        if (result.length == 0) return null;
        var install = result[0];

        // Must have authorizationURL
        if (!install.authorizationURL) {
            throw ['invalidArguments', 'missing authorization url' ];
        }

        // TODO Could optionally have a returnto
        location.href = install.authorizationURL;

        // return value isn't meaningful. as a result of overwriting
        // the parent location, we'll be torn down.
        return;
    },
    
    /* a function to check that an invoking page has "management" permission
     * all this means today is that the invoking page (dashboard) is served
     * from the same domain as the application repository. */
    verifyMgmtPermission: function _verifyMgmtPermission(origin) {
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
    },

    loginStatus: function loginStatus(location, args) {
        verifyMgmtPermission(location.href);
        var loginInfo = {
            loginLink: location.protocol + '//' + location.host + '/login.html',
            logoutLink: location.protocol + '//' + location.host + '/logout'
        };
        var userInfo = sync.readProfile();
        return [userInfo, loginInfo];
    }
    
    // TODO: implement launch()
};
