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
 * The Original Code is include.js; substantial portions derived
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
  First version of app client code
  -Michael Hanson. Mozilla

  2010-10-29
  Major revision of app client code, using jschannel for cross
  document communication.
  -Lloyd Hilaiel. Mozilla   
**/


// inject into navigator.apps if it doesn't exist
if (!navigator) navigator = {};
if (!navigator.apps) navigator.apps = {};

// only inject if navigator.apps.install isn't defined
if (!navigator.apps || !navigator.apps.install) {
    navigator.apps = (function() {
        // Reference shortcut so minifier can save on characters
        var win = window;

        var AppRepositoryOrigin = "."; // "https://myapps.mozillalabs.com";
        var AppRepositoryServerURL = AppRepositoryOrigin + "/jsapi/include.html";

        // Cached references
        var iframe = null;

        // The jschannel to the applicaiton repositiory
        var chan = null;

        /* const */ var overlayId = "myappsOrgInstallOverlay";
        /* const */ var dialogId = "myappsTrustedIFrame";

        function showInstallDialog() {
            try { hideInstallDialog() } catch(e) { };
            // create a opacity overlay to focus the users attention 
            var od = document.createElement("div");
            od.id = overlayId;
            od.style.background = "#000";
            od.style.opacity = ".66";
            od.style.filter = "alpha(opacity=66)";
            od.style.position = "fixed";
            od.style.top = "0";
            od.style.left = "0";
            od.style.height = "100%";
            od.style.width = "100%";
            od.style.zIndex ="998";
            document.body.appendChild(od);
            document.getElementById(dialogId).style.display = "inline";
        }

        function hideInstallDialog() {
            document.getElementById(dialogId).style.display = "none";
            document.body.removeChild(document.getElementById(overlayId));
        }

        // Called once on first command to create the iframe to myapps.mozillalabs.com
        function setupWindow() {
            if(iframe) { return; }

            // Create hidden iframe dom element
            var doc = win.document;
            iframe = document.createElement("iframe");
            iframe.id = dialogId;
            iframe.style.position = "absolute";
            iframe.style.left = "140px";
            iframe.style.top = "0px";
            iframe.style.width = "410px";
            iframe.style.height = "332px";
            iframe.style.zIndex ="999";
            iframe.style.opacity = "1";

            iframe.style.border = "2px solid #aaaaaa";
            iframe.style.borderTop = "10px solid #aaaaaa";

            iframe.style.MozBorderRadius = "0px 0px 8px 8px";
            iframe.style.WebkitBorderRadius = "0px 0px 8px 8px";
            iframe.style.borderRadius = "0px 0px 8px 8px";
            
            // the "hidden" part
            iframe.style.display = "none";

            // Append iframe to the dom and load up myapps.mozillalabs.com inside
            doc.body.appendChild(iframe);
            iframe.src = AppRepositoryServerURL;

            chan = Channel.build({
                window: iframe.contentWindow,
                origin: "*",
                scope: "openwebapps"
            });

            // occasionally the application repository will request that we show/hide
            // its iframe content.
            // NOTE:  eventually we should probably be opening a new window from
            // inside the repo to mitigate clickjacking risks  
            chan.bind("showme", function(trans, args) {
                // Cache the reference to the iframe window object
                showInstallDialog();
            });

            chan.bind("hideme", function(trans, args) {
                hideInstallDialog();
            });
        }

        // Following three functions are just API wrappers that clean up the
        // the arguments passed in before they're sent and attach the
        // appropriate command strings to the request objects
        function callInstall(args) {
            if (!args) { args = {}; }
            chan.call({
                method: "install",
                params: {
                    manifest: args.manifest || {},
                    authorization_url: args.authorization_url || null,
                    session: args.session || false,
                },
                error: function(error, message) {
                    // XXX we need to relay this to the client
                    alert( " installation failed: "  + error + " - " + message); 
                },
                success: function(v) {
                    if (args.callback) args.callback(v);
                }
            });
        }
        
        function callVerify(args) {
            chan.call({
                method: "verify",
                error: function(error, message) {
                    // XXX we need to relay this to the client
                    alert( " couldn't begin verification: "  + error + " - " + message); 
                },
                success: function(v) {
                    // XXX: what's the utility of this callback?  it depends on
                    // verification flow
                    if (args.callback) args.callback(v);
                }
            });
        }

        function callGetInstalled(args) {
            chan.call({
                method: "getInstalled",
                error: function(error, message) {
                    // XXX we need to relay this to the client
                    alert( " couldn't begin verification: "  + error + " - " + message); 
                },
                success: function(v) {
                    // XXX: what's the utility of this callback?  it depends on
                    // verification flow
                    if (args.callback) args.callback(v);
                }
            });
        }

        function callGetInstalledBy(args) {
            chan.call({
                method: "getInstalledBy",
                error: function(error, message) {
                    // XXX we need to relay this to the client
                    alert( " couldn't begin verification: "  + error + " - " + message); 
                },
                success: function(v) {
                    // XXX: what's the utility of this callback?  it depends on
                    // verification flow
                    if (args.callback) args.callback(v);
                }
            });
        }

        /* launch an application. */
        function callLaunch(id, func) {
            chan.call({
                method: "launch",
                params: id,
                error: function(error, message) {
                    // XXX we need to relay this to the client
                    alert("couldn't launch: "  + error + " - " + message); 
                },
                success: function(v) {
                    if (func) func(v);
                }
            });
        }

        function callList(func) {
            chan.call({
                method: "list",
                error: function(error, message) {
                    // XXX we need to relay this to the client
                    alert("couldn't list apps: "  + error + " - " + message); 
                },
                success: function(v) {
                    if (func) func(v);
                }
            });
        }

        function callRemove(id, func) {
            chan.call({
                method: "remove",
                params: id,
                error: function(error, message) {
                    // XXX we need to relay this to the client
                    alert("couldn't remove: "  + error + " - " + message); 
                },
                success: function(v) {
                    if (func) func(v);
                }
            });
        }

        setupWindow();

        // Return AppClient object with exposed API calls
        return {
            install: callInstall,
            verify: callVerify,
            getInstalled: callGetInstalled,
            getInstalledBy: callGetInstalledBy,
            mgmt: {
                list: callList,
                remove: callRemove
            }
        };
    })();
}