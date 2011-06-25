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
const widgets = require("widget");
const simple = require("simple-storage");
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

        this._addToolbarButton();
//         this._addDock();
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
        let data = require("self").data;
        let thePanel = require("panel").Panel({
          height: 130,
          width: 800,
          contentURL: data.url("panel.html"),
          contentScriptFile: [data.url("base32.js"),
                              data.url("jquery-1.4.2.min.js"),
                              data.url("panel.js") ],
                              
          onShow: function() { self._repo.list(function(apps) {
                                thePanel.port.emit("theList", apps);
                                }); },
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

        widgets.Widget({
        id: "openwebapps-toolbar-button",
        label: "Web Apps",
        width: 60,
        contentURL: require("self").data.url("widget-label.html"),
        panel: thePanel,
        });
          
        self._panel = thePanel;
    },


  _updateDashboard: function(show) {
    let self = this;
    self._repo.list(function(apps) {
      self._panel.port.emit("theList", apps);
    });
      
    let WM = Cc['@mozilla.org/appshell/window-mediator;1']
            .getService(Ci.nsIWindowMediator);
    let currentDoc = WM.getMostRecentWindow("navigator:browser").document;
    var widgetAnchor = currentDoc.getElementById("widget:" + 
                                          require("self").id + "-openwebapps-toolbar-button");

    if (show != undefined) {
      self._panel.show(widgetAnchor);
    }
  
  },

//     _addDock: function() {
//         let self = this;
// 
//         // We will add an hbox before navigator-toolbox;
//         // this should put it above all the tabs.
//         let targetID = "addon-bar";
//         let mergePoint = this._window.document.getElementById(targetID);
//         if (!mergePoint) return;
//         
//         let dock = this._window.document.createElement("hbox");
//         dock.collapsed = true;
//         //dock.height = "90px";
//         dock.style.borderTop = "0.1em solid black";
// 
//         dock.style.background = "-moz-linear-gradient(15% 0% 270deg,#8A8A8A, #E0E0E0, #E0E0E0 15%,#F8F8F8 85%)"
//         
//         self._dock = dock;
//         try {
//           self._renderDockIcons();
//         } catch (e) { }
//         
//         mergePoint.parentNode.insertBefore(dock, mergePoint);
// 
//         // FIXME: this will probably not be called because of jetpack
//         // unloaders.push(function() mergePoint.parentNode.removeChild(dock));
//     },
//     
//     _renderDockIcons: function(recentlyInstalledAppKey) {
//       let self= this;
//       while (this._dock.firstChild) {
//         this._dock.removeChild(this._dock.firstChild);
//       }
//       
//       this._repo.list(function(apps) {
// 
//         function getBiggestIcon(minifest) {
//             // XXX this should really look for icon that is closest to 48 pixels.
//             // see if the minifest has any icons, and if so, return the largest one
//             if (minifest.icons) {
//                 let biggest = 0;
//                 for (z in minifest.icons) {
//                     let size = parseInt(z, 10);
//                     if (size > biggest) biggest = size;
//                 }
//                 if (biggest !== 0) return minifest.icons[biggest];
//             }
//             return null;
//         }
// 
//         for (let k in apps) {
//             //let appBox = self._window.document.createElementNS(HTML_NS, "div");
//             let appBox = self._window.document.createElement("vbox");
// 
//             appBox.style.width = "100px";
//             appBox.style.height = "90px";
// 
// 
//             //let icon = self._window.document.createElementNS(HTML_NS, "div");
//             let icon = self._window.document.createElement("image");
// 
//             if (apps[k].manifest.icons) {
//                 let iconData = getBiggestIcon(apps[k].manifest);
//                 if (iconData) {
//                     if (iconData.indexOf("data:") == 0) {
//                         icon.setAttribute("src", iconData);
//                     } else {
//                         icon.setAttribute("src", k + iconData);
// 
//                     }
//                 } else {
//                     // default
//                 }
//             } else {
//                 // default
//             }
// 
//             icon.style.width = "64px";
//             icon.style.height = "64px";
//             icon.style.margin = "18px";
//             icon.style.marginBottom = "2px";
//             icon.style.marginTop = "6px";
//             icon.style.border = "4px solid rgba(30,150,45,0.4)";
//             icon.style.borderRadius = "8px";
//             icon.style.backgroundColor = "white";
// 
//             icon.onmouseover = (function() { icon.style.border = "4px solid rgba(30,255,45,1)"; } );
//             icon.onmouseout = (function() { icon.style.border = "4px solid rgba(30,150,45,0.4)"; } );
//             
//             let key = k;
//             icon.onclick = (function() {
//                 return function() { 
//                     self._repo.launch(key); 
//                     self._hideDock();
//                 }
//             })();
//              
//             let label = self._window.document.createElement("label");
//             label.style.width = "90px";
//             
//             label.style.font = "bold 12px Helvetica,Arial,sans-serif";
//             label.style.color = "444444";
//             label.style.overflow = "hidden";
//             label.style.textShadow = "#dddddd 1px 1px, #dddddd -1px -1px, #dddddd -1px 1px, #dddddd 1px -1px";
//             label.style.textAlign = "center";
//             label.style.marginBottom = "6px";
//             
//             label.appendChild(
//                 self._window.document.createTextNode(apps[k].manifest.name)
//             );
//             
// 
//             appBox.appendChild(icon);
//             appBox.appendChild(label);
// 
//             // added by Ben because we're getting multiple calls in separate
//             // threads to this, and it's causing duplication of icon rendering
//             // (see specifically the twitter.com example with faker turned on.)
//             // the right solution is probably not this, but for now this will do.
//             while (self._dock.firstChild) {
//                 self._dock.removeChild(self._dock.firstChild);
//             }
// 
//             self._dock.appendChild(appBox);
//         }
//       });
//     },
// 
//     _toggleDock: function() {
//         if (this._dock.collapsed) {
//             this._showDock();
//         } else {
//             this._hideDock();
//         }
//     },
//     _showDock: function() {
//         //this._dock.style.display ="block";
//        //this._dock.collapsed = false;
//        console.log("SHOW PANEL");
//        this.panel.show();
//     },
//     _hideDock: function() {
//         //this._dock.style.display ="none";
//         //this._dock.collapsed = true;
//         this.panel.hide();
//     },

    _hideOffer: function() {
        if (this._offerAppPanel && this._offerAppPanel.isShowing)
            this._offerAppPanel.hide();
    },

    _showPageHasApp: function(page) {
        let link = simple.storage.links[page];
        if (!link.show || this._installInProgress)
            return;
    
        if (!this._offerAppPanel) {
            this._offerAppPanel = require("panel").Panel({
                contentURL: require("self").data.url("offer.html"),
                contentScript: 'let actions = ["yes", "no", "never"];' +
                    'for (let i = 0; i < actions.length; i++) { ' +
                    '   document.getElementById(actions[i]).onclick = ' +
                    '       (function(i) { return function() { ' +
                    '           self.port.emit(actions[i]);' +
                    '       }})(i); ' +
                    '}'
            });
        }
        if (this._offerAppPanel.isShowing) return;

        /* Setup callbacks */
        let self = this;
        this._offerAppPanel.port.on("yes", function() {
            self._installInProgress = true;
            self._offerAppPanel.hide();
            self._repo.install(
                "chrome://openwebapps", {
                    _autoInstall: true,
                    url: link.url,
                    origin: page,
                    onsuccess: function() {
                        self._installInProgress = false;
                        //simple.storage.links[page].show = false;
                    }
                }, self._window
            );
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
    }
};

exports.openwebappsUI = openwebappsUI;
