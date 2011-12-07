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
 * The Original Code is Open Web Apps for Firefox.
 *
 * The Initial Developer of the Original Code is The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *    Anant Narayanan <anant@kix.in>
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

const tabs = require("tabs");
const addon = require("self");
const pageMod = require("page-mod");
const unload = require("unload");
const url = require("./urlmatch");
const simple = require("simple-storage");
const { Cc, Ci, Cm, Cu, Cr, components } = require("chrome");

const TOOLBAR_ID = "openwebapps-toolbar-button";
const APP_SYNC_URL = "https://myapps.mozillalabs.com";

var tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
Cu.import("resource://gre/modules/AddonManager.jsm", tmp);
Cu.import("resource://gre/modules/XPCOMUtils.jsm", tmp);
var { XPCOMUtils, AddonManager, Services } = tmp;

/**
 * openwebapps
 *
 * per-window initialization for owa
 */
function openwebapps(win, getUrlCB) {
  this._getUrlCB = getUrlCB;
  this._window = win;

  // Base initialization
  let tmp = {};
  tmp = require("./api");
  this._repo = tmp.FFRepoImplService;
  
  // setup page-mods
  this.setupManagerAPI();

  if (this.pendingRegistrations) {
    for each(let reg in this.pendingRegistrations) {
      this._repo._registerBuiltInApp(reg[0], reg[1], reg[2]);
    }
    this.pendingRegistrations = null;
  }

  // Load stylesheet
  let uri = require("self").data.url("skin/overlay.css");
  let document = win.document;
  let pi = document.createProcessingInstruction("xml-stylesheet", "href=\"" + uri + "\" type=\"text/css\"");
  document.insertBefore(pi, document.firstChild);

  // TODO: Figure out a way to do this without waiting for 500ms.
  // Also, intercept document loads that don't open in a new tab
  // (this should be done in the content-document-global-created observer?)
  let self = this;
  win.gBrowser.tabContainer.addEventListener("TabOpen", function(e) {
    self._window.setTimeout(function(e) {
      if (e.target.pinned) return;

      let browser = self._window.gBrowser.getBrowserForTab(e.target);
      // empty tabs have no currentURI
      if (!browser || !browser.currentURI) return;
      let origin = url.URLParse(browser.currentURI.spec).originOnly().toString();

      self._repo.getAppByUrl(origin, function(app) {
        if (app) {
          self._repo.launch(origin, browser.currentURI.spec);
          self._window.gBrowser.removeTab(e.target);
        }
      });
    }, 500, e);
  }, false);


  // Handle the case of our special app tab being selected so we
  // can hide the URL bar etc.
  let container = this._window.gBrowser.tabContainer;
  let ss = Cc["@mozilla.org/browser/sessionstore;1"].getService(Ci.nsISessionStore);
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);

  function appifyTab(evt) {
    let win = wm.getMostRecentWindow("navigator:browser");
    let box = win.document.getElementById("nav-bar");

    if (ss.getTabValue(evt.target, "appURL")) {
      box.setAttribute("collapsed", true);
    } else {
      box.setAttribute("collapsed", false);
    }
  }

  container.addEventListener("TabSelect", appifyTab, false);
}

openwebapps.prototype = {

  registerBuiltInApp: function(domain, app, injector) {
    // XXX is anything using this call?  if dead remove it
    if (!this._repo) {
      if (!this.pendingRegistrations) this.pendingRegistrations = [];
      this.pendingRegistrations.push([domain, app, injector]);
    } else {
      this._repo._registerBuiltInApp(domain, app, injector);
    }
  },
  
  setupManagerAPI: function() {
    let repo = this._repo;

    // XXX TODO if a manager app is installed,
    // we need to add it to the allowedOrigins
    let allowedOrigins = [
      "https?://myapps.mozillalabs.com",
      "*.myapps.mozillalabs.com",
      "https?://apps.mozillalabs.com",
      "https?://localhost",
      "http://127.0.0.1:60172/*",
      "about:apps"
    ];
  
    pageMod.PageMod({
      include: allowedOrigins,
      contentScriptWhen: 'start',
      contentScriptFile: require("self").data.url("mgmtapi.js"),
      onAttach: function onAttach(worker) {
        worker.port.on("owa.mgmt.launch", function(msg) {
          repo.launch(msg.data);
        });
        worker.port.on("owa.mgmt.list", function(msg) {
          repo.list(function(apps) {
            worker.port.emit(msg.success, apps)
          });
        });
        worker.port.on("owa.mgmt.uninstall", function(msg) {
          repo.uninstall(msg.data, function(success) {
            if (success)
              worker.port.emit(msg.success, null);
            else
              worker.port.emit(msg.error, null);
          });
        });
        worker.port.on("owa.mgmt.watchUpdates", function(msg) {
          repo.watchUpdates(worker);
        });
        worker.port.on("owa.mgmt.clearWatch", function(msg) {
          repo.clearWatch(worker);
        });
      }
    });    
  }


};

//----- navigator.mozApps api implementation
function NavigatorAPI() {};
NavigatorAPI.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDOMGlobalPropertyInitializer]),
  init: function API_init(aWindow) {
    //console.log("API object init for "+aWindow.location);
    let chromeObject = this._getObject(aWindow);
  
    // We need to return an actual content object here, instead of a wrapped
    // chrome object. This allows things like console.log.bind() to work.
    let contentObj = Cu.createObjectIn(aWindow);
    function genPropDesc(fun) {
      return { enumerable: true, configurable: true, writable: true,
               value: chromeObject[fun].bind(chromeObject) };
    }
    let properties = {};
    
    for (var fn in chromeObject.__exposedProps__) {
      //console.log("adding property "+fn);
      properties[fn] = genPropDesc(fn);
    }
  
    Object.defineProperties(contentObj, properties);
    Cu.makeObjectPropsNormal(contentObj);
  
    return contentObj;
  }
};

MozAppsAPIContract = "@mozilla.org/openwebapps/mozApps;1";
MozAppsAPIClassID = Components.ID("{19c6a16b-18d1-f749-a2c7-fa23e70daf2b}");
function MozAppsAPI() {}
MozAppsAPI.prototype = {
  __proto__: NavigatorAPI.prototype,
  classID: MozAppsAPIClassID,
  _getObject: function(aWindow) {
    let tmp = {};
    tmp = require("./api");
    let repo = tmp.FFRepoImplService;
    return {
      // window.console API
      install: function(origin, data, onsuccess, onerror) {
        let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
        let recentWindow = wm.getMostRecentWindow("navigator:browser");
        let args = {
          url: origin, install_data: data,
          onsuccess: onsuccess, onerror: onerror
        };
        repo.install(aWindow.location, args, recentWindow);
      },
      amInstalled: function(callback) {
        repo.amInstalled(aWindow.location, callback);
      },
      getInstalledBy: function(callback) {
        repo.getInstalledBy(aWindow.location, callback);
      },
      __exposedProps__: {
        install: "r",
        amInstalled: "r",
        getInstalledBy: "r"
      }
    };
  }
}
let MozAppsAPIFactory = {
  createInstance: function(outer, iid) {
    if (outer != null) throw Cr.NS_ERROR_NO_AGGREGATION;
    return new MozAppsAPI().QueryInterface(iid);
  }
};

//----- navigator.mozApps api implementation


//----- about:apps implementation
const AboutAppsUUID = components.ID("{1DD224F3-7720-4E62-BAE9-30C1DCD6F519}");
const AboutAppsContract = "@mozilla.org/network/protocol/about;1?what=apps";
let AboutAppsFactory = {
  createInstance: function(outer, iid) {
    if (outer != null) throw Cr.NS_ERROR_NO_AGGREGATION;
    return AboutApps.QueryInterface(iid);
  }
};
let AboutApps = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

  getURIFlags: function(aURI) {
    return Ci.nsIAboutModule.ALLOW_SCRIPT;
  },

  newChannel: function(aURI) {
    let ios = Cc["@mozilla.org/network/io-service;1"].
    getService(Ci.nsIIOService);
    let channel = ios.newChannel(
    addon.data.url("about.html"), null, null);
    channel.originalURI = aURI;
    return channel;
  }
};
//----- end about:apps (but see ComponentRegistrar call in startup())

let unloaders = [];
/**
 * setupAboutPageMods
 *
 * since the pages will get a location that is "about:apps" we need to
 * pagemod them and send them the actual resource url so css, images, etc.
 * will continue to load correctly without hard-coded resource urls.
 */
function setupAboutPageMods() {
  var pageMod = require("page-mod");
  pageMod.PageMod({
    include: ["about:apps*"],
    contentScriptWhen: 'start',
    contentScriptFile: addon.data.url('about.js'),
    onAttach: function onAttach(worker) {
      worker.port.emit('data-url', addon.data.url());
    }
  });
}

/**
 * setupLogin
 * Shows a jetpack panel to get a BrowserID assertion from the user to
 * authenticate to the sync service
 */
function setupLogin(service) {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
  let win = wm.getMostRecentWindow("navigator:browser");

  /* Way to get the widget
   * openwebapps@mozillalabs.com should be got from self.data
   */
  let button = win.document.getElementById("widget:openwebapps@mozillalabs.com-" + TOOLBAR_ID);
  let panel = require("panel").Panel({
    width: 300,
    height: 200,
    contentURL: APP_SYNC_URL + "/login.html"
  });

  pageMod.PageMod({
    include: APP_SYNC_URL + "/login.html",
    contentScriptWhen: "end",
    contentScript: "var button = document.getElementById('signin_button');" +
      "button.onclick = function() {" +
      "  unsafeWindow.navigator.wrappedJSObject.id.getVerifiedEmail(function(assertion) {" +
      "    self.port.emit('verifiedEmail', assertion);" +
      "  });" +
      "};",
    onAttach: function(worker) {
      worker.port.on("verifiedEmail", function(data) {
        service.login({
          assertion: data,
          audience: APP_SYNC_URL 
        }, function(err, info) {
          console.log("Got back from login " + JSON.stringify(err) + " " + JSON.stringify(info));
          service.syncNow();
        });
      });
    }
  });

  panel.show(button);
}

/**
 * migrateApps
 *
 * We *move* (not copy), apps that were previously installed using the HTML5 shim
 * library, hosted at https://myapps.mozillalabs.com/
 */
function migrateApps() {
  var pageWorkers = require("page-worker");

  try {
    console.log("Creating page worker");
    var worker = pageWorkers.Page({
      contentURL: "https://myapps.mozillalabs.com",
      contentScript: "var apps = [];" +
        "for (var i = 0; i < localStorage.length; i++) {" +
        " var key = localStorage.key(i);" +
        " if (key.slice(0, 4) == 'app#') {" +
        "   apps.push(localStorage.getItem(key));" +
        " }" +
        // Once we have the apps we want, just clean up everything
        // This clears dashbaord state too.
        "}" +
        "localStorage.clear();" +
        "self.port.emit('gotApps', JSON.stringify(apps));",
      contentScriptWhen: "end"
    });

    worker.port.on("gotApps", function(apps) {
      // Put these apps into extension's storage
      var gotApps = JSON.parse(apps);
      for (var i = 0; i < gotApps.length; i++) {
        var appRec = JSON.parse(gotApps[i]);
        console.log("Migrating app " + appRec.origin);

        let repo = require("./api").FFRepoImplService;
        repo.addApplication(appRec.origin, appRec, function(done) {
          if (!done) {
            console.log("Error while migrating app " + appRec.origin);
          }
        }); 
      }
    });
  } catch (e) {
    console.log("Error in migrateApps " + e);
  }
}

/**
 * startup
 *
 * all per-instance initialization should be started from here.  The window
 * watcher will create an instance of openwebapps per navigator window.
 * addon-sdk widgets manage their own per-window initialization, don't replicate
 * that.
 *
 * Notifications are made per-window after owa has finished it's per-window
 * to allow other addons with owa as a dependency to have a reliable
 * way to initialize per-window.
 */
function startup(getUrlCB) { /* Initialize simple storage */
  if (!simple.storage.links) simple.storage.links = {};
  Services.obs.notifyObservers(null, "openwebapps-mediator-init", "");

  /* We use winWatcher to create an instance per window (current and future) */
  let iter = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator).getEnumerator("navigator:browser");
  while (iter.hasMoreElements()) {
    let aWindow = iter.getNext().QueryInterface(Ci.nsIDOMWindow);
    aWindow.apps = new openwebapps(aWindow, getUrlCB);
    Services.obs.notifyObservers(aWindow, "openwebapps-mediator-load", "");
  }

  function winWatcher(subject, topic) {
    if (topic != "domwindowopened") return;
    subject.addEventListener("load", function() {
      subject.removeEventListener("load", arguments.callee, false);
      let doc = subject.document.documentElement;
      if (doc.getAttribute("windowtype") == "navigator:browser") {
        subject.apps = new openwebapps(subject, getUrlCB);
        Services.obs.notifyObservers(subject, "openwebapps-mediator-load", "");
      }
    }, false);
  }
  Services.ww.registerNotification(winWatcher);
  unloaders.push(function() Services.ww.unregisterNotification(winWatcher));

  Cm.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
    AboutAppsUUID, "About Apps", AboutAppsContract, AboutAppsFactory
  );

  unloaders.push(function() {
    Cm.QueryInterface(Ci.nsIComponentRegistrar).unregisterFactory(
      AboutAppsUUID, AboutAppsFactory
    );
  });

  // register our navigator api's that will be globally attached
  Cm.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
    MozAppsAPIClassID, "MozAppsAPI", MozAppsAPIContract, MozAppsAPIFactory
  );
  Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager).
              addCategoryEntry("JavaScript-navigator-property", "mozApps",
                      MozAppsAPIContract,
                      false, true);

  unloaders.push(function() {
    Cm.QueryInterface(Ci.nsIComponentRegistrar).unregisterFactory(
      MozAppsAPIClassID, MozAppsAPIFactory
    );
    Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager).
                deleteCategoryEntry("JavaScript-navigator-property", "mozApps", false);
  });

  setupAboutPageMods();

  // Setup widget to launch dashboard
  require("widget").Widget({
    id: TOOLBAR_ID,
    label: "Apps",
    width: 60,
    contentURL: require("self").data.url("widget.html"),
    onClick: function() {
      let found = false;
      for each (let tab in tabs) {
        let origin = url.URLParse(tab.url).originOnly().toString();
        if (origin == "https://myapps.mozillalabs.com") {
          tab.activate(); found = true; break;
        }
      }
      if (!found) tabs.open("https://myapps.mozillalabs.com");
    }
  });

  // Setup Sync
  let tmp = require("./api");
  let sync = require("./sync");
  let storage = require("./typed_storage");
  let syncURL = require("preferences-service").get("apps.sync.url", APP_SYNC_URL + "/verify");
  
  let service = new sync.Service({
    repo: tmp.FFRepoImplService,
    server: new sync.Server(syncURL),
    storage: new storage.TypedStorage().open("sync")
  });

  service.onstatus = function(status) {
    if (status.error) {
      console.log("Error syncing: " + JSON.stringify(status.detail));
    } else if (status.status) {
      if (status.status == 'sync_get') {
        console.log("last_sync_get: " + status.timestamp);
      } else if (status.status == 'sync_put_complete' || (status.status == 'sync_put' && status.count === 0)) {
        console.log("last_sync_put: " + status.timestamp);
      }
    }
  };

  let scheduler = new sync.Scheduler(service);
  scheduler.onerror = function (error) {
    console.log("Error syncing: " + JSON.stringify(error));
  };

  // Migrate apps, if neccessary, from HTML5 installs
  migrateApps();

  // We don't have an assertion from BrowserID, so let's ask the user to login
  setupLogin(service);

  // Setup socket server
  // TODO: Add stopServer method to unloaders
  require("socketserver").startServer();

  // Broadcast that we're done, in case anybody is listening
  Services.obs.notifyObservers(tmp.FFRepoImplService, "openwebapps-startup-complete", "");

  // initialize the injector if we are <fx9
  require("./injector").init();
}

function shutdown(why) {
  // variable why is one of 'uninstall', 'disable', 'shutdown', 'upgrade' or
  // 'downgrade'. doesn't matter now, but might later
  unloaders.forEach(function(unload) unload && unload());
}

// Let's go!
startup(addon.data.url);

// Hook up unloaders
unload.when(shutdown);
