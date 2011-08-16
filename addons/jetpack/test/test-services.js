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

// We still use service2.html, but use different content scripts tailored
// for testing.
let contentScriptSuccess =
  "window.navigator.apps.mediation.ready(function(method, args, services) {" +
  "  let service = services[0];" +
  "  document.getElementById('servicebox').appendChild(service.iframe);" +
  "  service.on('ready', function() {" +
  "    service.call('echoArgs', args, function(result) {" +
  "      self.port.emit('result', result);" +
  "    });" +
  "  });" +
  "});"

let contentScriptError =
  "window.navigator.apps.mediation.ready(function(method, args, services) {" +
  "  let service = services[0];" +
  "  document.getElementById('servicebox').appendChild(service.iframe);" +
  "  service.on('ready', function() {" +
  "    service.call('testErrors', args, function(result) {" +
  "      self.port.emit('result', {code: 'test_failure', msg: 'unexpected success callback'});" +
  "    }, function(errob) {" +
  "      self.port.emit('result', errob);" +
  "    });" +
  "  });" +
  "});"

function createTestMediatorPanel(contentScript) {
  let data = require("self").data;
  let thePanel = require("panel").Panel({
    id: 'test-mediator-panel',
      contentURL: data.url("service2.html"),
      contentScriptFile: [
          data.url("mediatorapi.js"),
      ],
      contentScript: contentScript,
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
                           panel: createTestMediatorPanel(contentScriptSuccess),
                           methodName: "test.basic",
                           args: {hello: "world"},
                           successCB: function(result) {
                            test.assertEqual(result.hello, "world");
                            services._popups.pop();
                            test.done();
                           },
                           errorCB: function() {
                            test.fail("error callback invoked");
                            services._popups.pop();
                            test.done();
                           },
                           isConfigured: true
    };
    services._popups.push(thePanelRecord);
    services._configureContent(thePanelRecord);
    services.show(thePanelRecord);
  });
};

// A helper for the error tests.
function testError(test, testType, errchecker) {
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
                           panel: createTestMediatorPanel(contentScriptError),
                           methodName: "test.basic",
                           args: {type: testType},
                           successCB: function(result) {
                            services._popups.pop();
                            errchecker(result);
                           },
                           errorCB: function(errob) {
                            test.fail("error callback invoked");
                            services._popups.pop();
                            test.done();
                           },
                           isConfigured: true
    };
    services._popups.push(thePanelRecord);
    services._configureContent(thePanelRecord);
    services.show(thePanelRecord);
  });
}

exports.test_invoke_error_explicit_ob = function(test) {
  testError(test, "explicit_errob", function(errob) {
    test.assertEqual(errob.code, "testable_error");
    test.assertEqual(errob.message, "a testable error");
    test.done();
  });
};

exports.test_invoke_error_explicit_params = function(test) {
  testError(test, "explicit_params", function(errob) {
    test.assertEqual(errob.code, "testable_error");
    test.assertEqual(errob.message, "a testable error");
    test.done();
  });
};

exports.test_invoke_error_implicit_string_exception = function(test) {
  testError(test, "implicit_string_exception", function(errob) {
    test.assertEqual(errob.code, "runtime_error");
    test.assertEqual(errob.message, "a testable error");
    test.done();
  });
};
