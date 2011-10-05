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
const unload = require("unload");
const url = require("./urlmatch");
const simple = require("simple-storage");
const { Cc, Ci, Cm, Cu, Cr, components } = require("chrome");

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

/* disable ui for fx-share q3 release
  tmp = require("./injector");
  tmp.InjectorInit(this._window);
  this._inject();
  win.appinjector.inject();
*/

  tmp = require("./services");
  this._services = new tmp.serviceInvocationHandler(this._window);

  if (this.pendingRegistrations) {
    for each(let reg in this.pendingRegistrations) {
      this._repo._registerBuiltInApp(reg[0], reg[1], reg[2]);
    }
    this.pendingRegistrations = null;
  }

/* disable ui for fx-share q3 release

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

end disable of ui
*/

}

openwebapps.prototype = {
  _inject: function() {
    let repo = this._repo;
    let win = this._window;
    let self = this;

    win.appinjector.register({
      apibase: "navigator.mozApps",
      name: "install",
      script: null,
      getapi: function(contentWindowRef) {
        return function(origin, data, onsuccess, onerror) {
          let args = {
            url: origin, install_data: data,
            onsuccess: onsuccess, onerror: onerror
          };
          repo.install(contentWindowRef.location, args, win);
        }
      }
    });
    win.appinjector.register({
      apibase: "navigator.mozApps",
      name: "amInstalled",
      script: null,
      getapi: function(contentWindowRef) {
        return function(callback) {
          repo.amInstalled(contentWindowRef.location, callback);
        }
      }
    });
    win.appinjector.register({
      apibase: "navigator.mozApps",
      name: "getInstalledBy",
      script: null,
      getapi: function(contentWindowRef) {
        return function(callback) {
          repo.getInstalledBy(contentWindowRef.location, callback);
        }
      }
    });

    win.appinjector.register({
      apibase: "navigator.mozApps",
      name: "startActivity",
      script: null,
      getapi: function(contentWindowRef) {
        return function(activity, successCB, errorCB) {
          self._services.invoke(contentWindowRef, activity, successCB, errorCB);
        }
      }
    });

    // management APIs:
    win.appinjector.register({
      apibase: "navigator.mozApps.mgmt",
      name: "launch",
      script: null,
      getapi: function(contentWindowRef) {
        return function(args) {
          repo.verifyMgmtPermission(contentWindowRef.location);
          repo.launch(args);
        }
      }
    });
    win.appinjector.register({
      apibase: "navigator.mozApps.mgmt",
      name: "list",
      script: null,
      getapi: function(contentWindowRef) {
        return function(callback) {
          repo.verifyMgmtPermission(contentWindowRef.location);
          repo.list(callback);
        }
      }
    });
    win.appinjector.register({
      apibase: "navigator.mozApps.mgmt",
      name: "loginStatus",
      script: null,
      getapi: function(contentWindowRef) {
        return function(args) {
          repo.verifyMgmtPermission(contentWindowRef.location);
          return repo.loginStatus(args);
        }
      }
    });
    win.appinjector.register({
      apibase: "navigator.mozApps.mgmt",
      name: "loadState",
      script: null,
      getapi: function(contentWindowRef) {
        return function(callback) {
          repo.verifyMgmtPermission(contentWindowRef.location);
          repo.loadState(contentWindowRef.location, callback);
        }
      }
    });
    win.appinjector.register({
      apibase: "navigator.mozApps.mgmt",
      name: "saveState",
      script: null,
      getapi: function(contentWindowRef) {
        return function(state, callback) {
          repo.verifyMgmtPermission(contentWindowRef.location);
          repo.saveState(contentWindowRef.location, state, callback);
        }
      }
    });
    win.appinjector.register({
      apibase: "navigator.mozApps.mgmt",
      name: "uninstall",
      script: null,
      getapi: function(contentWindowRef) {
        return function(key, callback, onerror) {
          repo.verifyMgmtPermission(contentWindowRef.location);
          repo.uninstall(key, callback, onerror);
        }
      }
    });

    win.appinjector.register({
      apibase: "navigator.mozApps.mgmt",
      name: "watchUpdates",
      script: null,
      getapi: function(contentWindowRef) {
        return function(callback) {
          repo.verifyMgmtPermission(contentWindowRef.location);
          return repo.watchUpdates(callback);
        }
      }
    });
    win.appinjector.register({
      apibase: "navigator.mozApps.mgmt",
      name: "clearWatch",
      script: null,
      getapi: function(contentWindowRef) {
        return function(id) {
          repo.verifyMgmtPermission(contentWindowRef.location);
          repo.clearWatch(id);
        }
      }
    });
  },

  registerBuiltInApp: function(domain, app, injector) {
    if (!this._repo) {
      if (!this.pendingRegistrations) this.pendingRegistrations = [];
      this.pendingRegistrations.push([domain, app, injector]);
    } else {
      this._repo._registerBuiltInApp(domain, app, injector);
    }
  }

};

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

/* disable ui for fx-share q3 release
  Cm.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
    AboutAppsUUID, "About Apps", AboutAppsContract, AboutAppsFactory
  );

  unloaders.push(function() {
    Cm.QueryInterface(Ci.nsIComponentRegistrar).unregisterFactory(
      AboutAppsUUID, AboutAppsFactory
    );
  });

  setupAboutPageMods();

  // Setup widget to launch dashboard
  require("widget").Widget({
    id: "openwebapps-toolbar-button",
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
*/

  // Broadcast that we're done, in case anybody is listening
  let tmp = require("api");
  Services.obs.notifyObservers(tmp.FFRepoImplService, "openwebapps-startup-complete", "");
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
