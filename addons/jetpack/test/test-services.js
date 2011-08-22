const {MediatorPanel} = require("services");
const FFRepoImpl = require("api").FFRepoImplService;
const {getOWA, installTestApp, getTestUrl} = require("./helpers/helpers");
const {Cc, Ci, Cm, Cu, components} = require("chrome");

function getContentWindow() {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                .getService(Ci.nsIWindowMediator);

  let topWindow = wm.getMostRecentWindow("navigator:browser");
  let gBrowser = topWindow.gBrowser;
  let element = gBrowser.getBrowserForTab(gBrowser.selectedTab);
  return element.contentWindow.wrappedJSObject;
}

TestMediator = {
  url: getTestUrl("apps/testable_mediator.html"),
  contentScript:
    "window.navigator.apps.mediation.ready(function(method, args, services) {" +
    "  let service = services[0];" +
    // XXX - why is unsafeWindow needed here???
    "  unsafeWindow.document.getElementById('servicebox').appendChild(service.iframe);" +
    "  service.on('ready', function() {" +
    "    service.call('echoArgs', args, function(result) {" +
    "      self.port.emit('result', result);" +
    "    });" +
    "  });" +
    "});"
};


exports.test_invoke = function(test) {
  test.waitUntilDone();
  installTestApp(test, "apps/basic/basic.webapp", function() {
    // we don't yet have a "mediator" concept we can use, so we call some
    // internal methods to set things up bypassing the builtin mediator ui.
    let services = getOWA()._services;
    services.registerMediator("test.basic", TestMediator);
    let panel = services.get(
      getContentWindow(),
      "test.basic", {hello: "world"}, // serviceName, args
      function(result) { // success cb
        test.assertEqual(result.hello, "world");
        test.done();
      },
      function() { // error callback
        test.fail("error callback invoked");
      }
    );
    panel.show();
  });
};
