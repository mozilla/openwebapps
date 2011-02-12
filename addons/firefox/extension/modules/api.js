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

var EXPORTED_SYMBOLS = ["FFRepoImplService"];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://openwebapps/modules/typed_storage.js");
Components.utils.import("resource://openwebapps/modules/injector.js");

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
        function displayPrompt(installOrigin, appOrigin, manifestToInstall,
            isUpdate, installConfirmationFinishFn)
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
                        cb(xhr.responseText, xhr.getResponseHeader('Content-Type'));
                    } else {
                        cb(null);
                    }
                }
            };
            xhr.send(null);
        }

        return Repo.install(location, args, displayPrompt, fetchManifest,
            function(result) {
                // install is complete
                // TODO: implement notifications

                if (result !== true) {
                  if (args.onerror) {
                    let errorResult;
                    if (result.error.length == 2) {
                      // Then it's [code, error]
                      errorResult = {code: result.error[0], message: result.error[1]};
                    } else {
                      errorResult = result.error;
                    }
                    // Note, here and below we use (1,...) to force this to be
                    // window (instead of args):
                    (1,args.onerror)(errorResult);
                  }
                } else {
                  if (args.onsuccess) {
                    (1,args.onsuccess)();
                  }
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
    
        var loc = origin;

        // make an exception for local testing, who via postmessage events
        // have an origin of "null"
        if ((origin === 'null' && origin.protocol === 'file:')) {
          return;
        }
        
        // this is where we could have a whitelist of acceptable management
        // domains.
        dump("origin.host is " + origin.host + "\n");
        if (origin.host == "127.0.0.1:60172" || /* special case for unit testing: to be removed when we get capability tracking for mgmt! */
            origin.host == "apps.mozillalabs.com" ||
            origin.host == "stage.apps.mozillalabs.com")
        {
          return;
        }
        
        // but for now:
        throw [ 'permissionDenied',
                "to access open web apps management apis, you must be on the same domain " +
                "as the application repository" ];
    },

    loginStatus: function loginStatus(location, args) {
        verifyMgmtPermission(location.href);
        var loginInfo = {
            loginLink: location.protocol + '//' + location.host + '/login.html',
            logoutLink: location.protocol + '//' + location.host + '/logout'
        };
        var userInfo = sync.readProfile();
        return [userInfo, loginInfo];
    },

    launch: function _launch(location, id) {
        function openAppURL(app)
        {
            let ss = Cc["@mozilla.org/browser/sessionstore;1"]
                    .getService(Ci.nsISessionStore);
            let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Ci.nsIWindowMediator);
            let bEnum = wm.getEnumerator("navigator:browser");
            let found = false;
            let url = app.launchURL;

            // Do we already have this app running in a tab?  If so, target it.
            while (!found && bEnum.hasMoreElements()) {
                let browserWin = bEnum.getNext();
                let tabbrowser = browserWin.gBrowser;
                let numTabs = tabbrowser.browsers.length;

                for (let index = 0; index < tabbrowser.tabs.length; index++) {
                    let cur = tabbrowser.tabs[index];
                    let brs = tabbrowser.getBrowserForTab(cur);
                    let appURL = ss.getTabValue(cur, "appURL");

                    if ((appURL && appURL == url) || url == brs.currentURI.spec) {
                        // The app is running in this tab; select it and retarget.
                        tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];

                        // Focus *this* browser-window
                        browserWin.focus();

                        // XXX: Do we really need a reload here?
                        //tabbrowser.selectedBrowser.loadURI(
                        //   url, null // TODO don't break referrer!
                        //, null);
                        found = true;
                    }
                }
            }

            // Our URL does not belong to a currently running app.  Create a new
            // tab for that app and load our URL into it.
            if (!found) {
                let recentWindow = wm.getMostRecentWindow("navigator:browser");
                if (recentWindow) {
                    let tab = recentWindow.gBrowser.addTab(url);
                    recentWindow.gBrowser.pinTab(tab);
                    recentWindow.gBrowser.selectedTab = tab;
                    ss.setTabValue(tab, "appURL", url);
                } else {
                    // This is a very odd case: no browser windows are open, so open a new one.
                    aWindow.open(url);
                    // TODO: convert to app tab somehow
                }
            }
        }

        // FIXME: this is a hack, we are iterating over installed apps to
        // find the one we want since we cannot get to the typed storage
        // via common repo.js
        let apps = Repo.list();
        for each (let app in apps) {
            if (app.id == id) {
                openAppURL(app);
                return;
            }
        }

        // Could not find specified app
        throw "Invalid AppID: " + id;
    },

    getCurrentPageHasApp: function _getCurrentPageHasApp() {
      return this.currentPageAppURL != null;
    },

    getCurrentPageAppManifestURL: function _getCurrentPageAppManifestURL() {
      return this.currentPageAppURL;
    },

    getCurrentPageApp: function _getCurrentPageApp(callback) {

      if (this.currentPageAppURL) {

        if (this.currentPageAppManifest) {
          callback(this.currentPageAppManifest);
          return;
        }
        try {
          var xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
                  createInstance(Ci.nsIXMLHttpRequest);
          xhr.open("GET", this.currentPageAppURL.spec, true);
          xhr.onreadystatechange = function(aEvt) {
              if (xhr.readyState == 4) {
                  if (xhr.status == 200) {
                    try {
                      var manifest = JSON.parse(xhr.responseText);
                      this.currentPageAppManifest = manifest;
                      callback(manifest);
                    } catch (e) {
                      // TODO report this out
                      callback(null);
                    }
                  } else {
                      callback(null);
                  }
              }
          };
          xhr.send(null);
        } catch (e) {
          dump("Error in getCurrentPageApp: " + e + "\n");
        }
      }

    },

    setCurrentPageAppURL: function _setCurrentPageApp(aURI) {
      this.currentPageAppURL = aURI;
      this.currentPageAppManifest = null;
    },
    
    websendIntroduce: function _websendIntroduce(browser, pickerPresentationCallback, iframeCreationCallback, anchor, wanted, callback) {
      try {
      
      // Find whether we have some apps that implement 'wanted'
      var potentialProviders = [];
      var apps = Repo.list();
      var matchArray = [];
      for each (var app in apps)
      {
        if (app.experimental && app.experimental.providers)
        {
          for each (var w in wanted)
          {
            for each (var p in app.experimental.providers)
            {
              if (p.supports.indexOf(w) >= 0) {
                matchArray.push(w); // go ahead and check them all; we'll need the list later
              }
            }
          }
          if (matchArray.length > 0) {
            potentialProviders.push(app);
            break;
          }
        }
      }

      if (potentialProviders.length == 0)
      {
        callback([]); // no matches, sorry!
      }
      else
      {
        // Save off the introductionCallback keyed on browser.contentDocument;
        // we'll need it when somebody calls welcome() later.
      
        pickerPresentationCallback(potentialProviders, function(gotProvider) {
          // instantiate the provider..
          // assuming there will be a frame for now?
          // which provider to load?  TODO to be 100% correct we should render each of the
          // matching providers for the app as a different line item.
          let providerElem;
          for each (let p in gotProvider.experimental.providers) {
            for each (let w in wanted) {
              if (p.supports.indexOf(w) >= 0) {
                providerElem = p;
              }
            }
          }
          if (providerElem.frame) {
            let theIframe = iframeCreationCallback(providerElem.frame, matchArray, callback);
          }
        });
      }

      } catch (e) {
        dump("Error in websend Introduce: " + e+"\n");
      }
    },
    websendWelcome: function _websendWelcome(browser, window, registrants, callback, introductionCallback) {
      // browser is the top-level browser
      // window is the iframe's window
      
      // BIG SCARY UNSAFE ASSUMPTION: The introduce() calling context is the top-level context.
      // Go recover the introductionCallback based on the introducing window (but see ASSUMPTION above, meh)
      // FIX: use window.parent not gBrowser.contentDocument
      
      // not sure what to do with welcomeCallback. SPEC.
      // TODO don't understand what to do with registrants? 
      try {
        var servicePort = new MessagePort(window, window.location.href);
        introductionCallback(["service-match-goes-here?"], servicePort, window);
      } catch (e) {
        dump("Error in websend welcome introductionCallback: " + e + "\n");
      }
      
      try {
        var customerPort = new MessagePort(browser.contentWindow, browser.contentWindow.location.href);
        callback(customerPort, {"customer":browser.contentDocument.location.href, "wanted":["who knows"]});
      } catch (e) {
        dump("Error in websend welcome callback:"  +e + "\n");
      }
    }
};


function MessagePort(window,targetDomain) {
  this.window = window;
  this.targetDomain = targetDomain;
}

MessagePort.prototype = 
{
  postMessage: function(msg) {
    if (this.window) {
      this.window.postMessage(JSON.stringify(msg), "*");//TODO: get domain targeting right, do not use until this is done!  (+/- this.targetDomain?)
    }
  },
  
  close: function() {
    this.window = null;
  }
}

MessagePort.__defineSetter__("onmessage", function(val) {
  this.window.addEventListener('message', val, false);
});



// Declare the singleton:
var FFRepoImplService = new FFRepoImpl();
