/*
 * A mock set of activities
 */

// this is meant purely as a shim, won't work with other activity
// or web apps code for now

var apps = null;

if (window.opener && window.opener.navigator.apps) {
  apps = window.opener.navigator.apps;
}

if ((window.top != window) && window.parent && window.parent.navigator.apps) {
  apps = window.parent.navigator.apps;
}

if (!apps) {
  apps = (function() {
    var isReady = false;
    var credential = null;
    var afterLoginFunc = null;
    var loginWindow = null;
    
    var FAILURE = "failure";
    var CREDENTIAL_FAILURE = "credential_failure";
    
    var HANDLERS = {};

    var SHARE_TYPES = null;

    var LOGIN_PAGE = null;
    var SHARE_PAGE = null;

    var makeCall = function(activity, message, args, onsuccess, onerror) {
      if (!credential) {
        // first do login, and then share
        return doLogin(function() {makeCall(activity, message, args, onsuccess, onerror);});
      }

      var activity_obj = HANDLERS[activity];
      if (!activity_obj)
        return;
      
      var handler = activity_obj[message];
      if (!handler)
        return;

      // call the share handler
      handler({
        FAILURE: FAILURE,
        CREDENTIAL_FAILURE: CREDENTIAL_FAILURE,
        activity: activity,
        action: message,
        data: args,
        postResult: function(result) {
          onsuccess(result);
        },
        postException: function(exception) {
          // if credential problem
          if (exception == CREDENTIAL_FAILURE) {
            // we don't have a user click, so we have to alert
            credential = null;
            alert("Credential failure.\nIn this test harness, we can't open a window at this point, so take action again again.");
          } else {
            onerror(exception);
          }
        }
      }, credential);
    };

    var currentShareType = function() {
      return _.select(SHARE_TYPES, function(st) {
        return st.type == $('#shareType option:selected').val();
      })[0];
    };
    
    var setup = function(cb) {
      // get parameters
      makeCall(
        'http://webactivities.org/share', 'getParameters', {},
        function(params) {
          // set up the UI
          SHARE_TYPES = params.shareTypes;

          _.each(SHARE_TYPES, function(shareType) {
            $('#shareType').append($('<option>', {value: shareType.type}).text(shareType.name));
            $('#shareType').change(function() {
              var shareType = currentShareType();
              if (shareType.toLabel) {
                $('#recipient').show();
                $('#toLabel').html(shareType.toLabel);
              } else {
                $('#recipient').hide();
              }
            });
            $('#shareType').change();
          });
          
          $('#share').show();
          $('#setup').hide();
          
          // done
          if (cb)
            cb();    
        },
        function(error) {});
    };
    
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
      loginWindow = window.open(LOGIN_PAGE, "activities-login", "status=0,toolbar=0,menubar=0,height=350,width=320");
      loginWindow.moveTo(100,100);
      afterLoginFunc = next;
    };
    
    // called once the user is logged in
    var doShare = function(message) {
      var args = {
        message:message
      };

      var shareType = currentShareType();
      
      if (shareType.toLabel) {
        args['recipients'] = _.map($('#recipients_input').val().split(","), function(r) {return r.trim()});
      }
      
      makeCall("http://webactivities.org/share",
               "send",
               args,
               function(result) {
                 $('#log').append("posted <em>" + result.messagePosted + "</em>");
                 if (result.recipients) {
                   $('#log').append(" to <em>" + result.recipients.join(", ") + "</em>");
                 }
                 $('#log').append("<br />");
               },
               function(exception) {
                 alert('exception happened: ' + exception.toString());
               });
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

    var storeCredential = function(c) {
      loginWindow.close();
      credential = c;
      document.getElementById('credentials').innerHTML = "logged in as <em>" + c.displayName + "</em><br />Reload this page to clear credentials.";
      afterLoginFunc();    
    };

    // quick hack for Twitter
    $.get("/twitter.webapp", function(result) {
      var manifest = JSON.parse(result);
      LOGIN_PAGE = manifest.services['http://webactivities.org/login'].path;
      SHARE_PAGE = manifest.services['http://webactivities.org/share'].path;

      $('body').append($("<iframe>", {src: SHARE_PAGE, width: "0px", height: "0px", border: "0", frameborder: "0"}));
    });

    return {
      services: {
        registerHandler: registerHandler,
        ready: ready,
        storeCredential: storeCredential,
        testShare: testShare,
        setup: setup
      }
    };
  })();
};

navigator.apps = apps;


