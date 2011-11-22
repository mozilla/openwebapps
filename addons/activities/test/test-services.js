const FFRepoImpl = require("openwebapps/api").FFRepoImplService;
const {getServiceInvocationHandler, installTestApp, invokeService} = require("./helpers");
const {Cc, Ci, Cm, Cu, components} = require("chrome");
const tabs = require("tabs");

// ensure activities is activated
require("activities/main").main();

exports.test_invoke = function(test) {
  test.waitUntilDone();
  installTestApp(test, "apps/basic/basic.webapp", function(options) {
    // we don't yet have a "mediator" concept we can use, so we call some
    // internal methods to set things up bypassing the builtin mediator ui.
    let activity = {action:"test.basic",
                    origin: options.origin,
                    message: "echoArgs",
                    data: {hello: "world"}};
    let services = getServiceInvocationHandler();
    let mediator = services.get(activity);
    mediator.panel.port.once("owa.mediation.ready", function() {
      test.waitUntil(function() {return mediator.panelWindow}
      ).then(function() {
        invokeService(mediator, activity,
          function(result) { // success cb
            mediator.panel.hide();
            test.assertEqual(result.hello, "world");
            test.done();
          },
          function() { // error callback
            mediator.panel.hide();
            test.fail("error callback invoked");
          }
        );
      });
    });
    mediator.show();
  });
};


// Test that having 2 tabs, each with its own panel, works as expected.
// XXX disabled test, this tested a situation that was valid when we had
// one panel per tab.
test_invoke_twice = function(test) {
  test.waitUntilDone();
  let services = getServiceInvocationHandler();
  let seenTab1Callback = false;
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


// A helper for the error tests.
function testError(test, activity, errchecker) {
  test.waitUntilDone();
  installTestApp(test, "apps/basic/basic.webapp", function(options) {
    // we don't yet have a "mediator" concept we can use, so we call some
    // internal methods to set things up bypassing the builtin mediator ui.
    activity.origin = options.origin;
    let services = getServiceInvocationHandler();
    let mediator = services.get(activity);
    mediator.panel.port.once("owa.mediation.ready", function() {
      test.waitUntil(function() {return mediator.panelWindow}
      ).then(function() {
        invokeService(mediator, activity,
          function(result) { // success cb
            mediator.panel.hide();
            services._popups.pop();
            errchecker(result);
          },
          function(errob) { // error callback
            mediator.panel.hide();
            services._popups.pop();
            errchecker(errob);
          }
        );
      });
    });
    mediator.show();
  });
}

exports.test_invoke_error = function(test) {
  testError(test,
    {action:"test.basic", message: 'testErrors', data:{}},
    function(errob) {
      test.assertEqual(errob.code, "testable_error");
      test.assertEqual(errob.message, "a testable error");
      test.done();
    });
};


exports.test_invoke_error_thrown = function(test) {
  testError(test,
    {action:"test.basic", message: 'testErrorsThrown', data:{}},
    function(errob) {
      test.assertEqual(errob.code, "runtime_error");
      test.assertEqual(errob.message, "a thrown error");
      test.done();
    });
};
