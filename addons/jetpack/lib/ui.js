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


// XXX demo code warning!  code in this file is for demo purposes only.  it provides UI elements to make
// demo's easy, but this will all be replaced by html based dashboards, and proper store integration when
// the store is available.  DO NOT place any code intended to be permenant in this file!  If any of this
// code does survive, it will need some refactoring and cleanup.


const { Cc, Ci, Cm, Cu } = require("chrome");
const tabs = require("tabs");
const widgets = require("widget");
const simple = require("simple-storage");
const url = require("./urlmatch");
const HTML_NS = "http://www.w3.org/1999/xhtml";
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

let tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
let { Services } = tmp;

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
    if (typeof args == "string" || args.length == null) args = [args];
    str = str.replace(/%s/gi, args[0]);
    Array.forEach(args, function(replacement, index) {
      str = str.replace(RegExp("%" + (index + 1) + "\\$S", "gi"), replacement);
    });
  }
  return str;
}
getString.init = function(getUrlCB, getAlternate) {
  if (typeof getAlternate != "function") getAlternate = function()"en-US";

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
 *
 *
 * XXX DELETE this, the builtin demo dashboard will not be used
 */
var dashboard = {
  init: function() {
    if (this._panel) return;

    let tmp = {};
    tmp = require("./api");
    this._repo = tmp.FFRepoImplService;

    Services.obs.addObserver(this, "openwebapp-installed", false);
    Services.obs.addObserver(this, "openwebapp-uninstalled", false);

    let self = this;
    let data = require("self").data;
    let thePanel = require("panel").Panel({
      height: 108,
      width: 754,
      position: "topcenter bottomright",
      contentURL: data.url("panel.html"),
      contentScriptFile: [data.url("base32.js"), data.url("jquery-1.4.2.min.js"), data.url("panel.js")],

      onShow: function() {
        self._repo.list(function(apps) {
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
      let WM = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
      let currentDoc = WM.getMostRecentWindow("navigator:browser").document;
      var widgetAnchor = currentDoc.getElementById("widget:" + require("self").id + "-openwebapps-toolbar-button");

      self._panel.show(widgetAnchor, "topcenter bottomright");
    }

  },
  observe: function(subject, topic, data) {
    if (topic == "openwebapp-installed") {
      data = JSON.parse(data);
      try {
        dashboard.update(!data.skipPostInstallDashboard ? 'yes' : undefined);
      } catch (e) {
        console.log(e);
      }
    } else if (topic == "openwebapp-uninstalled") {
      dashboard.update();
    }
  }
}

function openwebappsUI(win, getUrlCB, owa) {
  this._repo = owa._repo;
  this._window = win;
  this._getUrlCB = getUrlCB;

  /* Setup l10n */
  getString.init(getUrlCB);
  this._overlay();

  /* init the dashboard and offer panel for demo purposes */
  this.offerPanel = new OfferPanel(owa);
  dashboard.init();
}
openwebappsUI.prototype = {
  _overlay: function() {
    // Load CSS before adding toolbar butt/on
    // XXX: Seems to cause some sort of flicker?
    let doc = this._window.document;
    let pi = doc.createProcessingInstruction("xml-stylesheet", "href=\"" + this._getUrlCB("skin/overlay.css") + "\" type=\"text/css\"");
    doc.insertBefore(pi, doc.firstChild);
  }
};


// XXX DELETE this, the builtin demo dashboard will not be used
// however, we will hold onto the offer panel for demo purposes until we have finished the store and integration with it
function OfferPanel(owa) {
  this._window = owa._window;
  this._repo = owa._repo;
  this._services = owa._services;
  
  Services.obs.addObserver(this, "content-document-global-created", false);

  // Prompt user if we detect that the page has an app via tabs module
  let self = this;
  tabs.on('activate', function(tab) {
    // If user switches tab via keyboard shortcuts, it does not dismiss
    // the offer panel (clicking does); so hide it if present
    self.hide();

    let cUrl = url.URLParse(tab.url).originOnly().toString();
    let record = simple.storage.links[cUrl];
    dump("APPS | onTabActivate | Checking url " + cUrl + " - found stored record " + JSON.stringify(record) + "\n");
    if (record) self.installIfNeeded(cUrl);
  });
}
OfferPanel.prototype = {
  /* Offer to install */
  _offerAppPanel: null,
  _installInProgress: false,
  _repo: null,
  _services: null,
  // Keep an eye out for LINK headers that contain manifests:
  _linkListenerAttached: false,

  // TODO: Don't be so annoying and display the offer everytime the app site
  // is visited. If the user says 'no', don't display again for the session
  installIfNeeded: function(origin) {
    let self = this;
    this._repo.getAppByUrl(origin, function(app) {
      if (!app) self.show(origin);
    });
  },

  hide: function() {
    if (this._offerAppPanel) {
      this._offerAppPanel.destroy();
      delete this._offerAppPanel;
    }
  },

  show: function(page) { // XX I'm not happy that I need to pass in owa here, but I need it for the purchase activity. Refactor?
    let link = simple.storage.links[page];
    if (!link.show || this._installInProgress) return;

    this.hide();
    this._offerAppPanel = require("panel").Panel({
      height: 180,
      width: 300,
      contentURL: require("self").data.url("offer.html"),
      contentScriptFile:  require("self").data.url("offer.js")
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
          self.performPurchaseActivity(link.store, domain, function(result) {
            self._installInProgress = false;
          });

        } else {
          // The store doesn't think the user is logged in; an authentication
          // will be required.  Just send the user off to the store's
          // indicated landing page.
          if (link.offer.purchaseURL) {
            dump("APPS | ui.showPageHasApp.onYes | The user is not logged in, but there's a purchaseURL - creating new tab\n");

            let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
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
          self._repo.install("chrome://openwebapps", {
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
          }, self._window);
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
    let WM = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
    let doc = WM.getMostRecentWindow("navigator:browser").document;
    let bar = doc.getElementById('identity-box');

    this._offerAppPanel.show(bar);

    if (link.store) {
      this._offerAppPanel.port.emit("store", {
        store: link.store,
        offer: link.offer
      });
    }
  },

  showPageHasStoreApp: function(page) {
    let link = simple.storage.links[page];
    if (!link.show || this._installInProgress) return;
    if (this._offerAppPanel) {
      this._offerAppPanel.port.emit("store", {
        store: link.store,
        offer: link.offer
      });
    }
  },

  observe: function(subject, topic, data) {
    if (topic == "content-document-global-created") {

      let mainWindow = subject.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIDocShellTreeItem).rootTreeItem.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);

      let self = this;
      if (this._window != mainWindow) { // exclude other windows
        return;
      }
      if (subject != this._window.content) { //exclude jetpack panels and iframes
        return;
      }
      if (self._linkListenerAttached) { // don't fire more than once
        return;
      }

      let linkHandler = function(aEvent) {
        // Links could come in any order!  Be ready for that.
        if (aEvent.target.rel == "application-manifest" || aEvent.target.rel == "application-preferred-store") {
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

          if (cUrl == page) {
            if (aEvent.target.rel == "application-manifest") {
              self._ui.offerPanel.installIfNeeded(page);
            } else if (aEvent.target.rel == "application-preferred-store") {
              // TODO do nothing if we're installed already
              // let the UI know we've got a store here
              simple.storage.links[page].store = href;
              self._ui.offerPanel.showPageHasStoreApp(page);

              // create a hidden iframe to talk to the store:
              let doc = self._window.document;
              let XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
              let xulPanel = doc.createElementNS(XUL_NS, "panel");
              xulPanel.setAttribute("type", "arrow"); // <-- this is mandatory.  why??
              let frame = doc.createElementNS(XUL_NS, "browser");
              frame.setAttribute("type", "content");
              xulPanel.appendChild(frame);
              doc.getElementById("mainPopupSet").appendChild(xulPanel);
              frame.setAttribute("src", href);
              xulPanel.sizeTo(0, 0);

              frame.addEventListener("DOMContentLoaded", function(event) {
                // and ask the store for details:
                self._services.invokeService(frame.contentWindow.wrappedJSObject, "appstore", "getOffer", {
                  domain: cUrl
                }, function(result) {
                  //dump("APPS | appstore.getOffer service | Got getOffer result for " + page + ": " + JSON.stringify(result) + "\n");
                  simple.storage.links[page].offer = result;
                  self._ui._showPageHasStoreApp(page, self);
                }, true /* is privileged */ );
              }, false);
            }
          }
        }
      };
      mainWindow.addEventListener("DOMLinkAdded", linkHandler, false);
      self._linkListenerAttached = true;
    }
  },

  performPurchaseActivity: function(store, domain, cb) {
    let self = this;

    // HACK: This is really kind of gross, I don't want to have to do this here.
    // create a hidden iframe to talk to the store:
    let doc = self._window.document;
    let XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    let xulPanel = doc.createElementNS(XUL_NS, "panel");
    xulPanel.setAttribute("type", "arrow"); // <-- this is mandatory.  why??
    let frame = doc.createElementNS(XUL_NS, "browser");
    frame.setAttribute("type", "content");
    xulPanel.appendChild(frame);
    doc.getElementById("mainPopupSet").appendChild(xulPanel);
    frame.setAttribute("src", store);
    xulPanel.sizeTo(0, 0);

    frame.addEventListener("DOMContentLoaded", function(event) {
      // and ask the store for details:
      self._services.invokeService(frame.contentWindow.wrappedJSObject, "appstore", "purchase", {
        domain: domain
      }, function(result) {
        dump("APPS | performPurchaseActivity | Purchase completed - result is " + result);
        cb(result);
      }, true /* is privileged */ );
    }, false);
  }

}

exports.openwebappsUI = openwebappsUI;
