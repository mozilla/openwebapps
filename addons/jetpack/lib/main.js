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

const ui = require("./ui");
const url = require("./urlmatch");
const tabs = require("tabs");
const addon = require("self");
const unload = require("unload");
const simple = require("simple-storage");
const {Cc, Ci, Cm, Cu, Cr, components} = require("chrome");

var tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
Cu.import("resource://gre/modules/AddonManager.jsm", tmp);
Cu.import("resource://gre/modules/XPCOMUtils.jsm", tmp);
var {XPCOMUtils, AddonManager, Services} = tmp;

function openwebapps(win, getUrlCB)
{
    this._getUrlCB = getUrlCB;
    this._window = win;

    Cc["@mozilla.org/observer-service;1"]
      .getService(Ci.nsIObserverService)
          .addObserver( this, "openwebapp-installed", false);
    Cc["@mozilla.org/observer-service;1"]
      .getService(Ci.nsIObserverService)
          .addObserver( this, "openwebapp-uninstalled", false);
    
    // Base initialization
    let tmp = {};
    tmp = require("./api");
    this._repo = tmp.FFRepoImplService;

    tmp = require("./injector");
    tmp.InjectorInit(this._window); 
    this._inject();

    tmp = require("./services");
    this._services = new tmp.serviceInvocationHandler(this._window);

    tmp = {};
    Cu.import("resource://services-sync/main.js", tmp);
    if (tmp.Weave.Status.ready) {
        registerSyncEngine();
    } else {
        tmp = {};
        Cu.import("resource://services-sync/util.js", tmp);
        tmp.Svc.Obs.add("weave:service:ready", this);
    }
            
    if (this.pendingRegistrations) {
        for each (let reg in this.pendingRegistrations) {
            this._repo._registerBuiltInApp(reg[0], reg[1], reg[2]);
        }
        this.pendingRegistrations = null;
    }
          
    // Keep an eye out for LINK headers that contain manifests:
    let obs = Cc["@mozilla.org/observer-service;1"].
              getService(Ci.nsIObserverService);
    obs.addObserver(this, 'content-document-global-created', false);

    this._ui = new ui.openwebappsUI(win, getUrlCB, this._repo);
    
    // Prompt user if we detect that the page has an app via tabs module
    let self = this;
    tabs.on('activate', function(tab) {
        // If user switches tab via keyboard shortcuts, it does not dismiss
        // the offer panel (clicking does); so hide it if present
        self._ui._hideOffer();

        let cUrl = url.URLParse(tab.url).originOnly().toString();
        let record = simple.storage.links[cUrl];
        if (record) self.offerInstallIfNeeded(cUrl);
    });

    // TODO: Figure out a way to do this without waiting for 500ms.
    // Also, intercept document loads that don't open in a new tab
    // (this should be done in the content-document-global-created observer?)
    win.gBrowser.tabContainer.addEventListener("TabOpen", function(e) {
        self._window.setTimeout(function(e) {
            if (e.target.pinned) return;

            let browser = self._window.gBrowser.getBrowserForTab(e.target);
            let origin = url.URLParse(browser.currentURI.spec)
                .originOnly().toString();

            self._repo.getAppByUrl(origin, function(app) {
                if (app) {
                    self._repo.launch(origin, browser.currentURI.spec);
                    self._window.gBrowser.removeTab(e.target);
                }
            });
        }, 500, e);
    }, false);
}

openwebapps.prototype = {
    _inject: function() {
        let repo = this._repo;
        let win = this._window;
        let self = this;
        
        win.appinjector.register({
            apibase: "navigator.apps", name: "install", script: null,
            getapi: function (contentWindowRef) {
                return function (args) {
                    repo.install(contentWindowRef.location, args, win);
                }
            }
        });
        win.appinjector.register({
            apibase: "navigator.apps", name: "amInstalled", script: null,
            getapi: function (contentWindowRef) {
                return function (callback) {
                    repo.amInstalled(contentWindowRef.location, callback);
                }
            }
        });
        win.appinjector.register({
            apibase: "navigator.apps", name: "getInstalledBy", script: null,
            getapi: function (contentWindowRef) {
                return function (callback) {
                    repo.getInstalledBy(contentWindowRef.location, callback);
                }
            }
        });
        win.appinjector.register({
            apibase: "navigator.apps", name: "setRepoOrigin", script: null,
            getapi: function () {
                return function (args) {}
            }
        });

        win.appinjector.register({
            apibase: "navigator.apps", name: "invokeService", script: null,
            getapi: function (contentWindowRef) {
                return function (methodName, args, successCB, errorCB) {
                  self._services.invoke(contentWindowRef, methodName, args, successCB, errorCB);
                }
            }
        });

        // services APIs
        win.appinjector.register({
            apibase: "navigator.apps.services", name: "ready", script: null,
            getapi: function(contentWindowRef) {
                return function(args) {
                    self._services.initApp(contentWindowRef.wrappedJSObject);
                }
            }
        });

        win.appinjector.register({
            apibase: "navigator.apps.services", name: "registerHandler", script: null,
            getapi: function(contentWindowRef) {
                return function(activity, message, func) {
                    self._services.registerServiceHandler(contentWindowRef.wrappedJSObject, activity, message, func);
                }
            }
        });

        // management APIs:
        win.appinjector.register({
            apibase: "navigator.apps.mgmt", name: "launch", script: null,
            getapi: function (contentWindowRef) {
                return function (args) {
                    repo.verifyMgmtPermission(contentWindowRef.location);
                    repo.launch(args);
                }
            }
        });
        win.appinjector.register({
            apibase: "navigator.apps.mgmt", name: "list", script: null,
            getapi: function (contentWindowRef) {
                return function (callback) {
                    repo.verifyMgmtPermission(contentWindowRef.location);
                    repo.list(callback);
                }
            }
        });
        win.appinjector.register({
            apibase: "navigator.apps.mgmt", name: "loginStatus", script: null,
            getapi: function (contentWindowRef) {
                return function (args) {
                    repo.verifyMgmtPermission(contentWindowRef.location);
                    return repo.loginStatus(args);
                }
            }
        });
        win.appinjector.register({
            apibase: "navigator.apps.mgmt", name: "loadState", script: null,
            getapi: function (contentWindowRef) {
                return function (callback) {
                    repo.verifyMgmtPermission(contentWindowRef.location);
                    repo.loadState(contentWindowRef.location, callback);
                }
            }
        });
        win.appinjector.register({
            apibase: "navigator.apps.mgmt", name: "saveState", script: null,
            getapi: function (contentWindowRef) {
                return function (state, callback) {
                    repo.verifyMgmtPermission(contentWindowRef.location);
                    repo.saveState(contentWindowRef.location, state, callback);
                }
            }
        });
        win.appinjector.register({
            apibase: "navigator.apps.mgmt", name: "uninstall", script: null,
            getapi: function (contentWindowRef) {
                return function (key, callback, onerror) {
                    repo.verifyMgmtPermission(contentWindowRef.location);
                    repo.uninstall(key, callback, onerror);
                }
            }
        });
        win.appinjector.registerAction(function() {
            // Clear out the current page URL on every page load
            let toolbarButton = win.document.getElementById("openwebapps-toolbar-button");
            if (toolbarButton) {
                toolbarButton.classList.remove("highlight");
            }
            repo.setCurrentPageAppURL(null);
        });
    },
    
    observe: function(subject, topic, data) {
        function registerSyncEngine() {
            let tmp = {};
            Cu.import("resource://services-sync/main.js", tmp);

            tmp.AppsEngine = require("./sync").AppsEngine;
            
            if (!tmp.Weave.Engines.get("apps")) {
                tmp.Weave.Engines.register(tmp.AppsEngine);
                unloaders.push(function() {
                    tmp.Weave.Engines.unregister("apps");
                });
            }
            
            let prefname = "services.sync.engine.apps";
            if (Services.prefs.getPrefType(prefname) ==
                Ci.nsIPrefBranch.PREF_INVALID) {
                Services.prefs.setBoolPref(prefname, true);    
            }
        }
        
        if (topic == "weave:service:ready") {
            registerSyncEngine();
        } else if (topic == "openwebapp-installed") {
//             let installData = JSON.parse(data)
//             this._ui._renderDockIcons(installData.origin);
//             if (!installData.hidePostInstallPrompt) {
//                 this._ui._showDock();
//             }
            try{
               this._ui._updateDashboard('yes');
            } catch (e) {
                console.log(e);
            }

        } else if (topic == "openwebapp-uninstalled") {
//             this._ui._renderDockIcons();
               this._ui._updateDashboard();
        } else if (topic == "content-document-global-created") {
            let mainWindow = subject
                         .QueryInterface(Ci.nsIInterfaceRequestor)
                         .getInterface(Ci.nsIWebNavigation)
                         .QueryInterface(Ci.nsIDocShellTreeItem)
                         .rootTreeItem
                         .QueryInterface(Ci.nsIInterfaceRequestor)
                         .getInterface(Ci.nsIDOMWindow); 
            if (mainWindow != this._window) {
                return;
            }

            let self = this;
            mainWindow.addEventListener("DOMLinkAdded", function(aEvent) {
                if (aEvent.target.rel != "application-manifest")
                    return;

                let href = aEvent.target.href;
                let page = url.URLParse(aEvent.target.baseURI);
                page = page.normalize().originOnly().toString();

                if (!simple.storage.links[page]) {
                    // XXX: Should we restrict the href to be associated in
                    // a limited way with the page?
                    // Yes, perhaps .well-known or at the very least same origin
                    simple.storage.links[page] = {
                        "show": true,
                        "url": href
                    };
                }

                // If we just found this on the currently active page,
                // manually call UI hook because tabs.on('activate') will
                // not be called for this page
                let cUrl = url.URLParse(tabs.activeTab.url);
                cUrl = cUrl.normalize().originOnly().toString();

                if (cUrl == page)
                    self.offerInstallIfNeeded(page);
            }, false);
        }
    },
    
    // TODO: Don't be so annoying and display the offer everytime the app site
    // is visited. If the user says 'no', don't display again for the session
    offerInstallIfNeeded: function(origin) {
        let self = this;
        this._repo.getAppByUrl(origin, function(app) {
            if (!app)
                self._ui._showPageHasApp(origin);
        });
    },

    registerBuiltInApp: function(domain, app, injector) {
        if (!this._repo) {
            if (!this.pendingRegistrations) this.pendingRegistrations = [];
            this.pendingRegistrations.push( [domain, app, injector] );
        } else{
            this._repo._registerBuiltInApp(domain, app, injector);
        }
    }

};



//----- about:apps implementation
const AboutAppsUUID = components.ID("{1DD224F3-7720-4E62-BAE9-30C1DCD6F519}");
const AboutAppsContract = "@mozilla.org/network/protocol/about;1?what=apps";
let AboutAppsFactory = {
    createInstance: function(outer, iid) {
        if (outer != null)
            throw Cr.NS_ERROR_NO_AGGREGATION;
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
            addon.data.url("about.html"), null, null
        );
        channel.originalURI = aURI;
        return channel;
    }
};
//----- end about:apps (but see ComponentRegistrar call in startup())

//----- about:appshome implementation
const AboutAppsHomeUUID = components.ID("{C5A1D035-1A11-4152-8C17-7B6126FBA2CD}");
const AboutAppsHomeContract = "@mozilla.org/network/protocol/about;1?what=appshome";
let AboutAppsHomeFactory = {
    createInstance: function(outer, iid) {
        if (outer != null)
            throw Cr.NS_ERROR_NO_AGGREGATION;
        return AboutAppsHome.QueryInterface(iid);
    }
};
let AboutAppsHome = {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule]),

    getURIFlags: function(aURI) {
        return Ci.nsIAboutModule.ALLOW_SCRIPT;
    },

    newChannel: function(aURI) {
        let ios = Cc["@mozilla.org/network/io-service;1"].
                  getService(Ci.nsIIOService);
        let channel = ios.newChannel(
            addon.data.url("home.xhtml"), null, null
        );
        channel.originalURI = aURI;
        return channel;
    }
};
//----- end about:apps (but see ComponentRegistrar call in startup())

let unloaders = [];
function startup(getUrlCB) {
    /* Initialize simple storage */
    if (!simple.storage.links) simple.storage.links = {};

    /* We use winWatcher to create an instance per window (current and future) */
    let iter = Cc["@mozilla.org/appshell/window-mediator;1"]
               .getService(Ci.nsIWindowMediator)
               .getEnumerator("navigator:browser");
    while (iter.hasMoreElements()) {
        let aWindow = iter.getNext().QueryInterface(Ci.nsIDOMWindow);
        aWindow.apps = new openwebapps(aWindow, getUrlCB);
    }
    function winWatcher(subject, topic) {
        if (topic != "domwindowopened")
            return;
        subject.addEventListener("load", function() {
            subject.removeEventListener("load", arguments.callee, false);
            let doc = subject.document.documentElement;
            if (doc.getAttribute("windowtype") == "navigator:browser") {
                subject.apps = new openwebapps(subject, getUrlCB);
            }
        }, false);
    }
    Services.ww.registerNotification(winWatcher);
    unloaders.push(function() Services.ww.unregisterNotification(winWatcher));
    
    Cm.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
        AboutAppsUUID, "About Apps", AboutAppsContract, AboutAppsFactory
    );
    Cm.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
        AboutAppsHomeUUID, "About Apps Home", AboutAppsHomeContract, AboutAppsHomeFactory
    );

    unloaders.push(function() {
        Cm.QueryInterface(Ci.nsIComponentRegistrar).unregisterFactory(
            AboutAppsUUID, AboutAppsFactory
        );
        Cm.QueryInterface(Ci.nsIComponentRegistrar).unregisterFactory(
            AboutAppsHomeUUID, AboutAppsHomeFactory
        );
    });

    // Broadcast that we're done, in case anybody is listening
    let observerService = Cc["@mozilla.org/observer-service;1"]
               .getService(Ci.nsIObserverService);

    let tmp = require("api");
    observerService.notifyObservers(tmp.FFRepoImplService, "openwebapps-startup-complete", "");
}

function shutdown(why)
{
    // variable why is one of 'uninstall', 'disable', 'shutdown', 'upgrade' or
    // 'downgrade'. doesn't matter now, but might later
    unloaders.forEach(function(unload) unload && unload());

    // TODO: Hookup things to unload from ui.js module
}

// Let's go!
startup(addon.data.url);

// Hook up unloaders
unload.when(shutdown);

