// A simple web-app implementing the 'test.basic' service.

navigator.apps.services.registerHandler('test.basic', 
  function(activity) {

    if (activity.message === "echoArgs") {
      // just bounce the data back
      activity.postResult(activity.data);

    } else if (activity.message === "testErrors") {
      dump("Got testErrors\n")
      if (activity.data.type === "explicit_errob") {
        activity.postException({code: "testable_error", message: "a testable error"});
      } else if (activity.data.type === "explicit_params") {
        activity.postException("testable_error", "a testable error 2");
      } else if (activity.data.type === "implicit_string_exception") {
        throw "a testable error 3";
      } else {
        dump("testErrors doesn't know what to do!\n");
        // and just let things timeout...
      }      
    } else {
      activity.postException({code:"unknown_action"});
    }
  }
);

navigator.apps.services.ready();
