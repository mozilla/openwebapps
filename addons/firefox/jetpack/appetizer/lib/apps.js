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
 * The Original Code is App Dashboard
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Michael Hanson <mhanson@mozilla.com>
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
 
var self = require("self");
var windowUtils = require("window-utils");
var tabs = require("tabs");
var xhr = require("xhr");
var URL = require("url").URL;
var {Cc, Ci, Cu} = require("chrome");
var widgets = require("widget");
var windows = require("windows").browserWindows;

const APP_DOMAIN = "https://myapps.mozillalabs.com/"



exports.init = function() 
{

  /**
   * On an onLoad handler to tab to inject our new methods into
   * navigator.apps.
   */
  tabs.onLoad = function(tab) {
    try {
      if (tab.location == APP_DOMAIN)
      {
        
        // Create a sandbox to inject into the window's JS context
        let sandbox = new Cu.Sandbox(tab.contentWindow);
        
        // Bind our function
        function getOpenAppURLFunction() 
        {
          return function(aWindow, app, url, options) {
            openAppURL(aWindow, app, url, options && options.background);
          }
        }
        sandbox.importFunction(getOpenAppURLFunction(), "openAppTab");

        // Inject our function into the expected place
        sandbox.window = tab.contentWindow.wrappedJSObject;
        Cu.evalInSandbox("if (window && window.navigator) {\
            window.navigator.apps = {\
              openAppTab: function(app, url, options) {\
                openAppTab(window, app, url, options);\
              }\
            };\
          }", 
          sandbox, 
          "1.8",  // JS version
          "resource://apptastic/content/apps.js",  /* effective source URI of our code */
          1 /* effective line number of our code */ );
      }
    } catch (e) {
      console.log("Error while injecting navigator.apps block: " + e);
    }
  }
}

exports.unload = function() {
  // TODO: make certain we've cleaned everything up
}


/**
* openAppURL
*
* Called to open a URL as the given app.
*
* If we already have a tab open to the current app, loads the URL there.
* Otherwise, creates a new pinned tab for the given URL.
*/
function openAppURL(aWindow, app, url, inBackground)
{
  // TODO: Replace this with the new Jetpack windows API!
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
  var browserEnumerator = wm.getEnumerator("navigator:browser");

  // Do we already have this app running in a tab?  If so, target it.
  var found = false;
  while (!found && browserEnumerator.hasMoreElements()) {
    var browserWin = browserEnumerator.getNext();
    var tabbrowser = browserWin.gBrowser;

    var numTabs = tabbrowser.browsers.length;
    for (var index = 0; index < numTabs; index++) {
    
      var currentBrowser = tabbrowser.getBrowserAtIndex(index);
      if (applicationMatchesURL(app, currentBrowser.currentURI.spec))
      {
        // The app is running in this tab; select it and retarget.
        tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];

        // Focus *this* browser-window
        browserWin.focus();
        tabbrowser.selectedBrowser.loadURI(url, null // TODO don't break referrer!
          , null);
        
        found = true;
      }
    }
  }

  // Our URL does not belong to a currently running app.  Create a new
  // tab for that app and load our URL into it.
  if (!found) {
    var recentWindow = wm.getMostRecentWindow("navigator:browser");
    if (recentWindow) {
      openAppTabOnWindow(recentWindow, url, inBackground);
    } else {
      // This is a very odd case: no browser windows are open, so open a new one.
      aWindow.open(url);
      // TODO: convert to app tab somehow
    }
  }
}

/** 
 * openAppTabOnWindow
 *
 * Open a given URL as an app tab in the given window, regardless of whether
 * we already have an app tab for that URL.
*/
function openAppTabOnWindow(window, targetURL, inBackground)
{
  var tab = window.gBrowser.addTab(targetURL);

  // unlovely internal hackery; Jetpack doesn't expose pinned yet
  var idx = window.gBrowser._numPinnedTabs;
  window.gBrowser.moveTabTo(tab, idx);
  tab.setAttribute("pinned", "true");
  window.gBrowser.tabContainer._positionPinnedTabs();
  if (!inBackground) { // meta means open-in-background, same as usual
    window.gBrowser.selectTabAtIndex(idx);
  }
}

/** Helper function: does the given URL belong to the
 * provided manifest? */
function applicationMatchesURL(manifest, url)
{
  var parsedURL = new URL(url);
  for (var i=0;i<manifest.app.urls.length;i++)
  {
    var testURL = manifest.app.urls[i];
    if (url.indexOf(testURL) == 0) {
      // Second pass check: make sure the domain is an exact match
      // and not just a prefix match.
      var testParse = new URL(testURL);
      if (parsedURL.scheme == testParse.scheme &&
        parsedURL.host == testParse.host)
      {
        var requiredPort = parsedURL.port ? parsedURL.port : (parsedURL.scheme == "https" ? 443 : 80);
        var testPort = testParse.port ? testParse.port : (testParse.scheme == "https" ? 443 : 80);
        if (requiredPort == testPort) return true;
      }
    }
  }
  return false;
}

exports.applicationMatchesURL = applicationMatchesURL;
