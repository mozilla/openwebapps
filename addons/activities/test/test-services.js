const {getServiceInvocationHandler, installTestApp, invokeService} = require("./helpers");
const {Cc, Ci, Cm, Cu, components} = require("chrome");
const tabs = require("tabs");

// ensure activities is activated
require("activities/main").main();

exports.test_invoke = function(test) {
  test.waitUntilDone();
  let options = installTestApp("test.basic", "apps/basic/basic.html");

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
};


// Test that having 2 tabs, each with its own invocation, works as expected.
exports.test_invoke_twice = function(test) {
  test.waitUntilDone();
  let services = getServiceInvocationHandler();
  let seenTab1Callback = false;
  let options = installTestApp("test.basic", "apps/basic/basic.html");

    tabs.open({
      url: "about:blank",
      onOpen: function(tab1) {
        tab1.on('ready', function(){
          // first tab is open - create and invoke our test app.
          let activity = {action:"test.basic",
                          origin: options.origin,
                          message: "echoArgs",
                          data: {hello: "world"}};
          let mediator = services.get(activity);
          mediator.panel.port.once("owa.mediation.ready", function() {
            test.waitUntil(function() {return mediator.panelWindow}
            ).then(function() {
              invokeService(mediator, activity,
                function(result) { // success cb
                  if (seenTab1Callback) {
                    test.fail("first tab got success callback twice");
                    test.done();
                    return;
                  }
                  seenTab1Callback = true;
                  test.assertEqual(result.hello, "world");
                  // yay - worked in the first tab - try the second.
                  tabs.open({
                    url: "about:blank",
                    onOpen: function(tab2) {
                      tab2.on('ready', function() {
                        // The panel should have been hidden as the new tab was created.
                        test.assert(!mediator.panel.isShowing);
                        activity.data.hello = "world2";
                        invokeService(mediator, activity,
                          function(result) { // success cb
                            test.assertEqual(result.hello, "world2");
                            // yay - worked in the second tab too - all done!
                            tab2.close(function() {
                              tab1.close(function() {
                                test.done();
                              })
                            })
                          },
                          function() { // error callback
                            test.fail("error callback invoked");
                            test.done();
                          }
                        );
                      });
                    }
                  });
                },
                function() { // error callback
                  test.fail("error callback invoked");
                  test.done();
                }
              );
            });
          });
        });
      }
    });
}

exports.test_panel_auto_hides_on_tab_switch = function(test) {
  test.waitUntilDone();
  let services = getServiceInvocationHandler();
  let seenTab1Callback = false;
  let options = installTestApp("test.basic", "apps/basic/basic.html");

    tabs.open({
      url: "about:blank",
      onOpen: function(tab1) {
        tab1.on('ready', function(){
          tab1.title = "tab 1";
          // first tab is open - create and invoke our test app.
          let activity = {action:"test.basic",
                          origin: options.origin,
                          message: "echoArgs",
                          data: {hello: "world"}};
          let mediator = services.get(activity);
          mediator.panel.once("show", function() {
            test.waitUntil(function() {return mediator.panel.isShowing}
            ).then(function() {
              // mediator is showing - create a new tab and make sure it goes away.
              tabs.open({
                url: "about:blank",
                onOpen: function(tab2) {
                  tab2.on('ready', function() {
                    tab2.title = "tab 2";
                    // The panel should have been hidden as the new tab was created.
                    test.assert(!mediator.panel.isShowing);
                    // call get() again to ensure we are setup on the new tab.
                    services.get(activity);
                    // Show it for the second tab, then switch to the first -
                    // should get auto-hidden.
                    mediator.show();
                    test.waitUntil(function() {return mediator.panel.isShowing}
                    ).then(function() {
                      tab1.activate();
                      test.waitUntil(function() {return tabs.activeTab === tab1 && !mediator.panel.isShowing}
                      ).then(function() {
                        test.assert(!mediator.panel.isShowing);
                        // and swing back to the second tab with the same checks.
                        mediator.show();
                        test.waitUntil(function() {return mediator.panel.isShowing}
                        ).then(function() {
                          tab2.activate();
                          test.waitUntil(function() {return tabs.activeTab === tab2 && !mediator.panel.isShowing}
                          ).then(function() {
                            test.done();
                          });
                        });
                      });
                    });
                  });
                }
              });
            });
          });
          mediator.show();
        })
      }
    })
}

exports.test_panel_auto_hides_on_tab_close = function(test) {
  test.waitUntilDone();
  let services = getServiceInvocationHandler();
  let seenTab1Callback = false;
  let options = installTestApp("test.basic", "apps/basic/basic.html");

    tabs.open({
      url: "about:blank",
      onOpen: function(tab) {
        tab.on('ready', function(){
          // tab is open - create and invoke our test app.
          let activity = {action:"test.basic",
                          origin: options.origin,
                          message: "echoArgs",
                          data: {hello: "world"}};
          let mediator = services.get(activity);
          mediator.panel.once("show", function() {
            test.waitUntil(function() {return mediator.panel.isShowing}
            ).then(function() {
              // mediator is showing - close the tab and make sure it goes away.
              tab.close();
              test.waitUntil(function() {return tabs.activeTab !== tab && !mediator.panel.isShowing}
              ).then(function() {
                // panel is closed so we worked!
                test.done();
              });
            });
          });
          mediator.show();
        })
      }
    })
}

// A helper for the error tests.
function testError(test, activity, errchecker) {
  test.waitUntilDone();
  let options = installTestApp("test.basic", "apps/basic/basic.html");

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
