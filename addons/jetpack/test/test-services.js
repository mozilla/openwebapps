const FFRepoImpl = require("api").FFRepoImplService;
const {getOWA, installTestApp, getTestUrl} = require("./helpers/helpers");
const {Cc, Ci, Cm, Cu, components} = require("chrome");
const tabs = require("tabs");


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
  contentScriptFile: getTestUrl('apps/basic/success.js')
};

exports.test_invoke = function(test) {
  test.waitUntilDone();
  installTestApp(test, "apps/basic/basic.webapp", function() {
    // we don't yet have a "mediator" concept we can use, so we call some
    // internal methods to set things up bypassing the builtin mediator ui.
    let services = getOWA()._services;
    services.registerMediator("test.basic", TestMediator);
    let panel = services.get(
      {action:"test.basic", data: {hello: "world"}}, // simulate an Activity object
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


// Test that having 2 tabs, each with its own panel, works as expected.
exports.test_invoke_twice = function(test) {
  test.waitUntilDone();
  let services = getOWA()._services;
  let seenTab1Callback = false;
  services.registerMediator("test.basic", TestMediator);
  installTestApp(test, "apps/basic/basic.webapp", function() {
    tabs.open({
      url: "about:blank",
      onOpen: function(tab1) {
        tab1.on('ready', function(){
          // first tab is open - create and invoke our test app.
          let panel1 = services.get(
            {action:"test.basic", data:{hello: "world"}}, // simulate an Activity object
            function(result) { // success cb
              if (seenTab1Callback) {
                test.fail("first tab got success callback twice");
                test.done();
                return;
              }
              seenTab1Callback = true;
              test.assertEqual(result.hello, "world");
              // yay - worked in the first tab - try the second.
              panel1.panel.hide();
              tabs.open({
                url: "about:blank",
                onOpen: function(tab2) {
                  tab2.on('ready', function(){
                    let panel2 = services.get(
                      {action:"test.basic", data:{hello: "world"}}, // simulate an Activity object
                      function(result) { // success cb
                        test.assertEqual(result.hello, "world");
                        // yay - worked in the second tab too - all done!
                        tab2.close(function() {
                          tab1.close(function() {
                            test.done();
                          })
                        })
                      },
                      function() { // error callback
                        test.fail("error callback invoked");
                      }
                    );
                    panel2.show();
                  });
                }
              });
            },
            function() { // error callback
              test.fail("error callback invoked");
            }
          );
          panel1.show();
        });
      }
    });
  });
}

// Error tests.
TestMediatorError = {
  url: getTestUrl("apps/testable_mediator.html"),
  contentScriptFile: getTestUrl('apps/basic/error.js')
};

// A helper for the error tests.
function testError(test, mediator, activity, errchecker) {
  test.waitUntilDone();
  installTestApp(test, "apps/basic/basic.webapp", function() {
    let services = getOWA()._services;
    services.registerMediator("test.basic", mediator);
    let panel = services.get(
      activity,
      function(result) { // success cb
        services._popups.pop();
        errchecker(result);
      },
      function(errob) { // error callback
        test.fail("error callback invoked");
        services._popups.pop();
        test.done();
      }
    );
    panel.show();
  });
}

exports.test_invoke_error = function(test) {
  testError(test, TestMediatorError,
    {action:"test.basic", message: 'testErrors', data:{}},
    function(errob) {
      test.assertEqual(errob.code, "testable_error");
      test.assertEqual(errob.message, "a testable error");
      test.done();
    });
};


exports.test_invoke_error_thrown = function(test) {
  testError(test, TestMediatorError,
    {action:"test.basic", message: 'testErrorsThrown', data:{}},
    function(errob) {
      test.assertEqual(errob.code, "runtime_error");
      test.assertEqual(errob.message, "a thrown error");
      test.done();
    });
};
