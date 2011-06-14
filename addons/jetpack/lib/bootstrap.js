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

const {Cc, Ci, Cm, Cu} = require("chrome");
const HTML_NS = "http://www.w3.org/1999/xhtml";
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

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
    tmp = require("./injector");
    tmp.InjectorInit(this._window); 
    this._inject();

    tmp = require("./api");
    this._repo = tmp.FFRepoImplService;

    tmp = require("./ui");
    this._ui = new tmp.openwebappsUI(win, getUrlCB, this._repo);
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
            var installData = JSON.parse(data)
            this._ui._renderDockIcons(installData.origin);
            if (!installData.hidePostInstallPrompt) {
                this._ui._showDock();
            }
        } else if (topic == "openwebapp-uninstalled") {
            this._ui._renderDockIcons();
        } else if (topic == "content-document-global-created") {
            let mainWindow = subject
                         .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                         .getInterface(Components.interfaces.nsIWebNavigation)
                         .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                         .rootTreeItem
                         .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                         .getInterface(Components.interfaces.nsIDOMWindow); 
            if (mainWindow != this._window) {
                return;
            }
            
            mainWindow.addEventListener("DOMLinkAdded", function(aEvent) {
                if (aEvent.target.rel == "application-manifest") {
                try {
                    var page = aEvent.target.baseURI;
                    var href = aEvent.target.href;

                    // Annotate the tab with the URL, so we can highlight the button
                    // and display the app when the user views this tab.
                    var ios = Components.classes["@mozilla.org/network/io-service;1"].
                    getService(Components.interfaces.nsIIOService);
                
                    // XXX TODO: Should we restrict the href to be associated in a limited way with the page?
                    aEvent.target.ownerDocument.applicationManifest =
                        ios.newURI(href, null, ios.newURI(page, null, null));

                    // If the current browser is this document's browser, update the highlight
                    dump("Setting manifest to " +
                    aEvent.target.ownerDocument.applicationManifest.spec + "\n");

                    // whoops, no gBrowser here!  rework this.
                    /*if (gBrowser.contentDocument === aEvent.target.ownerDocument) {
                    let toolbarButton = document.getElementById("openwebapps-toolbar-button");
                    if (toolbarButton) {
                        toolbarButton.classList.add("highlight");
                    }
                    }*/
              } catch (e) {
                dump(e + "\n");
              }
            }
          }, false);
        }
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
const AboutAppsUUID = Components.ID("{1DD224F3-7720-4E62-BAE9-30C1DCD6F519}");
const AboutAppsContract = "@mozilla.org/network/protocol/about;1?what=apps";
let AboutAppsFactory = {
    createInstance: function(outer, iid) {
        if (outer != null)
            throw Components.resources.NS_ERROR_NO_AGGREGATION;
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
            require("self").data.url("about.html"), null, null
        );
        channel.originalURI = aURI;
        return channel;
    }
};
//----- end about:apps (but see ComponentRegistrar call in startup())

//----- about:appshome implementation
const AboutAppsHomeUUID = Components.ID("{C5A1D035-1A11-4152-8C17-7B6126FBA2CD}");
const AboutAppsHomeContract = "@mozilla.org/network/protocol/about;1?what=appshome";
let AboutAppsHomeFactory = {
    createInstance: function(outer, iid) {
        if (outer != null)
            throw Components.resources.NS_ERROR_NO_AGGREGATION;
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
            require("self").data.url("home.xhtml"), null, null
        );
        channel.originalURI = aURI;
        return channel;
    }
};
//----- end about:apps (but see ComponentRegistrar call in startup())


let unloaders = [];
function startup(getUrlCB) {
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

function shutdown(data, reason)
{
    if (reason == APP_SHUTDOWN) return;
    unloaders.forEach(function(unload) unload && unload());
}

function install()
{
}

function uninstall()
{
}

exports.startup = startup;
exports.shutdown = shutdown;
