const {MediatorPanel} = require("services");
const FFRepoImpl = require("api").FFRepoImplService;
const {getOWA, installTestApp} = require("./helpers/helpers");
const {Cc, Ci, Cm, Cu, components} = require("chrome");

function getContentWindow() {
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                .getService(Ci.nsIWindowMediator);

  let topWindow = wm.getMostRecentWindow("navigator:browser");
  let gBrowser = topWindow.gBrowser;
  let element = gBrowser.getBrowserForTab(gBrowser.selectedTab);
  return element.contentWindow.wrappedJSObject;
}

// A subclass of the mediator used for testing.
function TestMediatorPanel(window, contentWindowRef, methodName, args, successCB, errorCB) {
  MediatorPanel.call(this, window, contentWindowRef, methodName, args, successCB, errorCB);
}
TestMediatorPanel.prototype = {
  __proto__: MediatorPanel.prototype,

  _createPopupPanel: function() {
    // We still use service2.html, but use a different content script tailored
    // for testing.
    let data = require("self").data;
    let thePanel = require("panel").Panel({
        contentURL: data.url("service2.html"),
        contentScriptFile: [
            data.url("mediatorapi.js"),
        ],
        contentScriptWhen: "start",
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
         "});",
        width: 484, height: 484
    });
    this.panel = thePanel;
  }
};


exports.test_invoke = function(test) {
  test.waitUntilDone();
  installTestApp(test, "apps/basic/basic.webapp", function() {
    // we don't yet have a "mediator" concept we can use, so we call some
    // internal methods to set things up bypassing the builtin mediator ui.
    let services = getOWA()._services;
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                .getService(Ci.nsIWindowMediator);
    let topWindow = wm.getMostRecentWindow("navigator:browser");
    let medPanel = new TestMediatorPanel(
      topWindow, getContentWindow(),
      "test.basic", {hello: "world"}, // serviceName, args
      function(result) { // success cb
        test.assertEqual(result.hello, "world");
        test.done();
      },
      function() { // error callback
        test.fail("error callback invoked");
      }
     );
    services._popups.push(medPanel);
    medPanel.attachHandlers();
    medPanel.show();
  });
};
