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
 * The Original Code is Apps.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michael Hanson <mhanson@mozilla.com>
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


var contextMenu = require("context-menu");
var self = require("self");
var panels = require("panel");
var tabs = require("tabs");
var tabBrowser = require("tab-browser");
var windowUtils = require("window-utils");
var apps = require("apps");
var {Cc, Ci, Cu} = require("chrome");

const APP_STORAGE_DOMAIN = "http://myapps.org"
var gApps = null;


// Create a new context menu item.
var menuItem = contextMenu.Item({

  label: "Search with Google",

  // A CSS selector. Matching on this selector triggers the
  // display of our context menu.
  context: "a[href]",

  // When the context menu item is clicked, perform a Google
  // search for the link text.
  onClick: function (contextObj, item) {
    var anchor = contextObj.node;
    var searchUrl = "http://www.google.com/search?q=" +
                    anchor.textContent;
    contextObj.window.location.href = searchUrl;
  }
});

// Add the new menu item to the application's context menu.
contextMenu.add(menuItem);


function openAppURL(app, url)
{
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
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
      
      let apps = gApps.applicationsForURL(currentBrowser.currentURI.spec);
      if (apps) {
      
        for (var i = 0;i<apps.length;i++) {

          if (apps[i].app.launch.web_url == app.app.launch.web_url) {
            // The app is running in this tab; select it and retarget.
            tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];

            // Focus *this* browser-window
            browserWin.focus();
            tabbrowser.selectedBrowser.loadURI(url, null /* TODO don't break referrer! */, null);
            
            found = true;
            break;
          }
        }
      }
    }
  }

  // TODO: need to appify new link
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


function openNewAppTab(targetURL, inBackground)
{
  var mainWindow = window.QueryInterface(Ci.nsIInterfaceRequestor)
                         .getInterface(Ci.nsIWebNavigation)
                         .QueryInterface(Ci.nsIDocShellTreeItem)
                         .rootTreeItem
                         .QueryInterface(Ci.nsIInterfaceRequestor)
                         .getInterface(Ci.nsIDOMWindow);
  var tab = mainWindow.gBrowser.addTab(targetURL);
  var idx = mainWindow.gBrowser._numPinnedTabs;
  mainWindow.gBrowser.moveTabTo(tab, idx);
  tab.setAttribute("pinned", "true");
  mainWindow.gBrowser.tabContainer._positionPinnedTabs();
  if (!inBackground) { // meta means open-in-background, same as usual
    mainWindow.gBrowser.selectTabAtIndex(idx);
  }
}

// Set up our tab tracker
let clickLinkChecker = function(event) {
  var target = event.target;
  while(target) {
    if (target.nodeName == 'A')
      break;
    target = target.parentNode;
  }
  if(!target)
    return;

  // only those referencing an external page
  if(!target.href || target.href.indexOf("#") == 0)
    return;

  try {

    let appList = gApps.applicationsForURL(target.href);
    if (appList && appList.length) {
      // got a match:
      // if we already have a tab, switch to it.
      // otherwise open a new one.
      event.preventDefault();
    
      // TODO ignore apps other than the first for now
      openAppURL(appList[0], target.href)
    } 
    // otherwise fall through
  } catch (e) {
    console.log("error: " + e);
  }
} 

let tracker = {
  onTrack: function(window) {
    window.addEventListener("click", clickLinkChecker, true);
    
  },
  onUntrack: function(window) {

  }
};

exports.main = function(options, callbacks) {
  // Don't need to quit right away: no callbacks.quit();

  const SCRIPT_SECURITY_MGR = Cc["@mozilla.org/scriptsecuritymanager;1"].getService(Ci.nsIScriptSecurityManager);
  const STORAGE_MANAGER = Cc["@mozilla.org/dom/storagemanager;1"].getService(Ci.nsIDOMStorageManager);
  const IO_SERVICE = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  var appStorageURI = IO_SERVICE.newURI(APP_STORAGE_DOMAIN, null, null);
  var principal = SCRIPT_SECURITY_MGR.getCodebasePrincipal(appStorageURI);
  var storage = STORAGE_MANAGER.getLocalStorageForPrincipal(principal, {});
  gApps = new apps.Apps(storage);

  // Start watching windows: we'll add a click handler
  // to all of them.
  var windowTracker = new windowUtils.WindowTracker(tracker);
  
  registerCustomAppsProtocol();
  tabs.open({
    url: self.data.url("apps://apps/dashboard.html")
  });
}



const APPS_PROTOCOL = "apps";
const APPS_HOST = "apps";
const APPS_URL = APPS_PROTOCOL + "://" + APPS_HOST + "/dashboard.html";
// TODO: We want to localize this string.
const APPS_TITLE = "Cuddlefish Lab";


function injectLabVars(window) {
  window.wrappedJSObject.packaging = packaging;
}

function registerCustomAppsProtocol()
{
  var protocol = require("custom-protocol").register(APPS_PROTOCOL);

  // TODO: Eventually we want to have this protocol not run
  // as the system principal.
  protocol.setHost(APPS_HOST, packaging.getURLForData("/"), "system");

  var openLab;

/*  if (tabBrowser.isAppSupported()) {
    tabBrowser.whenContentLoaded(function(window) {
      if (window.location == APPS_URL) {
      injectLabVars(window);
      require("window-utils").closeOnUnload(window);
      }
    });
    openLab = function openLabInTab() {
      tabBrowser.addTab(APPS_URL);
    };
  } else*/
    openLab = function openLabInWindow() {
      var contentWindow = require("content-window");
      var window = new contentWindow.Window({url: APPS_URL,
                                             width: 800,
                                             height: 600,
                                             onStartLoad: injectLabVars});
    };

/*  if (simpleFeature.isAppSupported())
    simpleFeature.register(APPS_TITLE, openLab);
  else
    // No other way to allow the user to expose the functionality
    // voluntarily, so just open the lab now.
    openLab();*/
};
