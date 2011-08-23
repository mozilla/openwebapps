/*
 * A mock set of activities
 */

// this is meant purely as a shim, won't work with other activity
// or web apps code for now

navigator.apps = (function() {
  var isReady = false;
  var credential = null;
  var afterLoginFunc = null;
  var loginWindow = null;

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
    loginWindow = window.open("login.html");
    afterLoginFunc = next;
  };
  
  // called once the user is logged in
  var doShare = function(message) {
    if (!credential) {
      // first do login, and then share
      return doLogin(function() {doShare(message);});
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
      data: {message: message},
      postResult: function(result) {
        alert('got successful result: ' + result.messagePosted);
      },
      postException: function(exception) {
        alert('exception happened: ' + exception.toString());
      },
    }, credential);
  };
  
  // this tests the share functionality
  // that's all
  var testShare = function(message) {
    if (!isReady) {
      alert('not ready');
      return;
    }

    doShare(message);
  };

  var _internalStoreCredential= function(c) {
    loginWindow.close();
    credential = c;
    document.getElementById('credentials').innerHTML = JSON.stringify(c);
    afterLoginFunc();    
  };
  
  var storeCredential = function(c) {
    // this is being called in the login page
    // we make the assumption that we can reach into the caller
    window.opener.navigator.apps.services._internalStoreCredential(c);
  };
  
  return {
    services: {
      registerHandler: registerHandler,
      ready: ready,
      storeCredential: storeCredential,
      _internalStoreCredential: _internalStoreCredential,
      testShare: testShare
    }
  };
})();