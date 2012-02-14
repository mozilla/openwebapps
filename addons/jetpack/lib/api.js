/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
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

const { Cc, Ci, Cu, Cr, components } = require("chrome");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

if (!console || !console.log) {
  var console = {
    log: function(s) {
      dump(s + "\n");
    }
  };
}

var { Manifest } = require("./manifest");
var { URLParse } = require("./urlmatch");
var { NativeShell } = require("./nativeshell");
var { TypedStorage } = require("typed_storage");

// Typical 'pending' object
function pendingOperation(type) {
  this._type = type;
}
pendingOperation.prototype = {
  onsuccess: function() {
    console.log("default onsuccess called for " + this._type);
  },
  onerror: function() {
    console.log("default onerror called for " + this._type);
  },
  result: undefined,
  error: undefined
};

// A helper function to make an 'app object' that implements
// both launch() & uninstall() from an app record
function appObject(apprec) {
  // FIXME: Any better way to do this?
  let props = ["manifest", "manifestURL", "origin", "installOrigin", "installTime"];
  for (let i = 0; i < props.length; i++) {
    this[props[i]] = apprec[props[i]];
  }
  this.receipts = null;
  if ('installData' in apprec && 'receipts' in apprec.installData) {
    this.receipts = apprec.installData.receipts;
  }
}
appObject.prototype.launch = function() {
  FFRepoImplService.launch(this.origin);
};
appObject.prototype.uninstall = function() {
  let pendingUninstall = new pendingOperation("uninstall");
  FFRepoImplService.uninstall(
    this.origin,
    function(e) {
      pendingUninstall.result = e;
      if (pendingUninstall.onsuccess) pendingUninstall.onsuccess(e);
    },
    function(e) {
      pendingUninstall.error = e;
      if (pendingUninstall.onerror) pendingUninstall.onerror(e);
    }
  );
  return pendingUninstall;
};

// We want to use as much from the cross-platform repo implementation
// as possible, but we do need to override a few methods.
var { Repo } = require("repo");

function FFRepoImpl() {
  this._builtInApps = {};
  this._watchers = {
    windowRefs: [],
    windowListeners: []
  };
  this._updateListeners = [];
}
FFRepoImpl.prototype = {
  __proto__: Repo,
  _observer: Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService),

  _registerBuiltInApp: function(domain, app, injector) {
    this._builtInApps[domain] = {
      manifest: app,
      origin: domain,
      install_time: new Date().getTime(),
      install_origin: domain,
      injector: injector
    }
    this._repo.invalidateCaches();
  },

  iterateApps: function(callback) {
    let that = this;
    Repo.iterateApps(function(apps) {
      if (that._builtInApps) {
        for (var k in that._builtInApps) {
          apps[k] = that._builtInApps[k];
        }
      }
      callback(apps);
    });
  },

  /**
   * watchUpdates
   *
   * start sending updates to a management app.  mgmtapi.js has logic for
   * supporting more than one watcher callback in a management app
   */
  watchUpdates: function(worker) {
    this._updateListeners.push(worker);
  },

  /**
   * clearWatch
   *
   * stops sending updates to a management window
   */
  clearWatch: function(worker) {
    let id = this._updateListeners.indexOf(worker);
    delete this._updateListeners[id];
  },

  _callWatchers: function(action, object) {
    for (let i = 0; i < this._updateListeners.length; i++) {
        let worker = this._updateListeners[i]
        // Ignore if destination callback doesn't exist
        try {
          if (worker) worker.port.emit("owa.mgmt.update", [action, object]);
        } catch(e) {}
    }
  },

  // Implement getSelf, getInstalled to use repo.js;
  // *but* wrap them in an appobject (which exposes launch & uninstall)
  // Can't do this for getAll since mgmt functions are implement using
  // worker.emit and pageMods. The equivalent logic for the following two
  // functions for getAll lives in mgmtapi.js
  getSelf: function(origin) {
    let pendingGetSelf = new pendingOperation("getSelf");
    Repo.getSelf(origin, function(app) {
      // Errors are either thrown by getSelf, or notified
      // via an empty argument to the success handler,
      // hence we never call pendingGetSelf.onerror
      if (pendingGetSelf.onsuccess) {
        let appObj = null;
        if (app) {
          appObj = new appObject(app);
        }
        pendingGetSelf.result = appObj;
        pendingGetSelf.onsuccess(appObj);
      }
    });
    return pendingGetSelf;
  },

  getInstalled: function(origin) {
    let pendingGetInstalled = new pendingOperation("getInstalled");
    Repo.getInstalled(origin, function(apps) {
      if (pendingGetInstalled.onsuccess) {
        let appObjs = [];
        for (let i = 0; i < apps.length; i++) {
          appObjs.push(new appObject(apps[i]));
        }
        pendingGetInstalled.result = appObjs;
        pendingGetInstalled.onsuccess(appObjs);
      }
    });
    return pendingGetInstalled;
  },

  // An application added to the local repo *without*
  // user prompt. Used by sync, could be used by tests
  // Do not expose to navigator.mozApps!
  addApplication: function(origin, apprec, cb) {
    let self = this;

    Repo.addApplication(origin, apprec, function(success) {
      if (success) {
        self._observer.notifyObservers(
          null, "openwebapp-installed", JSON.stringify({
            origin: origin,
            skipPostInstallDashboard: true
          })
        );
        self._callWatchers("add", [apprec]);
      }
      if (cb) {
        cb(success);
      }
    })
  },

  _fetchManifest: function(url, cb) {
    //dump("APPS | api.install.fetchManifest | Fetching manifest from " + url + "\n");
    // contact our server to retrieve the URL
    let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
    createInstance(Ci.nsIXMLHttpRequest);
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function(aEvt) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          //dump("APPS | api.install.fetchManifest | Got manifest (200) " + xhr.responseText.length + " bytes\n");
          cb(xhr.responseText, xhr.getResponseHeader('Content-Type'));
        } else {
          dump("Failed to get manifest (" + xhr.status + ")\n");
          cb(null);
        }
      }
    };

    try {
      xhr.send(null);
    } catch (e) {
      console.log("XHR in fetchManifest threw " + e);
      cb(null);
    }

    let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    timer.initWithCallback({
      notify: function(timer) {
        if (xhr.readyState !== 4) {
          // Note: calling abort() will set readyState to 4 but status to 0
          // and will call onreadystatechange!
          xhr.abort();
        }
      }
    }, 5000, Ci.nsITimer.TYPE_ONE_SHOT);

  },

  install: function _install(location, args, window) {
    let self = this;

    // Check if manifest is provided
    if (!args.url) {
      throw "install missing required url argument";
    }

    // added a quick hack to forgo the prompt if a special argument is
    // sent in, to make it easy to install app straight from the lower-right prompt.
    let autoInstall = args._autoInstall;

    // We default to installing a native app, but allow the user to override
    // If autoInstall is enabled, don't create a native app
    let _makeNativeApp = true;
    if (autoInstall) _makeNativeApp = false;

    function displayPrompt(installOrigin, appOrigin, manifestToInstall, isUpdate, installConfirmationFinishFn) {
      //dump("APPS | api.install.displayPrompt | Checking for prompt\n");
      if (autoInstall) return installConfirmationFinishFn(true);

      let acceptButton = new Object();
      let noNativeButton = new Object();

      let message = "Are you sure you want to install " + manifestToInstall.name + "?";

      acceptButton.label = "Install (with Native app)";
      acceptButton.accessKey = "i";
      acceptButton.callback = function() {
        installConfirmationFinishFn(true);
      };

      noNativeButton.label = "Install (without Native app)";
      noNativeButton.accessKey = "n";
      noNativeButton.callback = function() {
        // Don't generate a native app
        _makeNativeApp = false;
        installConfirmationFinishFn(true);
      };

      let ret = window.PopupNotifications.show(
        window.gBrowser.selectedBrowser,
        "openwebapps-install-notification",
        message,
        null,
        acceptButton,
        [noNativeButton],
        {
          "persistence": 1,
          "persistWhileVisible": true,
          "eventCallback": function(state) {
            // If the user dismisses the prompt, we cancel
            // installation
            if (state == "dismissed") {
              installConfirmationFinishFn(false);
              ret.remove();
            }
          }
        }
      );
    }

    // Fetch from local file:// or resource:// URI (eg. for faker apps)
    let originalOrigin = {};

    function fetchLocalManifest(url, cb) {
      function LocalReader(callback) {
        this._callback = callback;
      }
      LocalReader.prototype = {
        QueryInterface: function(iid) {
          if (iid.equals(Ci.nsIStreamListener) || iid.equals(Ci.nsIRequestObserver) || iid.equals(Ci.nsISupports)) return this;
          throw Cr.NS_ERROR_NO_INTERFACE;
        },

        onStartRequest: function(req, ctx) {
          this._data = "";
          this._input = null;
        },

        onDataAvailable: function(req, ctx, stream, off, count) {
          if (!this._input) {
            let sis = Cc["@mozilla.org/scriptableinputstream;1"].getService(Ci.nsIScriptableInputStream);
            sis.init(stream);
            this._input = sis;
          }

          this._data += this._input.read(count);
        },

        onStopRequest: function(req, ctx, stat) {
          this._input.close();
          if (components.isSuccessCode(stat)) this._callback(this._data, "application/x-web-app-manifest+json");
          else
          this._callback(null);
        }
      };

      let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
      let stream = Cc["@mozilla.org/scriptableinputstream;1"].getService(Ci.nsIScriptableInputStream);
      let channel = ios.newChannel(originalOrigin[url], null, null);
      channel.asyncOpen(new LocalReader(cb), null);
    }

    // Choose appropriate fetcher depending on where the manifest lives
    let fetcher = self._fetchManifest;
    if (args.url.indexOf("resource://") === 0 || args.url.indexOf("file://") === 0) {
      fetcher = fetchLocalManifest;
      if (!args.origin) throw "Local manifest specified without origin!";

      // We'll have to store the resource/file URI to allow repo.install
      // to get the correct origin domain
      originalOrigin[args.origin] = args.url;
      args.url = args.origin;
    }

    let pendingAppInstall = new pendingOperation("appInstall");

    Repo.install(location, args, displayPrompt, fetcher, function(result) {
      //dump("        APPS | jetpack.install | Repo install returned to callback; result is " + result + "\n");
      // install is complete
      if (result.error !== undefined) {
        if (pendingAppInstall.onerror) {
          let errorResult;
          if (result.error.length == 2) {
            // Then it's [code, error]
            errorResult = {
              code: result.error[0],
              message: result.error[1]
            };
          } else {
            errorResult = result.error;
          }
          pendingAppInstall.error = errorResult;
          pendingAppInstall.onerror(errorResult);
        }
      } else {
        let origin = URLParse(args.url).normalize().originOnly().toString();
        self._observer.notifyObservers(
          null, "openwebapp-installed", JSON.stringify({
          origin: origin,
          skipPostInstallDashboard: args.skipPostInstallDashboard ? args.skipPostInstallDashboard : false
        }));
        self._callWatchers("add", [result]);

        // create OS-local application
        if (_makeNativeApp) {
          try {
            NativeShell.CreateNativeShell(result);
          } catch (e) {
            console.log("APPS | NativeShell | Aborted: " + e);
          }
        }

        if (pendingAppInstall.onsuccess) {
          let appObj = new appObject(result);
          pendingAppInstall.result = appObj;
          pendingAppInstall.onsuccess(appObj);
        }
      }
    });

    return pendingAppInstall;
  },

  uninstall: function(key, onsuccess, onerror) {
    let self = this;
    Repo.getAppById(key, function(app) {
      Repo.uninstall(key, function(result) {
        if (typeof result == 'object' && 'error' in result && onerror) {
          onerror({
            'code': result['error'][0],
            'message': result['error'][1]
          });
        } else {
          self._observer.notifyObservers(
            null, "openwebapp-uninstalled", null
          );
          self._callWatchers("remove", [app]);
          if (typeof onsuccess == 'function') {
            onsuccess(result);
          }
        }
      });
    });
  },

/* a function to check that an invoking page has "management" permission
     * all this means today is that the invoking page (dashboard) is served
     * from the same domain as the application repository. */
  verifyMgmtPermission: function _verifyMgmtPermission(origin) {
    let loc = origin;

    // make an exception for local testing, who via postmessage events
    // have an origin of "null"
    if ((origin === 'null' || origin.toString().substr(0, 8) == 'file:///')) {
      return;
    }

    // this is where we could have a whitelist of acceptable management
    // domains.
    let allowedOrigins = {
      "127.0.0.1:60172":"", "myapps.mozillalabs.com":"",
      "stage.myapps.mozillalabs.com":"", "apps.mozillalabs.com":"",
      "localhost:8010":"", "localhost":""
    };
    if (origin.host in allowedOrigins ||
        origin.toString().substr(0, 10) == "about:apps" ||
        origin.toString().substr(0, 9) == "resource:") {
      return;
    }

    // but for now:
    throw ['permissionDenied', "to access open web apps management apis, you must be on the same domain " + "as the application repository"];
  },

  launch: function _launch(id, dest) {
    function openAppURL(url, app) {
      let ss = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
      let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
      let bEnum = wm.getEnumerator("navigator:browser");

      let origin = URLParse(url).normalize().originOnly().toString();
      let found = false;

      // Do we already have this app running in a tab? If so, target it.
      while (!found && bEnum.hasMoreElements()) {
        let browserWin = bEnum.getNext();
        let tabbrowser = browserWin.gBrowser;

        for (let index = 0; index < tabbrowser.tabs.length; index++) {
          let cur = tabbrowser.tabs[index];
          let brs = tabbrowser.getBrowserForTab(cur);
          let appURL = ss.getTabValue(cur, "appURL");
          let brsOrigin = URLParse(brs.currentURI.spec).normalize().originOnly().toString();

          if (appURL && appURL == origin) {
            // The app is running in this tab; select it and retarget.
            browserWin.focus();
            tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];

            // If destination is different than loaded content,
            // notify the app if it is registered to handle it,
            // else, reload the page with the new URL?
            if (url != brs.currentURI.spec) {
              brs.loadURI(url, null, null); // Referrer is broken
            }

            found = true;
          }
        }
      }

      // Our URL does not belong to a currently running app.
      // Create a new tab for that app and load our URL into it.
      if (!found) {
        let recentWindow = wm.getMostRecentWindow("navigator:browser");
        if (recentWindow) {
          let brs = recentWindow.gBrowser;
          let tab = brs.addTab(app.launch_url);
          let bar = recentWindow.document.getElementById("nav-bar");

          brs.pinTab(tab);
          brs.selectedTab = tab;
          ss.setTabValue(tab, "appURL", origin);
          bar.setAttribute("collapsed", true);

          brs.loadURI(url, null, null); // Referrer is broken
        } else {
          // This is a very odd case: no browser windows are open, so open a new one.
          var new_window = aWindow.open(url);
          // TODO: convert to app tab somehow
        }
      }
    }

    // fixed the hack, using a proper API call to get a single app
    // (that API call may iterate, but that's not our problem here)
    Repo.getAppById(id, function(app) {
      if (!app) throw "Invalid AppID: " + id;

      if (dest) {
        let origin = URLParse(dest).normalize().originOnly().toString();
        if (origin != id) throw "Invalid AppDestination " + dest;
      }

      openAppURL(dest ? dest : app.launch_url, app);
    });
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
        let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
        createInstance(Ci.nsIXMLHttpRequest);
        xhr.open("GET", this.currentPageAppURL.spec, true);
        xhr.onreadystatechange = function(aEvt) {
          if (xhr.readyState == 4) {
            if (xhr.status == 200) {
              try {
                let manifest = JSON.parse(xhr.responseText);
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
  }
};

// Declare the singleton
if (!FFRepoImplService) {
  var EXPORTED_SYMBOLS = ["FFRepoImplService"];
  var FFRepoImplService = new FFRepoImpl();
}

exports.FFRepoImplService = FFRepoImplService;
