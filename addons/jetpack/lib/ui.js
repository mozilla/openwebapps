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

function openwebappsUI(win, getUrlCB, repo)
{
    this._repo = repo;
    this._window = win;
    this._getUrlCB = getUrlCB;

    /* Setup l10n */
    getString.init(getUrlCB);
    this._overlay();
    this._setupTabHandling();
}
openwebappsUI.prototype = {
    _overlay: function() {
        // Load CSS before adding toolbar button
        // XXX: Seems to cause some sort of flicker?
        let doc = this._window.document;
        let pi = doc.createProcessingInstruction(
            "xml-stylesheet", "href=\"" + this._getUrlCB("skin/overlay.css") +
            "\" type=\"text/css\""
        );
        doc.insertBefore(pi, doc.firstChild);

        tmp = require("./panel");
        this._addToolbarButton();
        this._popup = new tmp.appPopup(this._window);
        this._addDock();
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

    _addToolbarButton: function() {
        let self = this;
        let doc = this._window.document;
        let buttonId = "openwebapps-toolbar-button";

        // Don't add a toolbar button if one is already present
        if (doc.getElementById(buttonId))
            return;
        
        // TODO: make into a generic toolbar button module
        let button = doc.createElementNS(XUL_NS, "toolbarbutton");
        let toolbox = doc.getElementById("navigator-toolbox");
        let palette = doc.getElementById("BrowserToolbarPalette") ||
            toolbox.palette;

        button.setAttribute("id", buttonId);
        button.setAttribute("label",
            getString("openwebappsToolbarButton.label"));
        button.setAttribute("tooltipText",
            getString("openwebappsToolbarButton.tooltip"));
        button.setAttribute("class",
            "toolbarbutton-1 chromeclass-toolbar-additional");
        button.onclick = function() { self._toggleDock(); };

        // Move to location at end
        let toolbar = doc.getElementById("nav-bar");
        toolbar.appendChild(button);
        
        // FIXME: this will probably not be called because of jetpack
        // unloaders.push(function() toolbar.removeChild(button));
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
        } catch (e) {}
        navigatorToolbox.parentNode.insertBefore(dock, navigatorToolbox);

        // FIXME: this will probably not be called because of jetpack
        // unloaders.push(function() navigatorToolbox.parentNode.removeChild(dock));
    },
    
    _renderDockIcons: function(recentlyInstalledAppKey) {
      let self = this;
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
    }
};

exports.openwebappsUI = openwebappsUI;
