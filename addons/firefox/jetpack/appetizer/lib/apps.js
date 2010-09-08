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
 
let EXPORTED_SYMBOLS = ["Apps"];

var self = require("self");
var contextMenu = require("context-menu");
var windowUtils = require("window-utils");
var tabs = require("tabs");
var xhr = require("xhr");
var url = require("url");
var oauth = require("oauth");
var {Cc, Ci, Cu} = require("chrome");

const APP_STORAGE_DOMAIN = "http://myapps.org"
var gApps = null;

exports.init = function() {

  const SCRIPT_SECURITY_MGR = Cc["@mozilla.org/scriptsecuritymanager;1"].getService(Ci.nsIScriptSecurityManager);
  const STORAGE_MANAGER = Cc["@mozilla.org/dom/storagemanager;1"].getService(Ci.nsIDOMStorageManager);
  const IO_SERVICE = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
  var appStorageURI = IO_SERVICE.newURI(APP_STORAGE_DOMAIN, null, null);
  var principal = SCRIPT_SECURITY_MGR.getCodebasePrincipal(appStorageURI);
  var storage = STORAGE_MANAGER.getLocalStorageForPrincipal(principal, {});
  gApps = new Apps(storage);
  
  
  // Start watching windows: we'll add a click handler
  // to all of them.
  windowTracker = new windowUtils.WindowTracker(windowTrackerDelegate);
  
  /*

  // Register a context-menu handler for the apps viewer
  var menuItem = contextMenu.Item({

    label: "Get Application Info...",

    // A CSS selector. Matching on this selector triggers the
    // display of our context menu.
    context: ".appbox",// TODO: be much more careful with this: only do the check in an app-management domain

    // When the context menu item is clicked, perform a Google
    // search for the link text.
    onClick: function (contextObj, item) {
      // var anchor = contextObj.node;
      console.log("Got click on GetInfo");
      console.log(" getInfo context node is " + contextObj.node);
      console.log(" getInfo context node.id is " + contextObj.node.id);
      console.log(" getInfo context window is " + contextObj.window);
      try {
        var appURL = contextObj.node.id.split(4);
        var loc = contextObj.window.location;
        var action = {
          a: "info",
          id: appURL
        };
        var newURL = loc.protocol + "//" +
          loc.host + loc.pathname + "#" + JSON.stringify(action);
        contextObj.window.location=newURL;
      } catch (e) {
        console.log(e);
      }
    }
  });
  contextMenu.add(menuItem);  
  */
}

exports.unload = function() {
  // how to stop tracking?
}

function openAppURL(app, url, inBackground)
{
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
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
      // recentWindow.delayedOpenTab(url, null, null, null, null);
      
      var tab = recentWindow.gBrowser.addTab(url);
      var idx = recentWindow.gBrowser._numPinnedTabs;
      recentWindow.gBrowser.moveTabTo(tab, idx);
      tab.setAttribute("pinned", "true");
      recentWindow.gBrowser.tabContainer._positionPinnedTabs();
      if (!inBackground) { // meta means open-in-background, same as usual
        recentWindow.gBrowser.selectTabAtIndex(idx);
      }

    }
    else {
      // No browser windows are open, so open a new one.
      window.open(url);
      // TODO: convert to app tab somehow
      
    }
  }
}


function openNewAppTab(targetURL, inBackground)
{
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);    
  var mainWindow = wm.getMostRecentWindow("navigator:browser");
/*  var mainWindow = recentWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                         .getInterface(Ci.nsIWebNavigation)
                         .QueryInterface(Ci.nsIDocShellTreeItem)
                         .rootTreeItem
                         .QueryInterface(Ci.nsIInterfaceRequestor)
                         .getInterface(Ci.nsIDOMWindow);*/
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
    // If this page is /already/ on an apptab, and the
    // click leaves the apptab, send it off-tab.
    // (if it has a "target" attribute already, just trust it)
    // TODO: handle browseURL overrides here
    if (!target.target)
    {
      var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);    
      var recentWindow = wm.getMostRecentWindow("navigator:browser");
      let currentAppList = gApps.applicationsForURL(recentWindow.gBrowser.currentURI.spec); 
      if (currentAppList && currentAppList.length > 0)
      { 
        console.log("Current page belongs to app " + currentAppList[0].name);

        // We're on an application's tab
        if (gApps.applicationMatchesURL(currentAppList[0], target.href)) {
          // it's a match; just return
          console.log("the link we clicked belongs to that app too; stay here");
          return;
        }
        // TODO: Should we only provide sticky behavior if it's an apptab?  Right now, the answer is yes.
        if (recentWindow.gBrowser.selectedTab.getAttribute("pinned"))
        {
          event.preventDefault();
          console.log("the link we clicked doesn't belong to that app, so make a new tab");
          // okay, this is an off-app click on a pinned tab: off it goes.
          var tab = recentWindow.gBrowser.addTab(target.href);
          if (!event.metaKey) { // meta means open-in-background, same as usual
            // this isn't right - recentWindow.gBrowser.selectTabAtIndex(tab.tabIndex);
            // TODO what's the right way to focus the new tab?
          }
          return;
        }
      }
    }

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
  } catch (e) {
    console.log("error(2): " + e);
  }
} 

let windowTrackerDelegate = {
  onTrack: function(window) {
    window.addEventListener("click", clickLinkChecker, true);
    
  },
  onUntrack: function(window) {

  }
};

function applyURITemplate(template, inputDict)
{
  return template.replace(/{[^{}]+}/g, function(key){
    return inputDict[key.replace(/[{}]+/g, "")] || "";
  });
}

function getOpenAppTabFn() {
  return function(window, app, url, options) {
    console.log("I got an openAppTab call: " + app + ", " + url);
    openNewAppTab(url, options && options.background);
  }
}
function getSearchAppFn() {
  return function(window, install, input, callback) {
    console.log("Entering search function");
    let req = new xhr.XMLHttpRequest()
    let app = install.app;
    let targetURL = applyURITemplate(app.search, {searchTerms: input});
    if (app.oauthGetRequestURL /* searchIsOAuth */)
    {
      let parsedURL = new url.URL(targetURL);
      
      console.log("Made template URL " + targetURL);
      var request = {
        method:"GET",
        action: parsedURL.scheme + "://" + parsedURL.host + parsedURL.path,
        parameters: {
          title: input
        }
      };
      var accessor = {
        consumerKey: "anonymous",
        consumerSecret: "anonymous",
        token: escape(install.authorization_token),
        tokenSecret: escape(install.authorization_secret)
      };
      oauth.OAuth.completeRequest(request, accessor);
      //var header = oauth.OAuth.getAuthorizationHeader(null, request.parameters);
      //req.setRequestHeader("Authorization", header);
      // req.setRequestHeader("GData-Version", "3.0");
      targetURL = request.action + "?" + oauth.OAuth.formEncode(request.parameters);
      console.log("Starting application search; URL is " + targetURL);// + "; header is Authorization: " + header);
      req.open("GET", targetURL, true);
    }
    else
    {
      req.open("GET", targetURL, true);
      targetURL = applyURITemplate(app.search, {searchTerms: input});
      console.log("Starting application search; URL is " + targetURL);
    }
    req.onreadystatechange = function (aEvt) {  
      if (req.readyState == 4) {  
         if(req.status == 200) {
          console.log("Finished application search for URL " + targetURL);
          console.log(req.responseText);
          callback(req.responseText);
         } else {
          console.log("Error while performing search for '" + app.name +"': " + req.status + "; " + req.responseText);
          callback(null);
        }
      }  
    };  
    req.send(null);       
    console.log("Started application search for '" + app.name + "': " + input);
  }
}

function getAppRequestTokenFn() {
  return function(window, app, callback) {
    // TODO verify arguments of app
    var request = {
      method:"GET",
      action: app.oauthGetRequestURL,
      parameters: {
        oauth_consumer_key:"anonymous",
        oauth_signature_method:"HMAC-SHA1",
        oauth_callback:"http://localhost:8123/oauthAccessGranted.html?app=" + app.app.launch.web_url,
        xoauth_displayname:app.name
      }
    };
    if (app.searchScope) request.parameters.scope = app.searchScope;
    
    var accessor = {
      consumerKey: "anonymous",
      consumerSecret: "anonymous"
    };
    oauth.OAuth.completeRequest(request, accessor);
    var url = oauth.OAuth.addToURL(app.oauthGetRequestURL, request.parameters);

    // kick off XHR:
    let req = new xhr.XMLHttpRequest()
    req.open("GET", url, true);
    console.log("Starting OAuth request token request for " + app.name + "; URL is " + url);
    req.onreadystatechange = function (aEvt) {  
      if (req.readyState == 4) {  
         if(req.status == 200) {
          console.log("Finished OAuth request token request for " + app.name + "; it is " + req.responseText);
          var result = oauth.OAuth.decodeForm(req.responseText);
          callback(oauth.OAuth.getParameterMap(result));
         } else {
          console.log("Error while getting OAuth request token for '" + app.name +"': " + req.status);
          callback(null);
        }
      }  
    };  
    req.send(null);       
  }
}


function getAppAccessTokenFn() {
  return function(window, app, verifier, token, secret, callback) {
    // TODO verify arguments of app
    console.log("Starting OAuth access token request for " + app.name + "; verifier is " + verifier + "; token is " + token + "; secret is " + secret);
    var request = {
      method:"GET",
      action: app.oauthGetAccessURL,
      parameters: {
        oauth_consumer_key:"anonymous",
        oauth_token:token,
        oauth_verifier:verifier,//"http://localhost:8123/oauthAccessGranted.html?app=" + app.app.launch.web_url,
        oauth_signature_method:"HMAC-SHA1"
      }
    };
    var accessor = {
      consumerKey: "anonymous",
      consumerSecret: "anonymous",
      tokenSecret: secret
    };
    oauth.OAuth.completeRequest(request, accessor);
    console.log("constructing oauth request; token is " + token + " and verifier is " + verifier);
    var header = oauth.OAuth.getAuthorizationHeader("www.google.com", request.parameters);
    // var url = oauth.OAuth.addToURL(app.oauthGetAccessURL, request.parameters);
    var url = app.oauthGetAccessURL;

    // kick off XHR:
    let req = new xhr.XMLHttpRequest()
    req.open("GET", url, true);
    req.setRequestHeader("Authorization", header);
    console.log("Starting OAuth access token request for " + app.name + "; URL is " + url + "; header is " + header);
    req.onreadystatechange = function (aEvt) {  
      if (req.readyState == 4) {  
         if(req.status == 200) {
          console.log("Finished OAuth access token request for " + app.name);
          var result = oauth.OAuth.decodeForm(req.responseText);
          callback(oauth.OAuth.getParameterMap(result));
         } else {
          console.log("Error while getting OAuth access token for '" + app.name +"': " + req.status + "; " + req.responseText);
          callback(null);
        }
      }  
    };  
    req.send(null);       
  }
}



tabs.onLoad = function(tab) {
  if (true) // TODO only do this once...
  {
    try {
      let sandbox = new Cu.Sandbox(tab.contentWindow);
      sandbox.importFunction(getOpenAppTabFn(), "openAppTab");
      sandbox.importFunction(getSearchAppFn(), "searchApp");
      sandbox.importFunction(getAppRequestTokenFn(), "getAppOAuthRequestToken");
      sandbox.importFunction(getAppAccessTokenFn(), "getAppOAuthAccessToken");
      sandbox.window = tab.contentWindow.wrappedJSObject;
      Cu.evalInSandbox("if (window && window.navigator) {\
          window.navigator.apps = {\
            openAppTab: function(app, url, options) {\
              openAppTab(window, app, url, options);\
            },\
            searchApp: function(install, input, callback) {\
              searchApp(window, install, input, callback);\
            },\
            getAppOAuthRequestToken: function(app, callback) {\
              getAppOAuthRequestToken(window, app, callback);\
            },\
            getAppOAuthAccessToken: function(app, verifier, token, secret, callback) {\
              getAppOAuthAccessToken(window, app, verifier, token, secret, callback);\
            }\
          };\
        }", sandbox, "1.8", "resource://apptastic/content/apps.js", 1);
    } catch (e) {
      console.log("Error while injecting navigator.apps block: " + e);
    }
  }
}





function Apps(storage) {
  this.installs = [];
  if (!storage) this.storage = window.localStorage;
  else this.storage = storage;
  this.reload();
}

Apps.prototype.logError = function(message) {
  if(window.console && window.console.log) {
    window.console.log("Error: " + message);
  }
}

Apps.prototype.reload = function() {
  this.installs = [];

  for (var i =0 ; i < this.storage.length; i++)
  {
    var key = this.storage.key(i);
    if (key == "appclient_unit_test") continue;

    var item = this.storage.getItem(key);
    var install = JSON.parse(item);
    this.installs.push(install);
    
  }
  this.installs.sort(function (a,b) { 
      return a.app.name.localeCompare(b.app.name); 
    } 
  );
}

Apps.prototype.install = function(manf) {
  if (manf.expiration) {
    var numericValue = Number(manf.expiration); // Cast to numeric timestamp
    var dateCheck = new Date(numericValue);
    if(dateCheck < new Date()) { // If you pass garbage into the date, this will be false
      this.logError('Invalid manifest: malformed expiration');
      return false;
    }
    manf.expiration = numericValue;
  }
  if (!manf.name) {
    this.logError('Invalid manifest: missing application name');
    return false;
  }
  if (!manf.app) {
    this.logError('Invalid manifest: missing "app" property');
    return false;
  }
  if (!manf.app.urls) {
    this.logError('Invalid manifest: missing "urls" property of "app"');
    return false;
  }
  if (!manf.app.launch) {
    this.logError('Invalid request: missing "launch" property of "app"');
    return false;
  }
  if (!manf.app.launch.web_url) {
    this.logError('Invalid request: missing "web_url" property of "app.launch"');
    return false;
  }
  // Launch URL must be part of the set of app.urls
  // TODO perform check
  
  var key = manf.app.launch.web_url;

  // Create installation data structure
  var installation = {
    app: manf,
    installTime: new Date().getTime(),
    installURL: window.location
  }
  // Save - blow away any existing value
  this.storage.setItem(key, JSON.stringify(installation));
  this.reload();
  return true;
}

Apps.prototype.removeAll = function() {
  for (var i = this.storage.length - 1 ; i >= 0; i--)
  {
    var key = this.storage.key(i);
    if (key == "appclient_unit_test") continue;
    this.storage.removeItem(key);
  }
}

Apps.prototype.remove = function(install) {

  // Cautious technique here: don't want to have to worry about
  // corruption of this.installs or anything like that.
  var compareValue = JSON.stringify(install);
  for (var i = this.storage.length-1 ; i >= 0; i--)
  {
    var key = this.storage.key(i);
    if (key == "appclient_unit_test") continue;

    var item = this.storage.getItem(key);
    if (item == compareValue) {
      this.storage.removeItem(key);
      // keep looking; shouldn't ever happen, but weird things happen sometimes.
    }
  }
  this.reload();
}

// Returns the install whose launch/web_url matches the given url.
Apps.prototype.getInstall = function(url) 
{
  for (var i=0;i<this.installs.length;i++)
  {
    if (this.installs[i].app.app.launch.web_url == url)
      return this.installs[i];
  }
  return null;
}

Apps.prototype.searchApps = function(term) {
  var lcterm = term.toLowerCase();
  var result = [];
  for (var i=0;i<this.installs.length;i++)
  {
    if (this.installs[i].app.name.toLowerCase().indexOf(lcterm) >= 0) {
      result.push(this.installs[i]);
    }
  }
  return result;
}

Apps.prototype.refreshNotifications = function(callback) 
{
  for (var i=0;i<this.installs.length;i++)
  {
    if (this.installs[i].app.notification)
    {
      try {
        this.initiateNotificationRefresh(this.installs[i].app, callback);
      } catch (e) {
        this.logError("Unable to fetch notifications for " + this.installs[i].app.name + ": " + e);
      }
    }
  }
}

Apps.prototype.initiateNotificationRefresh = function(app, callback) 
{
  var xhr = new XMLHttpRequest();
  
  // TODO perhaps send a "updatedSince" argument along with this?
  xhr.open("GET", app.notification, true);
  xhr.onreadystatechange = function(aEvt) {
    if (xhr.readyState == 4) {
      if (xhr.status == 200) {
        try {
          var result = JSON.parse(xhr.responseText);
          // okay... now... are any of these new?
          // if so... put it somewhere?
          // and let somebody know?
        } catch (e) {

        }
      }
    }
  }
  xhr.send(null);
}



Apps.prototype.applicationMatchesURL = function(app, url)
{
  // TODO look into optimizing this so we are not constructing
  // regexps over and over again, but make sure it works in IE
  for (var i=0;i<app.app.urls.length;i++)
  {
    var testURL = app.app.urls[i];
    var re = RegExp("^" + testURL.replace("*", ".*"));// no trailing $

    if (re.exec(url) != null) return true;
  }
  return false;
}


Apps.prototype.applicationsForURL = function(url)
{
  var result = [];
  for (var i =0;i<this.storage.length;i++)
  {
    var key = this.storage.key(i);
    var item = this.storage.getItem(key);
    var install = JSON.parse(item);

    if (this.applicationMatchesURL(install.app, url)) {      
      result.push(install.app);
    }
  }
  return result;
}

exports.getDataURL = function(name) {
  return self.data.url(name);
}
exports.Apps = Apps;
exports.openAppURL = openAppURL; // (app, url)

