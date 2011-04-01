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

const {manager: Cm, classes: Cc, interfaces: Ci, utils: Cu} = Components;
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const HTML_NS = "http://www.w3.org/1999/xhtml";

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

/* l10n support. See https://github.com/Mardak/restartless/examples/l10nDialogs */
function getString(name, args, plural) {
    let str;
    try {
        str = getString.bundle.GetStringFromName(name);
    } catch(ex) {
        str = getString.fallback.GetStringFromName(name);
    }
    if (args != null) {
        if (typeof args == "string" || args.length == null)
            args = [args];
        str = str.replace(/%s/gi, args[0]);
        Array.forEach(args, function(replacement, index) {
            str = str.replace(RegExp("%" + (index + 1) + "\\$S", "gi"), replacement);
        });
    }
    return str;
}
getString.init = function(addon, getAlternate) {
    if (typeof getAlternate != "function")
        getAlternate = function() "en-US";

    function getBundle(locale) {
        let propertyPath = "chrome/locale/" + locale + ".properties";
        let propertyFile = addon.getResourceURI(propertyPath);
        try {
            let uniqueFileSpec = propertyFile.spec + "#" + Math.random();
            let bundle = Services.strings.createBundle(uniqueFileSpec);
            bundle.getSimpleEnumeration();
            return bundle;
        } catch(ex) {}
        return null;
    }

    let locale = Cc["@mozilla.org/chrome/chrome-registry;1"].
        getService(Ci.nsIXULChromeRegistry).getSelectedLocale("global");
    getString.bundle = getBundle(locale) || getBundle(getAlternate(locale));
    getString.fallback = getBundle("en-US");
}

function openwebapps(win, add)
{
    this._addon = add;
    this._window = win;

    Cc["@mozilla.org/observer-service;1"]
      .getService(Ci.nsIObserverService)
          .addObserver( this, "openwebapp-installed", false);
    Cc["@mozilla.org/observer-service;1"]
      .getService(Ci.nsIObserverService)
          .addObserver( this, "openwebapp-uninstalled", false);
    
    // Hang on, the window may not be fully loaded yet
    let self = this;
    function checkWindow()
    {
        if (!win.document.getElementById("nav-bar")) {
            let timeout = win.setTimeout(checkWindow, 1000);
            unloaders.push(function() win.clearTimeout(timeout));
        } else {
            let uri = self._addon.getResourceURI("chrome/content/overlay.xul").spec;
            win.document.loadOverlay(uri, self);
        }
    }
    checkWindow();
}

openwebapps.prototype = {
    _addToolbarButton: function() {
        let self = this;
        
        // Don't add a toolbar button if one is already present
        if (this._window.document.getElementById("openwebapps-toolbar-button"))
            return;
        
        // We clone an existing button, creating a new one from scratch
        // does not work (are we missing some properties?)
        let toolbox = this._window.document.getElementById("nav-bar");
        let homeButton = this._window.document.getElementById("home-button");
        let button = homeButton.cloneNode(false);

        button.id = "openwebapps-toolbar-button";
        button.label = getString("openwebappsToolbarButton.label");
        button.tooltipText = getString("openwebappsToolbarButton.tooltip");

        /* Reset click handlers */
        button.ondragexit = button.aboutHomeOverrideTooltip = null;
        button.ondragover = button.ondragenter = button.ondrop = null;
        // button.onclick = function() { self._togglePopup(); };
        button.onclick = function() { self._toggleDock(); };

        toolbox.appendChild(button);
        unloaders.push(function() toolbox.removeChild(button));
    },

    _addDock: function() {
        let self = this;

        // We will add an hbox before navigator-toolbox;
        // this should put it above all the tabs.
        let targetID = "navigator-toolbox";
        let navigatorToolbox = this._window.document.getElementById(targetID);
        if (!navigatorToolbox) return;
        
        let dock = this._window.document.createElementNS(HTML_NS, "div");
        dock.style.display = "none";
        dock.width = "100%";
        dock.height = "80px";
        dock.style.backgroundColor = "rgba(0,0,0,0.3)";
        
        self._dock = dock;
        try {
          self._renderDockIcons();
        } catch (e) {
          dump(e + "\n");
          dump(e.stack + "\n");
        }
        navigatorToolbox.parentNode.insertBefore(dock, navigatorToolbox);
        unloaders.push(function() navigatorToolbox.parentNode.removeChild(dock));
    },
    
    _renderDockIcons: function(recentlyInstalledAppKey) {
      let self= this;
      while (this._dock.firstChild) {
        this._dock.removeChild(this._dock.firstChild);
      }
      
      this._repo.list(function(apps) {

        function getBiggestIcon(minifest) {
            // XXX this should really look for icon that is closest to 48 pixels.
            // see if the minifest has any icons, and if so, return the largest one
            if (minifest.icons) {
                let biggest = 0;
                for (z in minifest.icons) {
                    let size = parseInt(z, 10);
                    if (size > biggest) biggest = size;
                }
                if (biggest !== 0) return minifest.icons[biggest];
            }
            return null;
        }

        for (let k in apps) {
            let appBox = self._window.document.createElementNS(HTML_NS, "div");
            appBox.style.display = "inline-block";
            appBox.style.width = "72px";
            appBox.style.height = "100%";

            if (k == recentlyInstalledAppKey) {
                appBox.style.boxShadow = "0 0 1em gold";
            }

            let icon = self._window.document.createElementNS(HTML_NS, "div");
            if (apps[k].manifest.icons) {
                let iconData = getBiggestIcon(apps[k].manifest);
                if (iconData) {
                    if (iconData.indexOf("data:") == 0) {
                        icon.style.backgroundImage = "url(" + iconData + ")";
                    } else {
                        icon.style.backgroundImage = "url(" + k + iconData + ")";              
                    }
                } else {
                    // default
                }
            } else {
                // default
            }
            icon.style.backgroundSize = "cover";
            icon.style.width = "48px";
            icon.style.height = "48px";
            icon.style.marginLeft = "12px";
            
            let label = self._window.document.createElementNS(XUL_NS, "label");
            label.style.width = "62px";
            
            // Setting text color is tricky because a persona may make it
            // unreadable. We optimize for default skin.
            label.style.font = "bold 9px Helvetica,Arial,sans-serif";
            label.style.color = "black";
            label.style.textAlign = "center";
            label.appendChild(
                self._window.document.createTextNode(apps[k].manifest.name)
            );

            let key = k;
            appBox.onclick = (function() {
                return function() { 
                    self._repo.launch(key); 
                    self._hideDock();
                }
            })();

            appBox.appendChild(icon);
            appBox.appendChild(label);
            self._dock.appendChild(appBox);
        }
      });
    },

    _toggleDock: function() {
        if (this._dock.style.display == "none") {
            this._showDock();
        } else {
            this._hideDock();
        }
    },
    _showDock: function() {
        let aDock = this._dock;
        let self = this;
        aDock.style.height = "66px";
        aDock.height ="66px";
        aDock.style.display ="block";
    },
    _hideDock: function() {
        this._dock.style.display ="none";
        this._dock.height = "0px";
    },
    
    _togglePopup: function() {
        // Set up the current-app state:
        this._repo.setCurrentPageAppURL(
            this._window.gBrowser.contentDocument.applicationManifest
        );
        this._popup.toggle();
    },
    
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
            Cu.import("resource://openwebapps/modules/sync.js", tmp);
            tmp.Weave.Engines.register(tmp.AppsEngine);
            
            let prefname = "services.sync.engine.apps";
            if (Services.prefs.getPrefType(prefname) ==
                Ci.nsIPrefBranch.PREF_INVALID) {
                Services.prefs.setBoolPref(prefname, true);    
            }
            
            unloaders.push(function() {
                tmp.Weave.Engines.unregister(tmp.AppsEngine)
            });
        }
        
        if (topic == "xul-overlay-merged") {
            let tmp = {};
            Cu.import("resource://openwebapps/modules/injector.js", tmp);
            tmp.InjectorInit(this._window); tmp = {};
            Cu.import("resource://openwebapps/modules/api.js", tmp);
            this._repo = tmp.FFRepoImplService; tmp = {};
            Cu.import("resource://openwebapps/modules/panel.js", tmp);
            
            this._inject();
            this._addToolbarButton();
            this._popup = new tmp.appPopup(this._window);
            this._addDock();

            tmp = {};
            Cu.import("resource://openwebapps/modules/services.js", tmp);
            this._services = new tmp.serviceInvocationHandler(this._window);

            tmp = {};
            Cu.import("resource://services-sync/main.js", tmp);
            if (tmp.Weave.Status.ready) {
                registerSyncEngine();
            } else {
                Cu.import("resource://services-sync/util.js");
                Svc.Obs.add("weave:service:ready", this);
            }
            
            if (this.pendingRegistrations) {
              dump("I'm about to handle pending registrations\n");
              for each (let reg in this.pendingRegistrations) {
                this._repo._registerBuiltInApp(reg[0], reg[1], reg[2]);
              }
              this.pendingRegistrations = null;
              dump("I just did pending registrations\n");
            }
            
        } else if (topic == "weave:service:ready") {
            registerSyncEngine();
        } else if (topic == "openwebapp-installed") {
            this._renderDockIcons(data);
            this._showDock();
        
        } else if (topic == "openwebapp-uninstalled") {
            this._renderDockIcons();
        } 
    },
    
    registerBuiltInApp: function(domain, app, injector) {
        if (!this._repo) {
            if (!this.pendingRegistrations) this.pendingRegistrations = [];
            //dump("Pushing a builtin\n");
            this.pendingRegistrations.push( [domain, app, injector] );
        } else{
            //dump("Registering a builtin\n");
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
          "resource://openwebapps/chrome/content/about.html", null, null
      );

      channel.originalURI = aURI;
      return channel;
  }
};
//----- end about:apps (but see ComponentRegistrar call in startup())


let unloaders = [];
function startup(data, reason) AddonManager.getAddonByID(data.id, function(addon) {
    /* Let's register ourselves a resource: namespace */
    let resource = Services.io.getProtocolHandler("resource")
                   .QueryInterface(Ci.nsIResProtocolHandler);
    let alias = Services.io.newFileURI(data.installPath);
    if (!data.installPath.isDirectory())
        alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);
    resource.setSubstitution("openwebapps", alias);

    /* Setup l10n */
    getString.init(addon);
    
    /* We use winWatcher to create an instance per window (current and future) */
    let iter = Cc["@mozilla.org/appshell/window-mediator;1"]
               .getService(Ci.nsIWindowMediator)
               .getEnumerator("navigator:browser");
    while (iter.hasMoreElements()) {
        var aWindow = iter.getNext().QueryInterface(Ci.nsIDOMWindow);
        aWindow.apps = new openwebapps(aWindow, addon);
    }
    function winWatcher(subject, topic) {
        if (topic != "domwindowopened")
            return;
        subject.addEventListener("load", function() {
            subject.removeEventListener("load", arguments.callee, false);
            let doc = subject.document.documentElement;
            if (doc.getAttribute("windowtype") == "navigator:browser") {
                subject.apps = new openwebapps(subject, addon);
            }
        }, false);
    }
    Services.ww.registerNotification(winWatcher);
    unloaders.push(function() Services.ww.unregisterNotification(winWatcher));

    //XX unload about on exit!
    Cm.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
        AboutAppsUUID, "About Apps", AboutAppsContract, AboutAppsFactory
    );

    // Broadcast that we're done, in case anybody is listening
    let observerService = Cc["@mozilla.org/observer-service;1"]
               .getService(Ci.nsIObserverService);
    let tmp = {};
    Cu.import("resource://openwebapps/modules/api.js", tmp);
    observerService.notifyObservers(tmp.FFRepoImplService, "openwebapps-startup-complete", "");
})

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
