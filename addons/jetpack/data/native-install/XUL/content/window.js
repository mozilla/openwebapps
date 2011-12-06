
var Cu = Components.utils;
var Cc = Components.classes;
var Cm = Components.manager;
var Ci = Components.interfaces;

function doHandleMenuBar(toCall)
{
    // We need to pageMod in from the faker
    // TODO pass this into content code somehow
    window.alert("Menu bar item " + toCall + " was clicked!");
    return;
}

window.addEventListener("click", function(e) {
    // Make sure clicks remain in our context
    // TODO check to see if we are in same origin?
    if (e.target.nodeName == "A") {
        e.preventDefault();
        window.location = e.target.href;
    }
}, false);

// Commands:
var appName = "$APPNAME";
function newWindow()
{
    var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                       .getService(Components.interfaces.nsIWindowWatcher);
    var win = ww.openWindow(null, "chrome://webapp/content/window.xul",
                            null, "chrome,centerscreen,resizable", null);
}

//var app_sdk = {};
//Cu.import("resource://app-sdk/bootstrap.js", app_sdk);
//app_sdk.startup();


function loadBootstrapScope() {
var BOOTSTRAP_REASONS = {
  APP_STARTUP     : 1,
  APP_SHUTDOWN    : 2,
  ADDON_ENABLE    : 3,
  ADDON_DISABLE   : 4,
  ADDON_INSTALL   : 5,
  ADDON_UNINSTALL : 6,
  ADDON_UPGRADE   : 7,
  ADDON_DOWNGRADE : 8
};

  Cu.import("resource://gre/modules/NetUtil.jsm");    


  var appDirectory = Cc["@mozilla.org/file/directory_service;1"].
    getService(Ci.nsIProperties).  
    get("CurProcD", Ci.nsIFile);
            
  var aNsLocalFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
  aNsLocalFile.initWithFile(appDirectory);
  aNsLocalFile.appendRelativePath("app-sdk");
  aNsLocalFile.appendRelativePath("bootstrap.js");
  var uri = NetUtil.newURI(aNsLocalFile);
  Cu.reportError("bootstrap uri is "+ uri.spec);

  let principal = Cc["@mozilla.org/systemprincipal;1"].
                  createInstance(Ci.nsIPrincipal);
  var bootstrap = new Components.utils.Sandbox(principal,
                                            {sandboxName: uri.spec});

  let loader = Cc["@mozilla.org/moz/jssubscript-loader;1"].
               createInstance(Ci.mozIJSSubScriptLoader);

  try {
    // As we don't want our caller to control the JS version used for the
    // bootstrap file, we run loadSubScript within the context of the
    // sandbox with the latest JS version set explicitly.
    bootstrap.__SCRIPT_URI_SPEC__ = uri.spec;
    Components.utils.evalInSandbox(
      "Components.classes['@mozilla.org/moz/jssubscript-loader;1'] \
                 .createInstance(Components.interfaces.mozIJSSubScriptLoader) \
                 .loadSubScript(__SCRIPT_URI_SPEC__);", bootstrap, "ECMAv5");
  }
  catch (e) {
    Cu.reportError("Error loading bootstrap.js");
  }
  Cu.reportError("bootstrap uri is "+ bootstrap.URI);
  
  // setup some globals that may be expected

// Copy the reason values from the global object into the bootstrap scope.
for (let name in BOOTSTRAP_REASONS)
  bootstrap[name] = BOOTSTRAP_REASONS[name];

// Add other stuff that extensions want.
//const features = [ "Worker", "ChromeWorker" ];

//for each (let feature in features)
//  this.bootstrapScopes[aId][feature] = gGlobalScope[feature];

  // now we need to call setup in the bootstrap
    bootstrap['startup']();
}
loadBootstrapScope();
