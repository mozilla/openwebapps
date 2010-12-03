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
var tabs = require("tabs").tabs;
var xhr = require("xhr");
var URL = require("url").URL;
var {Cc, Ci, Cu} = require("chrome");
var widgets = require("widget");
var windows = require("windows").browserWindows;
var panels = require("panel");
var Manifest = require("manifest").Manifest;
var widgets = require("widget");

const APP_DOMAIN = "https://myapps.mozillalabs.com/"
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

/** Register a PageMod for all pages that adds the new .apps methods */
var pageMod = require("page-mod");
const data = require("self").data;

exports.init = function()
{
  console.log("registering PageMod");

  pageMod.PageMod({
    include: ["*"],
    contentScriptWhen: 'ready',
    contentScriptFile: data.url("pagemod.js"),
    onAttach: function onAttach(worker, mod) {
      worker.on('message', function(request) {
        console.log("navigator.apps API got call: " + JSON.stringify(request));

        if (request.cmd == "install")
        {
          var result = installApp(request.manifest, request.auth_url, request.sig, request.origin, worker, request.id);
        }
        else if (request.cmd == "list")
        {
          worker.postMessage({id:request.id, result:listFunc()});
        }
        else if (request.cmd == "getInstalled")
        {
          worker.postMessage({id:request.id, result:getInstalledFunc(request.origin)});
        }
        else if (request.cmd == "getInstalledBy")
        {
          worker.postMessage({id:request.id, result:getInstalledByFunc(request.origin)});
        }
        else if (request.cmd == "loadState")
        {
          worker.postMessage({id:request.id, result:loadStateFunc(request.stateID)});
        }
        else if (request.cmd == "saveState")
        {
          worker.postMessage({id:request.id, result:saveStateFunc(request.stateID, request.stateValue)});
        }
        else if (request.cmd == "launch")
        {
          launchFunc(request.appID);
        }
      });
    }
  });
}

// A widget that changes display on mouseover.
widgets.Widget({
  label: "Applications Widget",
  contentURL: "http://www.yahoo.com/favicon.ico",
  onClick: function() {
    console.log("Widget got onClick");
    let panel = panels.Panel({
      height:150,
      width:640,
      contentURL: data.url("dock.html"),
      contentScriptFile: data.url("dock.js"), 
      contentScript: "let gApplications = " + JSON.stringify(listFunc()),
      onMessage: function(req) {}
    });
    openPanelOnLocationBar(panel);
  }
});

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
  try {
    
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
  } catch (e) {
    console.log(e);
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
  for (var i=0;i<manifest.app_urls.length;i++)
  {
    var testURL = manifest.app_urls[i];
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

/**
 * installApp
 *
 * Prompt the user for confirmation, and install the specified application into local storage.
 */
function installApp(manifest, authorization_url, signature, origin, worker, requestID)
{
  let manf;
  try {
    manf = Manifest.validate(manifest);
  } catch(e) {
    console.log(e);
    callback({error: [ "invalidManifest", "couldn't validate your mainfest: " + e]});
    return;
  }

  let originURL = new URL(origin)
  let appURL = new URL(manifest.base_url);
  let originWarnings = [], appWarnings = [];
  
  if (originURL.scheme != "https") {
    originWarnings.push("Installing site is not using secure communication");
  }
  if (appWarnings.scheme != "https") {
    appWarnings.push("Application is not using secure communication");
  }

  let panel = panels.Panel({
    height:290,
    width:500,
    contentURL: data.url("install.html"),
    contentScriptFile: data.url("install.js"), 
    contentScript: "let gApplicationToInstall = " + JSON.stringify(manifest) + 
      "; let gAppOrigin = \"" + appURL.host + "\"; let gInstallingOrigin = \"" + originURL.host + "\";" +
      "let gAppWarnings = " + JSON.stringify(originWarnings) + "; let gOriginWarnings = " + JSON.stringify(appWarnings) + ";",

/*    allow: {script:true},*/
/*    contentScriptWhen: "ready",*/
 
    onMessage: function(req) {
      console.log("installPanel.onMessage: " + JSON.stringify(req));
      if (req.cmd == "confirm")
      {
        panel.destroy();
        console.log("Confirmed installation");      
        
        let key = makeAppKey(manf);
        let installation = {
            app: manf,
            installTime: new Date().getTime(),
            installURL: origin
        };
        if (authorization_url) {
          installation.authorizationURL = authorization_url;
        }
        simpleStorage.storage[key] = installation;
        console.log("Saved application with key " + key);

        let confirmPanel = panels.Panel({
          height:290,
          width:500,
          contentURL: data.url("confirm.html"),
          contentScriptFile: data.url("confirm.js"),
          contentScript: "let gApplicationToInstall = " + JSON.stringify(manifest),
        });
        openPanelOnLocationBar(confirmPanel);
        worker.postMessage({id:requestID, result:1});
      }
      else if (req.cmd == "cancel")
      {
        panel.destroy();
        console.log("Cancelled installation");      
        worker.postMessage({id:requestID, result:0});// TODO what's the callback API?
      }
    }
    
  });

  openPanelOnLocationBar(panel);
}

function openPanelOnLocationBar(panel)
{
  var panelAnchor;
  var mainWindow;
  try{
    var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
    var mainWindow = wm.getMostRecentWindow("navigator:browser");
    var elem = mainWindow.document.getElementById("urlbar-container")
    panelAnchor = elem;
  } catch (e) {console.log(e);}
  panel.show(panelAnchor);

  // TODO: just do this to the one we just made
  var popups = mainWindow.document.getElementById("mainPopupSet");
  for (var i=0;i<popups.childNodes.length;i++) {
    popups.childNodes[i].setAttribute("transparent", "transparent");
    popups.childNodes[i].setAttribute("style", "-moz-appearance: none;background-color:transparent");
  }
}


exports.applicationMatchesURL = applicationMatchesURL;

/*
Begin copy from chrome/repo.js
*/
var simpleStorage = require("simple-storage");
//var gRepoData = simpleStorage.storage;
var storage = {
  length: function() { // TODO make this a property
    count = 0;
    for (var i in simpleStorage.storage) count++;
    return count;
  },
  key: function(index) {
    count = 0;
    for (var key in simpleStorage.storage) {
      if (count == index) return key;
        count++;
    }
    return null;  
  },
  getItem: function(key) { 
    var val = simpleStorage.storage[key]; 
    if (!val) return null;
    return val;
  },
  setItem: function(key, value) { 
    simpleStorage.storage[key] = value; 
  },
  removeItem: function(key) { 
    delete simpleStorage.storage[key]; 
  },
}

function makeAppKey(manifest) {
    return "app::" + manifest.base_url + manifest.launch_path;
}

function isAppKey(key) {
    return (key.indexOf("app::") === 0);
}

function makeStateKey(id) {
    return "state::" + id;
}

function isStateKey(key) {
    return (key.indexOf("state::") === 0);
}

// iterates over all stored applications manifests and passes them to a
// callback function.  This function should be used instead of manual
// iteration as it will parse manifests and purge any that are invalid.
function iterateApps(cb) {
    // we'll automatically clean up malformed installation records as we go
    var toRemove = [];

    for (var i=0;i<storage.length();i++)
    {
      var key = storage.key(i);
        //only operat on apps, not other data
        if (!isAppKey(key)) continue;

        try {
            var item = storage.getItem(key);
            item.app = Manifest.validate(item.app);
            cb(key, item);
        } catch (e) {
            console.log("invalid application detected: " + e);
            toRemove.push(key);
        }
    }

    for (var j = 0; j < toRemove.length; j++) {
        storage.removeItem(toRemove[j]);
    }
}

// Returns whether the given URL belongs to the specified domain (scheme://hostname[:nonStandardPort])
function urlMatchesDomain(url, domain)
{
    try {
        var parsedDomain = Manifest.parseUri(domain);
        var parsedURL = Manifest.parseUri(url);

        if (parsedDomain.protocol.toLowerCase() == parsedURL.protocol.toLowerCase() &&
            parsedDomain.host.toLowerCase() == parsedURL.host.toLowerCase())
        {
            var inputPort = parsedDomain.port ? parsedDomain.port : (parsedDomain.protocol.toLowerCase() == "https" ? 443 : 80);
            var testPort = parsedURL.port ? parsedURL.port : (parsedURL.protocol.toLowerCase() == "https" ? 443 : 80);        
            if (inputPort == testPort) return true;
        }
    } catch (e) {
    }
    return false;
}

// Returns whether this application runs in the specified domain (scheme://hostname[:nonStandardPort])
function applicationMatchesDomain(application, domain)
{
    for (var i=0;i<application.app_urls.length;i++)
    {
        var testURL = application.app_urls[i];
        if (urlMatchesDomain(testURL, domain)) return true;
    }
    return false;
}

// Return all installations that belong to the given origin domain
function getInstallsForOrigin(origin)
{
    var result = [];

    iterateApps(function(key, item) {
        if (applicationMatchesDomain(item.app, origin)) {
            result.push(item);
        }
    });

    return result;
}

// Return all installations that were installed by the given origin domain 
function getInstallsByOrigin(origin)
{
    var result = [];

    iterateApps(function(key, item) {
        if (urlMatchesDomain(item.installURL, origin)) {
            result.push(item);
        }
    });

    return result;
}


/** Determines which applications are installed for the origin domain */
var getInstalledFunc = function(origin) {
    var installsResult = getInstallsForOrigin(origin);

    // Caller doesn't get to see installs, just apps:
    var result = [];
    for (var i=0;i<installsResult.length;i++)
    {
        result.push(installsResult[i].app);
    }

    return result;
};

/** Determines which applications were installed by the origin domain. */
var getInstalledByFunc = function(origin) {
    var installsResult = getInstallsByOrigin(origin);
    // Caller gets to see installURL, installTime, and manifest
    var result = [];
    for (var i=0;i<installsResult.length;i++)
    {
        result.push({
            installURL: installsResult[i].installURL,
            installTime: installsResult[i].installTime,
            manifest: installsResult[i].app,
        });
    }

    return result;
};


/*

    chan.bind('verify', function(t, args) {
        // We will look for manifests whose app_urls filter matches the origin.
        // If we find one, we will initiate verification of the user
        // by contacting the authorizationURL defined in the installation record.

        // If we find two... well, for now, we take the first one.
        // Perhaps we should find the first one that has an authorization URL.

        var result = getInstallsForOrigin(t.origin, args);
        if (result.length == 0) return null;
        var install = result[0];

        // Must have authorizationURL
        if (!install.authorizationURL)
        {
            throw ['invalidArguments', 'missing authorization url' ];
        }

        // TODO Could optionally have a returnto
        win.parent.location = install.authorizationURL;

        // return value isn't meaningful.  as a result of overwriting
        // the parent location, we'll be torn down.
        return;
    });
*/



/* Management APIs for dashboards live beneath here */ 

// A function which given an installation record, builds an object suitable
// to return to a dashboard.  this function may filter information which is
// not relevant, and also serves as a place where we can rewrite the internal
// JSON representation into what the client expects (allowing us to change
// the internal representation as neccesary)
function generateExternalView(key, item) {
    // XXX: perhaps localization should happen here?  be sent as an argument
    // to the list function?

    return {
        id: key,
        installURL: item.installURL,
        installTime: item.installTime,
        icons: item.app.icons,
        name: item.app.name,
        description: item.app.description,
        launchURL: item.app.base_url + item.app.launch_path,
        developer: item.app.developer
    };
}

var listFunc = function() {
    var installed = [];
    iterateApps(function(key, item) {
        installed.push(generateExternalView(key, item));
    });
    return installed;
};

var removeFunc = function(id) {
    var item = storage.getItem(id);
    if (!item) return {error: [ "noSuchApplication", "no application exists with the id: " + id]}; 
    storage.removeItem(id);
    return true;
};


var launchFunc = function(id) {
  var theInstall = storage.getItem(id);
  if (theInstall && theInstall.app && theInstall.app.base_url)
  {
    console.log("Launching app " + theInstall.app.name);
    openAppURL(null, theInstall.app, theInstall.app.base_url + theInstall.app.launch_path, false);
  }
  return true;
}

var loadStateFunc = function(id) {
  var val = storage.getItem(makeStateKey(id));
  console.log("Loading state key " + id + ": got " + val);
  return JSON.parse(val);
};

var saveStateFunc = function(id, state) {
    // storing null purges state
    if (state === null) {
        storage.removeItem(makeStateKey(id));
    } else  {
        storage.setItem(makeStateKey(id), JSON.stringify(state));
    }
    return true;
};


    /* this seemed a good idea, however launching applications from inside an iframe
     * is too fragile given the abundance of popup blockers.  given that, it seems
     * wiser to return a launchurl in list.
    chan.bind('launch', function(t, key) {
        verifyMgmtPermission(t.origin);

        var item = storage.getItem(key);
        if (item) {
            try {
                item = JSON.parse(item);
                item.app = Manifest.validate(item.app);
            } catch (e) {
                logError("invalid application removed: " + e);
                storage.removeItem(key);
                item = null;
            }
        }
        if (!item) throw [ "noSuchApplication", "no application exists with the id: " + key ]; 

        win.open(item.app.base_url + item.app.launch_path, "__" + key);

        return true;
    });
     */
/*
    return {
        list: listFunc,
        install: installFunc,
        remove: removeFunc,
        getInstalled: getInstalledFunc,
        getInstalledBy: getInstalledByFunc,
        loadState: loadStateFunc,
        saveState: saveStateFunc,
        launch: launchFunc
    }
})();*/
/* end copy from chrome/repo.js */

