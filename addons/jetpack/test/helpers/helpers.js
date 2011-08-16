const {Cc, Ci, Cm, Cu, components} = require("chrome");

// Return the "openwebapps" object.
exports.getOWA = function() {
  require("openwebapps/main"); // for the side effect of injecting window.apps.
  let repo = require("api").FFRepoImplService;
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
            .getService(Ci.nsIWindowMediator);
  let window = wm.getMostRecentWindow("navigator:browser");
  return window.apps;
}

function getTestAppOptions(appRelPath) {
  // first find the URL of the app.
  let lastSlash = module.id.lastIndexOf("/");
  let manifest = module.id.substr(0, lastSlash+1) + "../" + appRelPath;
  let origin = manifest.substr(0, manifest.lastIndexOf("/"));

  return {
    url: manifest,
    origin: origin,
    skipPostInstallDashboard: true // don't want the app panel to appear.
  };
};

// Ensure one of our test apps is installed and ready to go.
exports.installTestApp = function(test, appPath, callback, errback) {
  let repo = exports.getOWA()._repo;
  let options = getTestAppOptions(appPath);
  options.onerror = function(errob) {
    if (errback) {
      errback(errob);
    } else {
      // no errback so they expect success!
      test.fail("failed to install the test app: " + errob.code + "/" + errob.message);
      test.done();
    }
  };
  options.onsuccess = function() {
      callback();
  };
  repo.install('http://localhost:8420',
               options,
               undefined); // the window is only used if a prompt is shown.
};

// Uninstall our test app - by default (ie, with no errback passed), errors
// are "fatal".
exports.uninstallTestApp = function(test, appPath, callback, errback) {
  let repo = exports.getOWA()._repo;
  let options = getTestAppOptions(appPath);

  repo.uninstall(options.origin,
    function() { // success CB
      callback();
    },
    function(errob) { //errback
      if (errback) {
        errback(errob);
      } else {
        test.fail("failed to uninstall test app: " + errob.code + "/" + errob.message);
        test.done();
      }
    }
  );
};

// Ensure the test app is not installed.
exports.ensureNoTestApp = function(test, appPath, callback) {
  exports.uninstallTestApp(test, appPath,
                           function() {callback()}, function() {callback()});
}
