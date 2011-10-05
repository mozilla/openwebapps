// A simple web-app implementing the 'test.basic' service.

navigator.mozApps.services.registerHandler('test.basic', "echoArgs",
  function(activity, credentials) {
    // just bounce the data back
    activity.postResult(activity.data);
  });

navigator.mozApps.services.registerHandler('test.basic', "testErrors",
  function(activity, credentials) {
    activity.postException({code: "testable_error", message: "a testable error"});
  }
);

navigator.mozApps.services.registerHandler('test.basic', "testErrorsThrown",
  function(activity, credentials) {
    throw "a thrown error";
  }
);

navigator.mozApps.services.ready();
