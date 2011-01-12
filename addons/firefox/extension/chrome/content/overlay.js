/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
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
 * The Initial Developer of the Original Code is
 * Mozilla, Inc.
 *
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * */

'use strict';
/*jslint indent: 2, es5: true, plusplus: false, onevar: false */
/*global document: false, setInterval: false, clearInterval: false,
  Application: false, gBrowser: false, window: false, Components: false,
  Cc: false, Ci: false, PlacesUtils: false, gContextMenu: false,
  XPCOMUtils: false, AddonManager: false,
  BrowserToolboxCustomizeDone: false, InjectorInit: false, injector: false */

var openwebapps;
var openwebapps_EXT_ID = "openwebapps@mozillalabs.com";
(function () {

  Components.utils.import("resource://openwebapps/modules/injector.js");
  Components.utils.import("resource://openwebapps/modules/repo.js");
  Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

  // This add-on manager is only available in Firefox 4+
  try {
    Components.utils.import("resource://gre/modules/AddonManager.jsm");
  } catch (e) {   
  }

  var slice = Array.prototype.slice,
      ostring = Object.prototype.toString,
      empty = {}, fn,
      buttonId = 'openwebapps-toolbar-button';

  function getButton() {
    return document.getElementById(buttonId);
  }

  function mixin(target, source, override) {
    //TODO: consider ES5 getters and setters in here.
    for (var prop in source) {
      if (!(prop in empty) && (!(prop in target) || override)) {
        target[prop] = source[prop];
      }
    }
  }

  function unescapeXml(text) {
    return text.replace(/&lt;|&#60;/g, '<')
               .replace(/&gt;|&#62;/g, '>')
               .replace(/&amp;|&#38;/g, '&')
               .replace(/&apos;|&#39;/g, '\'')
               .replace(/&quot;|&#34;/g, '"');
  }

  function log(msg) {
    Application.console.log('.' + msg); // avoid clearing on empty log
  }

  function error(msg) {
    Components.utils.reportError('.' + msg); // avoid clearing on empty log
  }

  fn = {

    /**
     * Determines if the input a function.
     * @param {Object} it whatever you want to test to see if it is a function.
     * @returns Boolean
     */
    is: function (it) {
      return ostring.call(it) === '[object Function]';
    },

    /**
     * Different from Function.prototype.bind in ES5 --
     * it has the "this" argument listed first. This is generally
     * more readable, since the "this" object is visible before
     * the function body, reducing chances for error by missing it.
     * If only obj has a real value then obj will be returned,
     * allowing this method to be called even if you are not aware
     * of the format of the obj and f types.
     * It also allows the function to be a string name, in which case,
     * obj[f] is used to find the function.
     * @param {Object||Function} obj the "this" object, or a function.
     * @param {Function||String} f the function of function name that
     * should be called with obj set as the "this" value.
     * @returns {Function}
     */
    bind: function (obj, f) {
      //Do not bother if 
      if (!f) {
        return obj;
      }

      //Make sure we have a function
      if (typeof f === 'string') {
        f = obj[f];
      }
      var args = slice.call(arguments, 2);
      return function () {
        return f.apply(obj, args.concat(slice.call(arguments, 0)));
      };
    }
  };


  var firstRunProgressListener = {
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIWebProgressListener,
                                           Components.interfaces.nsISupportsWeakReference,
                                           Components.interfaces.nsISupports]),

    onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {
      // maybe can just use onLocationChange, but I don't think so?
      var flags = Components.interfaces.nsIWebProgressListener;

      // This seems like an excessive check but works very well
      if (aStateFlags & flags.STATE_IS_WINDOW &&
                 aStateFlags & flags.STATE_STOP) {
        if (!openwebapps.didOnFirstRun) {
          //Be sure to disable first run after one try. Even if it does
          //not work, do not want to annoy the user with continual popping up
          //of the front page.
          openwebapps.didOnFirstRun = true;
          openwebapps.onFirstRun();
        }
      }
    },

    onLocationChange: function (aWebProgress, aRequest, aLocation) {},
    onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
    onSecurityChange: function (aWebProgress, aRequest, aState) {},
    onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) {}
  };

  function sendJustInstalledEvent(browser, rect) {
    browser.contentWindow.wrappedJSObject.buttonX = rect.left + rect.width / 2;
    var evt = browser.contentWindow.wrappedJSObject.document.createEvent("Event");
    evt.initEvent("buttonX", true, false);
    browser.contentWindow.wrappedJSObject.dispatchEvent(evt);
  }

  function makeInstalledLoadHandler(browser, rect) {
    return function () {
      sendJustInstalledEvent(browser, rect);
    };
  }

  openwebapps = {

    system: Application.prefs.getValue("extensions." + openwebapps_EXT_ID + ".system", "prod"),
    frontpageUrl: Application.prefs.getValue("extensions." + openwebapps_EXT_ID + ".frontpage_url", ""),
    useBookmarking: Application.prefs.getValue("extensions." + openwebapps_EXT_ID + ".bookmarking", true),
    previousVersion: Application.prefs.getValue("extensions." + openwebapps_EXT_ID + ".previous_version", ""),
    firstRun: Application.prefs.getValue("extensions." + openwebapps_EXT_ID + ".first-install", ""),
    useAccelKey: Application.prefs.getValue("extensions." + openwebapps_EXT_ID + ".use-accel-key", true),

    errorPage: 'chrome://openwebapps/content/down.html',

    keycodeId: "key_openwebapps",
    keycode : "VK_OWA",
    oldKeycodeId: "key_old_openwebapps",

    onInstallUpgrade: function (version) {
      //Only run if the versions do not match.
      if (version === openwebapps.previousVersion) {
        return;
      }

      //Update previousVersion pref. Do this now in case an error below
      //prevents it -- do not want to get in a situation where for instance
      //we pop the front page URL for every tab navigation.
      openwebapps.previousVersion = version;
      Application.prefs.setValue("extensions." + openwebapps_EXT_ID + ".previous_version", version);

      // Place the button in the toolbar.
      try {
        //Not needed since we add to the end.
        //var afterId = "urlbar-container";   // ID of element to insert after
        var navBar  = document.getElementById("nav-bar"),
            curSet  = navBar.currentSet.split(","), set;

        if (curSet.indexOf(buttonId) === -1) {
          //The next two lines place it between url and search bars.
          //pos = curSet.indexOf(afterId) + 1 || curSet.length;
          //var set = curSet.slice(0, pos).concat(buttonId).concat(curSet.slice(pos));
          //Add it to the end of the toolbar.
          set = curSet.concat(buttonId).join(",");

          navBar.setAttribute("currentset", set);
          navBar.currentSet = set;
          document.persist(navBar.id, "currentset");
          try {
            BrowserToolboxCustomizeDone(true);
          }
          catch (e) {}
        }
      }
      catch (e) {}

      if (openwebapps.firstRun) {
        //Make sure to set the pref first to avoid bad things if later code
        //throws and we cannot set the pref.
        openwebapps.firstRun = false;
        Application.prefs.setValue("extensions." + openwebapps_EXT_ID + ".first-install", false);

        //Register first run listener.
        gBrowser.getBrowserForTab(gBrowser.selectedTab).addProgressListener(firstRunProgressListener, Components.interfaces.nsIWebProgress.STATE_DOCUMENT);
        this.addedFirstRunProgressListener = true;
      }
    },

    onLoad: function () {
      //Figure out if this is a first install/upgrade case.
      if (typeof AddonManager !== 'undefined') {
        //Firefox 4
        AddonManager.getAddonByID(openwebapps_EXT_ID, function (addon) {
          if (addon) {
            openwebapps.onInstallUpgrade(addon.version);
          }
        });
      } else {
        //Firefox before version 4.
        try {
          var em = Components.classes["@mozilla.org/extensions/manager;1"]
                   .getService(Components.interfaces.nsIExtensionManager),
              addon = em.getItemForID(openwebapps_EXT_ID);
          openwebapps.onInstallUpgrade(addon.version);
        } catch (e) {}
      }

      document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", this.onContextMenuItemShowing, false);

      this.initKeyCode();

      this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
                             .getService(Components.interfaces.nsIPrefService)
                             .getBranch("extensions." + openwebapps_EXT_ID + ".")
                             .QueryInterface(Components.interfaces.nsIPrefBranch2);

      this.prefs.addObserver("", this, false);

    },

    onUnload: function () {
      // initialization code
      if (this.addedFirstRunProgressListener) {
        gBrowser.getBrowserForTab(gBrowser.selectedTab).removeProgressListener(firstRunProgressListener);
      }

      document.getElementById("contentAreaContextMenu").removeEventListener("popupshowing", this.onContextMenuItemShowing, false);

      this.prefs.removeObserver("", this);
      this.prefs = null;

    },

    onFirstRun: function () {
      // create a hidden iframe and get it to load the standard contents
      // to prefill the cache
      var browser = gBrowser.getBrowserForTab(gBrowser.selectedTab);
      var notificationBox = gBrowser.getNotificationBox(browser);
      var iframeNode = document.createElement("browser");
      iframeNode.setAttribute("type", "content");
      iframeNode.setAttribute("style", "width: 100px; height: 100px; background: pink;");
      iframeNode.setAttribute("src", this.shareUrl);
      iframeNode.setAttribute("style", "visibility: collapse;");
      notificationBox.insertBefore(iframeNode, notificationBox.firstChild);

      //Taken from https://developer.mozilla.org/en/Code_snippets/Tabbed_browser
      function openAndReuseOneTabPerURL(url) {
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Components.interfaces.nsIWindowMediator);
        var browserEnumerator = wm.getEnumerator("navigator:browser"),
            rect, browser, buttonNode;

        // Check each browser instance for our URL
        var found = false;
        while (!found && browserEnumerator.hasMoreElements()) {
          var browserWin = browserEnumerator.getNext();
          var tabbrowser = browserWin.gBrowser;

          // Check each tab of this browser instance
          var numTabs = tabbrowser.browsers.length;
          for (var index = 0; index < numTabs; index++) {
            var currentBrowser = tabbrowser.getBrowserAtIndex(index);
            if (url === currentBrowser.currentURI.spec) {

              // The URL is already opened. Select this tab.
              tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];

              // Focus *this* browser-window
              browserWin.focus();

              buttonNode = browserWin.document.getElementById(buttonId);
              //Button may not be there if customized and removed from toolbar.
              if (buttonNode) {
                rect = buttonNode.getBoundingClientRect();
                browser = gBrowser.getBrowserForTab(tabbrowser.selectedTab);
  
                // try setting the button location as the window may have already loaded
                try {
                  sendJustInstalledEvent(browser, rect);
                } catch (ignore) { }
  
                // Add the load handler in case the window hasn't finished loaded (unlikely)
                browser.addEventListener("load", makeInstalledLoadHandler(browser, rect), true);
              }

              found = true;
              break;
            }
          }
        }

        // Our URL isn't open. Open it now.
        if (!found) {
          var recentWindow = wm.getMostRecentWindow("navigator:browser");
          if (recentWindow) {
            buttonNode = recentWindow.document.getElementById(buttonId);
            //Button may not be there if customized and removed from toolbar.
            if (buttonNode) {
              rect = buttonNode.getBoundingClientRect();
              // Use the existing browser (recent) Window
              var tab = recentWindow.gBrowser.loadOneTab(url, { referrerURI: null,
                                                               charset: null,
                                                               postData: null,
                                                               inBackground: false,
                                                               allowThirdPartyFixup: null });
              browser = gBrowser.getBrowserForTab(tab);
              browser.addEventListener("load",
                                      function buttonX() {
                                        browser.removeEventListener("load", buttonX, true);
                                        browser.contentWindow.wrappedJSObject.buttonX = rect.left + rect.width / 2;
                                        var evt = browser.contentWindow.wrappedJSObject.document.createEvent("Event");
                                        evt.initEvent("buttonX", true, false);
                                        browser.contentWindow.wrappedJSObject.dispatchEvent(evt);
                                      }, true);
            }
          }
          else {
            // No browser windows are open, so open a new one.
            window.open(url);
          }
        }
      }

      openAndReuseOneTabPerURL(this.frontpageUrl);
    },

    // This function is to be run once at onLoad
    // Checks for the existence of key code already and saves or gives it an ID for later
    // We could get away without this check but we're being nice to existing key commands
    initKeyCode: function() {
      var keys = document.getElementsByTagName("key");
      for (var i = 0; i < keys.length; i++) {
        // has the keycode we want to take and isn't already ours
        if (this.keycode == keys[i].getAttribute("keycode") &&
            this.keycodeId != keys[i].id) {

          if (keys[i].id)
            this.oldKeycodeId = keys[i].id;
          else
            keys[i].id = this.oldKeycodeId;

          break;
        }
      }
      this.setAccelKey(this.useAccelKey);
    },

  observe: function(subject, topic, data) {
    if (topic != "nsPref:changed") {
       return;
    }

    switch(data) {
      case "use-accel-key":
        try {
          var pref = subject.QueryInterface(Components.interfaces.nsIPrefBranch);
          openwebapps.setAccelKey(pref.getBoolPref("use-accel-key"));
        } catch(e) { error(e); }
        break;
    }

   },

    setAccelKey: function(keyOn) {
      var oldKey = document.getElementById(this.oldKeycodeId),
          f1Key = document.getElementById(this.keycodeId),
          keyset = document.getElementById("mainKeyset");

      if (keyOn) {
        try {
          if (oldKey) {
            oldKey.setAttribute("keycode", "")
          }
          f1Key.setAttribute("keycode", this.keycode);
        } catch (e) { error(e); }
      } else {
        try {
          f1Key.setAttribute("keycode", "");
          if (oldKey) {
            oldKey.setAttribute("keycode", this.keycode)
          }
        } catch (e) { error(e); }
      }

      // now we invalidate the keyset cache so our changes take effect
      var p = keyset.parentNode;
      p.appendChild(p.removeChild(keyset));

    },

    isValidURI: function (aURI) {
      //Only open the share frame for http/https urls, file urls for testing.
      return (aURI && (aURI.schemeIs('http') || aURI.schemeIs('https') || aURI.schemeIs('file')));
    },

    canShareURI: function (aURI) {
      var command = document.getElementById("cmd_openWebAppsDashboard");
      try {
        if (this.isValidURI(aURI))
          command.removeAttribute("disabled");
        else
          command.setAttribute("disabled", "true");
      } catch (e) {
        throw e;
      }
    },

    onContextMenuItemShowing: function (e) {
      try {
        var hide = (gContextMenu.onTextInput || gContextMenu.onLink ||
                    gContextMenu.onImage || gContextMenu.isContentSelected ||
                    gContextMenu.onCanvas || gContextMenu.onVideo ||
                    gContextMenu.onAudio),
            hideSelected = (gContextMenu.onTextInput || gContextMenu.onLink ||
                            !gContextMenu.isContentSelected ||
                            gContextMenu.onImage || gContextMenu.onCanvas ||
                            gContextMenu.onVideo || gContextMenu.onAudio);

        document.getElementById("context-openwebapps").hidden = hide;
        document.getElementById("context-openwebapps-separator").hidden = hide;

        document.getElementById("context-selected-openwebapps").hidden = hideSelected;
        document.getElementById("context-selected-openwebapps-separator").hidden = hideSelected;
      } catch (ignore) { }
    },

    onOpenShareCommand: function (e) {
      this.toggle();
    },

    onPopupWebAppPanelCommand: function(e) {
      // Create the panel
      let XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
      let xulPanel = document.createElementNS(XUL_NS, 'panel');
      xulPanel.setAttribute("transparent", "transparent");
      xulPanel.setAttribute("style", "-moz-appearance: none;background-color:transparent");

      let frame = document.createElementNS(XUL_NS, 'iframe');
      frame.setAttribute('type', 'content');
      frame.setAttribute('flex', '1');
      frame.setAttribute('transparent', 'transparent');
      frame.setAttribute('src', 'chrome://openwebapps/content/app_popup.html');
      xulPanel.appendChild(frame);
      document.getElementById("mainPopupSet").appendChild(xulPanel); //?

      let button = document.getElementById(buttonId);
      xulPanel.sizeTo(500,280);

      //dump("button bounding client rect is " + button.getBoundingClientRect().left + "," + button.getBoundingClientRect().top + "-" + button.getBoundingClientRect().right + "," + button.getBoundingClientRect().bottom + "\n");
      //dump("button client rects is " + button.getClientRects() + "\n");

      let rect = button.getBoundingClientRect();
      let x = rect.left - 450;
      let y = rect.bottom;

      xulPanel.openPopup(null, null, x, y); //button, "before_start", 0, 0);
    },

    toggle: function (options) {
      var selectedTab = gBrowser.selectedTab,
          tabFrame = selectedTab.openwebappsTabFrame;
      if (!tabFrame) {
        tabFrame = new TabFrame(selectedTab);
        selectedTab.openwebappsTabFrame = tabFrame;
      }

      if (tabFrame.visible) {
        tabFrame.hide();
      } else {
        tabFrame.show(options);
      }      
    }
  };

//         openwebapps.toggle(options);

  InjectorInit(window);
  var repo = Repo;
  injector.register({
    apibase: "navigator.apps", name: "install", script: null,
    getapi: function () {
      return function (args) {
        repo.install(gBrowser.contentDocument.location, args);
      }
  }});
  injector.register({
    apibase: "navigator.apps", name: "getInstalled", script: null,
    getapi: function () {
      return function (callback) {
        var result = repo.getInstalled(gBrowser.contentDocument.location);
        if (callback && typeof(callback) === 'function') callback(result);
      }
  }});
  injector.register({
    apibase: "navigator.apps", name: "getInstalledBy", script: null,
    getapi: function () {
      return function (callback) {
        var result = repo.getInstalledBy(gBrowser.contentDocument.location);
        if (callback && typeof(callback) === 'function') callback(result);
      }
  }});
  injector.register({
    apibase: "navigator.apps", name: "verify", script: null,
    getapi: function () {
      return function (args) {
        repo.verify(gBrowser.contentDocument.location, args);
      }
  }});
  injector.register({
    apibase: "navigator.apps", name: "setRepoOrigin", script: null,
    getapi: function () {
      return function (args) {
      }
  }});
  injector.register({
    apibase: "navigator.apps.mgmt", name: "launch", script: null,
    getapi: function () {
      return function (args) {
        repo.launch(gBrowser.contentDocument.location, args);
      }
  }});
  injector.register({
    apibase: "navigator.apps.mgmt", name: "list", script: null,
    getapi: function () {
      return function (callback) {
        var result = repo.list(gBrowser.contentDocument.location);
        if (callback) callback(result);
      }
  }});
  injector.register({
    apibase: "navigator.apps.mgmt", name: "loginStatus", script: null,
    getapi: function () {
      return function (args) {
        return repo.loginStatus(gBrowser.contentDocument.location, args);
      }
  }});
  injector.register({
    apibase: "navigator.apps.mgmt", name: "loadState", script: null,
    getapi: function () {
      return function (callback) {
        var result = repo.loadState(gBrowser.contentDocument.location);
        if (callback && typeof(callback) === 'function') callback(result);
      }
  }});
  injector.register({
    apibase: "navigator.apps.mgmt", name: "saveState", script: null,
    getapi: function () {
      return function (state, callback) {
        var result = repo.saveState(gBrowser.contentDocument.location, state);
        if (callback && typeof(callback) === 'function') {
          callback(result);
        }
      }
  }});
  injector.register({
    apibase: "navigator.apps.mgmt", name: "remove", script: null,
    getapi: function () {
      return function (key, callback) {
        var result = repo.remove(gBrowser.contentDocument.location, key);
        if (callback && typeof(callback) === 'function') callback(result);
      }
  }});

  window.addEventListener("load", fn.bind(openwebapps, "onLoad"), false);
  window.addEventListener("unload", fn.bind(openwebapps, "onUnload"), false);
}());
