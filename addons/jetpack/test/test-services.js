const services = require("services");
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

function createTestMediatorPanel() {
  // We still use service2.html, but use a different content script tailored
  // for testing.
  let data = require("self").data;
  let thePanel = require("panel").Panel({
    id: 'test-mediator-panel',
      contentURL: data.url("service2.html"),
      contentScriptFile: [
          data.url("mediatorapi.js"),
      ],
      contentScript:
       "window.navigator.apps.mediation.ready(function(method, args, services) {" +
       "  let service = services[0];" +
       "  document.getElementById('servicebox').appendChild(service.iframe);" +
       "  service.on('ready', function() {" +
       "    service.call('echoArgs', args, function(result) {" +
       "      self.port.emit('result', result);" +
       "    });" +
       "  });" +
       "});",
      width: 484, height: 484
  });
  return thePanel;
};

exports.test_invoke = function(test) {
  test.waitUntilDone();
  installTestApp(test, "apps/basic/basic.webapp", function() {
    // we don't yet have a "mediator" concept we can use, so we call some
    // internal methods to set things up bypassing the builtin mediator ui.

    // installing an app makes the dashboard appear, if you don't close it, you get exceptions
    // bug 678238
    let owa = getOWA();
    owa._ui._panel.hide();

    let services = getOWA()._services;
    let thePanelRecord = { contentWindow: getContentWindow(),
                           panel: createTestMediatorPanel(),
                           methodName: "test.basic",
                           args: {hello: "world"},
                           successCB: function(result) {
                            test.assertEqual(result.hello, "world");
                            test.done();
                           },
                           errorCB: function() {
                            test.fail("error callback invoked");
                           },
                           isConfigured: true
    };
    services._popups.push(thePanelRecord);
    services._configureContent(thePanelRecord);
    services.show(thePanelRecord);
  });
};
