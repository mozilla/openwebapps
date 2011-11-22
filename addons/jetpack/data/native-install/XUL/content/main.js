
var Cu = Components.utils;
var Cc = Components.classes;
var Ci = Components.interfaces;

var os = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS;
    
// only make the tiny window that handles window closing events (and quits the app) for Mac OS
if ("Darwin" === os) {
  var observer = {
    observe: function(contentWindow, aTopic, aData) {
      if (aTopic == 'xul-window-destroyed') {
        // If there is nothing left but the main (invisible) window, quit
        var wm = Cc["@mozilla.org/appshell/window-mediator;1"]  
          .getService(Ci.nsIWindowMediator);  
        var enumerator = wm.getEnumerator("app");
        if (enumerator.hasMoreElements()) return;

        var appStartup = Cc["@mozilla.org/toolkit/app-startup;1"].getService(Ci.nsIAppStartup);
          appStartup.quit(appStartup.eAttemptQuit);
        }
    }
  }

  // Register our observer:
  var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
  observerService.addObserver(observer, "xul-window-destroyed", false);
};

// Create the first window
var appName = "$APPNAME";
var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
                   .getService(Ci.nsIWindowWatcher);
var win = ww.openWindow(null, "chrome://webapp/content/window.xul",
                        appName, "chrome,centerscreen,resizable", null);
