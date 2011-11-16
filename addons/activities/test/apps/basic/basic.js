// A simple web-app implementing the 'test.basic' service.
navigator.mozActivities.services.registerHandler('test.basic', "init",
  // support the default mediator by supplying the init handler
  function(activity) {});

navigator.mozActivities.services.registerHandler('test.basic', "echoArgs",
  function(activity, credentials) {
    // just bounce the data back
    activity.postResult(activity.data);
  });

navigator.mozActivities.services.registerHandler('test.basic', "testErrors",
  function(activity, credentials) {
    activity.postException({code: "testable_error", message: "a testable error"});
  }
);

navigator.mozActivities.services.registerHandler('test.basic', "testErrorsThrown",
  function(activity, credentials) {
    throw "a thrown error";
  }
);

navigator.mozActivities.services.ready();
