// A simple web-app implementing the 'test.basic' service.

navigator.apps.services.registerHandler('test.basic', "echoArgs",
  function(activity, credentials) {
    // just bounce the data back
    activity.postResult(activity.data);
  });

navigator.apps.services.registerHandler('test.basic', "testErrors",
  function(activity, credentials) {
    dump("Got testErrors\n")
    activity.postException({code: "testable_error", message: "a testable error"});
  }
);

navigator.apps.services.ready();
