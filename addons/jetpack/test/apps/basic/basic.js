// A simple web-app implementing the 'test.basic' service.

navigator.apps.services.registerHandler('test.basic', 'echoArgs',
  function(args, cb, cberr) {
    cb(args);
  }
);

navigator.apps.services.ready();
