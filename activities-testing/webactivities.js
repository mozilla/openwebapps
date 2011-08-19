/*
 * A mock set of activities
 */

// this is meant purely as a shim, won't work with other activity
// or web apps code for now

navigator.apps = (function() {
  var isReady = false;
  var credential = null;
  var afterLoginFunc = null;

  var HANDLERS = {};
  
  var ready = function() {
    isReady = true;
  };

  var registerHandler = function(activity, action, handler) {
    if (!HANDLERS[activity]) {
      HANDLERS[activity] = {};
    }

    // we overwrite the handler for now, there should be only one
    HANDLERS[activity][action] = handler;
  };

  var doLogin = function(next) {
  };
  
  // called once the user is logged in
  var doShare = function() {
    if (!credential) {
      // first do login, and then share
      return doLogin(doShare);
    }
    
    var share_activity = HANDLERS["http://webactivities.org/share"]
    if (!share_activity)
      return;
    
    var handler = share_activity["doShare"];
    if (!handler)
      return;

    // call the share handler
    handler({
      activity: "http://webactivities.org/share",
      action: "doShare",
      postResult: function(result) {
      },
      postException: function(exception) {
      },
    }, {message: "sharing test message"}, credential);
  };
  
  // this tests the share functionality
  // that's all
  var test = function() {
    if (!isReady)
      return;

    doShare();
  };

  var storeCredential = function(c) {
    credential = c;
    afterLoginFunc();
  };
  
  return {
    services: {
      registerHandler: registerHandler,
      ready: ready,
      storeCredential: storeCredential,
      test: test
    }
  };
})();