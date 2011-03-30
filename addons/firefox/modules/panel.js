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
 * The Original Code is Open Web Apps.
 *
 * Contributor(s):
 *   Anant Narayanan <anant@kix.in>
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
 
const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;
Cu.import("resource://openwebapps/modules/api.js");

function openAndReuseOneTabPerURL(url) {
  var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
  var browserEnumerator = wm.getEnumerator("navigator:browser");

  // Check each browser instance for our URL
  var found = false;
  while (!found && browserEnumerator.hasMoreElements()) {
    var browserWin = browserEnumerator.getNext();
    var tabbrowser = browserWin.gBrowser;

    // Check each tab of this browser instance
    var numTabs = tabbrowser.browsers.length;
    for (var index = 0; index < numTabs; index++) {
      var currentBrowser = tabbrowser.getBrowserAtIndex(index);
      if (url == currentBrowser.currentURI.spec) {

        // The URL is already opened. Select this tab.
        tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];

        // Focus *this* browser-window
        browserWin.focus();

        found = true;
        break;
      }
    }
  }

  // Our URL isn't open. Open it now.
  if (!found) {
    var recentWindow = wm.getMostRecentWindow("navigator:browser");
    if (recentWindow) {
      // Use an existing browser window
      recentWindow.delayedOpenTab(url, null, null, null, null);
    }
    else {
      // No browser windows are open, so open a new one.
      window.open(url);
    }
  }
}


function appPopup(win)
{
    this._window = win;
    
    // Create the panel
    let doc = win.document;
    let XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    let xulPanel = doc.createElementNS(XUL_NS, "panel");
    xulPanel.setAttribute("type", "arrow");

    let frame = doc.createElementNS(XUL_NS, "iframe");
    frame.setAttribute("src", "resource://openwebapps/chrome/content/popup.html");
    xulPanel.appendChild(frame);
    doc.getElementById("mainPopupSet").appendChild(xulPanel);
    
    this._frame = frame;
    this._panel = xulPanel;
    this._button = doc.getElementById("openwebapps-toolbar-button");
}
appPopup.prototype = {
    _elem: function(type, clazz) {
        let e = this._frame.contentDocument.createElement(type);
        if (clazz) e.setAttribute("class", clazz);
        return e;
    },
    
    _getBiggestIcon: function(minifest) {
        // see if the minifest has any icons, and if so, return the largest one
        if (minifest.icons) {
            let biggest = 0;
            for (let z in minifest.icons) {
                let size = parseInt(z, 10);
                if (size > biggest) biggest = size;
            }
            if (biggest !== 0) return minifest.icons[biggest];
        }
        return null;
    },
    
    _createAppIcon: function(installRecord) {
        let app = installRecord.manifest;
        let appContainer = this._elem("div", "app");
        let clickyIcon = this._elem("div", "icon");
        let iconImg = this._getBiggestIcon(app);
        
        if (iconImg) {
          let iconUrl;
          if (!iconImg.indexOf("data:") == 0) {
            iconUrl = installRecord.origin + iconImg;
          } else {
            iconUrl = iconImg;
          }
            clickyIcon.style.background = "url(\"" + iconUrl + "\") no-repeat #404040";
            clickyIcon.style.backgroundSize = "100%";
        }
        clickyIcon.onclick = function() {
            let url = installRecord.origin;
            FFRepoImplService.launch(url);
        };
        appContainer.appendChild(clickyIcon);
        
        let appName = this._elem("div", "appName");
        appName.innerHTML = app.name;
        appName.style.left = "10px";
        appContainer.appendChild(appName);

        return appContainer;
    },
    
    _renderIconList: function(appDict) {
        let appCount = 0;
        for (let key in appDict) appCount += 1;
        
        let doc = this._frame.contentDocument;
        let height = Math.ceil(appCount / 5.0) * 100 +
            (FFRepoImplService.getCurrentPageHasApp() ? 180 : 0);
        if (height < 20) height = 20;
        doc.body.style.height = height;

        let container = doc.getElementById("icon_region");
        container.innerHTML = "";

        let count = 0;
        for (let appID in appDict) {
            container.appendChild(this._createAppIcon(appDict[appID]));
            if (count && (((count+1) % 5) == 0)) {
                let br = this._elem("br");
                br.setAttribute("clear", "left");
                container.appendChild(br);
            }
            count += 1;
        }
        if (count == 0) {
            // FIXME: localize
            doc.getElementById("empty").innerHTML = "No applications are installed.";
        } else {
            doc.getElementById("empty").innerHTML = "";
        }
    },
    
    _show: function() {
        // Rough estimate of total size:
        // width is 68px per app
        // height is about 96px?
        let self = this;
        FFRepoImplService.list(function(appDict) {
            let count = 0;
            for (let key in appDict) count += 1;

            // 5 icons per row?
            let height = 100 + Math.ceil(count / 5.0) * 100 +
                (self._window.gBrowser.contentDocument.applicationManifest != null ? 180 : 0);
            self._panel.sizeTo(500, height + 20);
            self._frame.width = "480px";
            self._frame.height = height + "px";
            self._panel.openPopup(self._button, "after_end", -10);
            self._renderIconList(appDict);
            
            try {
              self._frame.contentDocument.getElementById("about_apps").onclick = function()
              {
                try {
                  openAndReuseOneTabPerURL( "about:apps" );
                } catch (e) {
                  dump(e + "\n");
                }
              }
            } catch (e) {
                dump(e + "\n");
            }
        });
    },
    
    toggle: function() {
        if (this._panel.state == "closed") {
            this._show();
        } else if (this._panel.state == "open") {
            this._panel.hidePopup();
        }
    }
};

var EXPORTED_SYMBOLS = ["appPopup"];
