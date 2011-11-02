var observer = {
    observe: function(contentWindow, aTopic, aData) {
        if (aTopic == 'xul-window-destroyed') {
            // If there is nothing left but the main (invisible) window, quit
            var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]  
                       .getService(Components.interfaces.nsIWindowMediator);  
            var enumerator = wm.getEnumerator("app");
            if(enumerator.hasMoreElements()) return;

            var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"].getService(Components.interfaces.nsIAppStartup);
            appStartup.quit(appStartup.eAttemptQuit);
        }
    }
};

// Register our observer:
var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
observerService.addObserver(observer, "xul-window-destroyed", false);

// Create the first window
var appName = "$APPNAME";
var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                   .getService(Components.interfaces.nsIWindowWatcher);
var win = ww.openWindow(null, "chrome://webapp/content/window.xul",
                        appName, "chrome,centerscreen", null);
