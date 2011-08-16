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
 *    Dan Walkowski <dwalkowski@mozilla.com>
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
const tabs = require("tabs");
const widgets = require("widget");
const simple = require("simple-storage");
const url = require("./urlmatch");
const HTML_NS = "http://www.w3.org/1999/xhtml";
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

let tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
let {Services} = tmp;

/* l10n support. See https://github.com/Mardak/restartless/examples/l10nDialogs */
function getString(name, args, plural) {
    let str;

    try {
        str = getString.bundle.GetStringFromName(name);
    } catch (ex1) {
        console.log("getString ex1: " + ex1);
        try {
            str = getString.fallback.GetStringFromName(name);
        } catch (ex2) {
            console.log("getString ex2: " + ex2);
        }
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
getString.init = function(getUrlCB, getAlternate) {
    if (typeof getAlternate != "function")
        getAlternate = function() "en-US";

    function getBundle(locale) {
        let propertyFile = getUrlCB("locale/" + locale + ".properties");
        try {
            let tmp = {};
            Cu.import("resource://gre/modules/Services.jsm", tmp);

            let uniqueFileSpec = propertyFile + "#" + Math.random();
            let bundle = tmp.Services.strings.createBundle(uniqueFileSpec);
            bundle.getSimpleEnumeration();
            return bundle;
        } catch (ex) {
            console.log("getString init: " + ex);
        }
        return null;
    }

    let locale = Cc["@mozilla.org/chrome/chrome-registry;1"].
        getService(Ci.nsIXULChromeRegistry).getSelectedLocale("global");
    getString.bundle = getBundle(locale) || getBundle(getAlternate(locale));
    getString.fallback = getBundle("en-US");
}


/**
 * dashboard
 *
 * the dashboard widget is created once during the addon startup.  addon sdk
 * handles adding the widget to each new window
 */
var dashboard = {
    init: function() {
        let tmp = {};
        tmp = require("./api");
        this._repo = tmp.FFRepoImplService;
    
        Services.obs.addObserver( this, "openwebapp-installed", false);
        Services.obs.addObserver( this, "openwebapp-uninstalled", false);

        let self = this;
        let data = require("self").data;
        let thePanel = require("panel").Panel({
            height: 108,
            width: 754,
            position: "topcenter bottomright",
            contentURL: data.url("panel.html"),
            contentScriptFile: [data.url("base32.js"),
                                data.url("jquery-1.4.2.min.js"),
                                data.url("panel.js") ],

            onShow: function() { self._repo.list(function(apps) {
                                 thePanel.port.emit("theList", apps);
                                });
            }
        });
        
        thePanel.port.on("getList", function(arg) {
            self._repo.list(function(apps) {
                thePanel.port.emit("theList", apps);
            });
        });
        
        thePanel.port.on("launch", function(arg) {
            self._repo.launch(arg);
            thePanel.hide();
        });

        //load and save dash state, just using a constant string for now
        thePanel.port.on("loadState", function(arg) {
          self._repo.loadState("owadock", function(state) {
            thePanel.port.emit("theState", state);
          });
        });
        
        thePanel.port.on("saveState", function(arg) {
          self._repo.saveState("owadock", arg);
        });

        this._panel = thePanel;

        this._widget = widgets.Widget({
            id: "openwebapps-toolbar-button",
            label: "Web Apps",
            width: 60,
            contentURL: require("self").data.url("widget-label.html"),
            panel: thePanel
        });
    },

    /**
     * update
     *
     * update the dashboard with any changes in the apps list
     * XXX Dashboard should just have a listener built in
     */
    update: function(show) {
        let self = this;
        self._repo.list(function(apps) {
          self._panel.port.emit("theList", apps);
        });

        if (show != undefined) {
            let WM = Cc['@mozilla.org/appshell/window-mediator;1']
                .getService(Ci.nsIWindowMediator);
            let currentDoc = WM.getMostRecentWindow("navigator:browser").document;
            var widgetAnchor = currentDoc.getElementById("widget:" + 
                                              require("self").id + "-openwebapps-toolbar-button");
    
            self._panel.show(widgetAnchor, "topcenter bottomright");
        }
      
    },
    observe: function(subject, topic, data) {
        if (topic == "openwebapp-installed") {
            data = JSON.parse(data);
            try{
               dashboard.update(!data.skipPostInstallDashboard ? 'yes': undefined);
            } catch (e) {
                console.log(e);
            }
        } else if (topic == "openwebapp-uninstalled") {
               dashboard.update();
        }
    }    
}


function openwebappsUI(win, getUrlCB, repo)
{
    this._repo = repo;
    this._window = win;
    this._getUrlCB = getUrlCB;

    /* Setup l10n */
    getString.init(getUrlCB);
    this._overlay();
    this._setupTabHandling();

    /* Offer to install */
    this._offerAppPanel = null;
    this._installInProgress = false;
}
openwebappsUI.prototype = {
    _overlay: function() {
        // Load CSS before adding toolbar butt/on
        // XXX: Seems to cause some sort of flicker?
        let doc = this._window.document;
        let pi = doc.createProcessingInstruction(
            "xml-stylesheet", "href=\"" + this._getUrlCB("skin/overlay.css") +
            "\" type=\"text/css\""
        );
        doc.insertBefore(pi, doc.firstChild);
    },

    _setupTabHandling: function() {
        // Handle the case of our special app tab being selected so we
        // can hide the URL bar etc.
        let container = this._window.gBrowser.tabContainer;
        let ss = Cc["@mozilla.org/browser/sessionstore;1"]
                    .getService(Ci.nsISessionStore);
        let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Ci.nsIWindowMediator);

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
        // unloaders.push(container.removeEventListener("TabSelect", appifyTab,
        // false);
    },

    _hideOffer: function() {
        if (this._offerAppPanel) {
          this._offerAppPanel.destroy();
          delete this._offerAppPanel;
        }
    },

    _showPageHasApp: function(page, owa) { // XX I'm not happy that I need to pass in owa here, but I need it for the purchase activity. Refactor?
        let link = simple.storage.links[page];
        if (!link.show || this._installInProgress)
            return;
    
        if (this._offerAppPanel) {
            this._offerAppPanel.destroy();
            delete this._offerAppPanel;
        }
        this._offerAppPanel = require("panel").Panel({
            height: 180,
            width: 300,
            contentURL: require("self").data.url("offer.html"),
            contentScript: 'let actions = ["yes", "no", "never"];' +
                'for (let i = 0; i < actions.length; i++) { ' +
                '   document.getElementById(actions[i]).onclick = ' +
                '       (function(i) { return function() { ' +
                '           self.port.emit(actions[i]);' +
                '       }})(i); ' +
                '}' +
                'self.port.on("setup", function(data) {'+
                'document.getElementById("store_offer").innerHTML = "";'+
                'document.getElementById("self_published").style.display = "block";'+
                'document.getElementById("store").style.display = "none";'+
                'document.getElementById("store_offer").style.display = "block";'+
                'document.getElementById("store_progress").style.display = "block";'+
                'document.getElementById("login_status").style.display = "none";'+
                '});'+
                'function renderOffer(offer) {'+
                '  var s="";'+
                '  if (offer.purchased) {' +
                '     s += "You have already purchased this application.  Reinstall now?";' +
                '  }  else { '+
                '    s += "Purchase for $" + offer.price + "?";'+
                '  }'+
                '  document.getElementById("store_offer").innerHTML = s;'+
                '  document.getElementById("store_offer").style.display = "block";'+
                '  document.getElementById("store_progress").style.display = "none";'+
                ' '+
                '  var acct="";'+
                '  if (offer.account) {'+
                '    acct = "Logged in to " + offer.storeName + " as <i>" + offer.account + "</i>";'+
                '  } else {'+
                '    acct = "You will be asked to log in to " + offer.storeName + " if you install.";'+
                '  }'+
                '  document.getElementById("login_status").innerHTML = acct;'+
                '  document.getElementById("login_status").style.display = "block";'+
                '}'+
                'self.port.on("store", function(data) {'+
                '  document.getElementById("self_published").style.display="none";' +
                '  document.getElementById("store").style.display="block";' +
                '  if (data.offer) { renderOffer(data.offer) };' +
                '});'
        });

        /* Setup callbacks */
        let self = this;
        this._offerAppPanel.port.emit("setup", {});

        this._offerAppPanel.port.on("yes", function() {
            dump("APPS | ui.showPageHasApp.onYes | User clicked Yes\n");
            self._installInProgress = true;
            
            if (link.offer) {
              dump("APPS | ui.showPageHasApp.onYes | There's an offer\n");
              // If there is a store offer, we have a more complicated flow.

              if (link.offer.account) {
                dump("APPS | ui.showPageHasApp.onYes | The user is logged in\n");
                // The store thinks the user is logged in; let's go ahead and
                // try to perform the purchase.  We might still end up needing
                // to send the user to a landing page.
            
                let domain = url.URLParse(page);
                domain = domain.normalize().originOnly().toString();
                self._offerAppPanel.hide();
                owa.performPurchaseActivity(link.store, domain, function(result) {
                  self._installInProgress = false;
                });
                
              } else {
                // The store doesn't think the user is logged in; an authentication
                // will be required.  Just send the user off to the store's
                // indicated landing page.
                if (link.offer.purchaseURL) {
                  dump("APPS | ui.showPageHasApp.onYes | The user is not logged in, but there's a purchaseURL - creating new tab\n");
                  
                  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                          .getService(Ci.nsIWindowMediator);
                  let recentWindow = wm.getMostRecentWindow("navigator:browser");
                  if (recentWindow) {
                    let tab = recentWindow.gBrowser.addTab(link.offer.purchaseURL);
                    recentWindow.gBrowser.selectedTab = tab;
                    link.purchaseTab = tab;
                  }
                } else {
                  dump("APPS | ui.showPageHasApp.onYes | The user is not logged in, and there is no purchaseURL - we're done\n");
                }
                self._installInProgress = false;                
              }
            
            
            } else {
              // Otherwise it's self-published; go ahead and install it.
              dump("APPS | ui.showPageHasApp.onYes | No offer; go ahead and install\n");
              try {
                self._offerAppPanel.hide();
                self._repo.install(
                    "chrome://openwebapps", {
                        _autoInstall: true,
                        url: link.url,
                        origin: page,
                        onsuccess: function() {
                            self._installInProgress = false;
                            //simple.storage.links[page].show = false;
							//if i just installed the app, i want it to become an app!
							//pass in the current URL in case i notice the popup while in deep content
							let tab = tabs.activeTab
							let taburl = tab.url;
							self._repo.launch(page, taburl);
							let timers = require("timers");
							let closeTab = function() {
								if (tabs.length > 1) {
									tab.close();
								} else {
									timers.setTimeout(closeTab, 100);
								}
							}
							closeTab();
                        },
                        onerror: function(res) {
                          console.log("An error occured while attempting to install an application: " + JSON.stringify(res));
                          self._installInProgress = false;
                        }
                    }, self._window
                );
              } catch (e) {
                console.log("An error occured while attempting to install an application: " + e);
                self._installInProgress = false;
              }
            }
        });
        this._offerAppPanel.port.on("no", function() {
            self._offerAppPanel.hide();
        });
        this._offerAppPanel.port.on("never", function() {
            self._offerAppPanel.hide();
            simple.storage.links[page].show = false; 
        });

        /* Prepare to anchor panel to apps widget */
        let WM = Cc['@mozilla.org/appshell/window-mediator;1']
            .getService(Ci.nsIWindowMediator);
        let doc = WM.getMostRecentWindow("navigator:browser").document;
        let bar = doc.getElementById("widget:" + 
            require("self").id + "-openwebapps-toolbar-button");

        this._offerAppPanel.show(bar);

        if (link.store) {
          this._offerAppPanel.port.emit("store", {store:link.store, offer:link.offer});
        }
    },
    
    _showPageHasStoreApp: function(page, store) {
        let link = simple.storage.links[page];
        if (!link.show || this._installInProgress)
            return;
        if (this._offerAppPanel)
        {
          this._offerAppPanel.port.emit("store", {store:link.store, offer:link.offer});
        }
      
    }
};

exports.openwebappsUI = openwebappsUI;
exports.dashboard = dashboard;
