const {Cc, Ci, Cm, Cu, components} = require("chrome");


exports.getServiceInvocationHandler = function() {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
            .getService(Ci.nsIWindowMediator);
  let window = wm.getMostRecentWindow("navigator:browser");
  return window.serviceInvocationHandler;
}

function getTestAppOptions(activityName, appRelPath) {
  // first find the URL of the app.
  let lastSlash = module.uri.lastIndexOf("/");
  let manifest = module.uri.substr(0, lastSlash+1) + appRelPath;
  let origin = manifest.substr(0, manifest.lastIndexOf("/")+1);

  return {
    url: manifest,
    origin: origin,
    launch_url: origin,
    manifest: {
      name: activityName
    }
  };
};

// Ensure one of our test apps is installed and ready to go.
exports.installTestApp = function(activityName, appPath) {
  let { activityRegistry } = require("activities/services");
  let options = getTestAppOptions(activityName, appPath);
  activityRegistry.registerActivityHandler(activityName, options.url, activityName,
                                           options);
  return options;
};

// Uninstall our test app - by default (ie, with no errback passed), errors
// are "fatal".
exports.uninstallTestApp = function(activityName, appPath) {
  let { activityRegistry } = require("activities/services");
  let options = getTestAppOptions(activityName, appPath);
  activityRegistry.unregisterActivityHandler(activityName, options.url);
};

var call_counter = 0;
exports.invokeService = function(mediatorPanel, activity, cb, cberr) {
  let worker = mediatorPanel.handlers[activity.origin][activity.action][activity.message];
  call_counter++;
  activity.success = "test_invoke_success_"+call_counter;
  activity.error = "test_invoke_error_"+call_counter;
  function postResult(result) {
    worker.port.removeListener(activity.error, postException);
    cb(result);
  }
  function postException(result) {
    worker.port.removeListener(activity.success, postResult);
    cberr(result);
  }
  worker.port.once(activity.success, postResult)
  worker.port.once(activity.error, postException)
  worker.port.emit("owa.service.invoke", {
    activity: activity,
    credentials: {}
  });
}
