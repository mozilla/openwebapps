// A simple web-app implementing the 'test.basic' service.

navigator.apps.services.registerHandler('test.basic', 'echoArgs',
  function(args, cb, cberr) {
    cb(args);
  }
);

navigator.apps.services.registerHandler('test.basic', 'testErrors',
  function(args, cb, cberr) {
    if (args.type === "explicit_errob") {
      cberr({code: "testable_error", message: "a testable error"});
    } else if (args.type === "explicit_params") {
      cberr("testable_error", "a testable error");
    } else if (args.type === "implicit_string_exception") {
      throw "a testable error";
    } else {
      dump("testErrors doesn't know what to do!\n");
      // and just let things timeout...
    }
  }
);


navigator.apps.services.ready();
