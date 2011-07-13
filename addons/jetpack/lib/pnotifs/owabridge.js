const url = require("url");

const pushNotifications = require("pnotifs/main");

// TODO: Find a way to generate random UUIDs that doesn't require chrome authority.
const {Cc, Ci, Cm, Cu, Cr, components} = require("chrome");
const Weave = Cu.import("resource://services-sync/main.js").Weave;

OWANotificationsBridge = function() {
    var notifClients = {};
    
    function requestPermissions(window, params, callbackFunc) {
        console.log('in requestPermissions');
        var postOfficeHost = url.URL(window.location).host;
        var postOfficePort = 8000;
        if (!notifClients[postOfficeHost]) {
            // For now, we'll assume that every notifications host is running the POST office
            // on port 8000. We should (TODO) insert that into the params for requestPermissions though.
            
            // We'll also assume that the client agent is running at the same address as the POST office.
            
            var postOfficeURL = 'http://' + postOfficeHost + ':' + postOfficePort + '/';
            notifClients[postOfficeHost] = new pushNotifications.Client(postOfficeURL, postOfficeURL);
            
            // For now, a random UUID is the identifier and password.
            notifClients[postOfficeHost].username = genRandomUUID();
            notifClients[postOfficeHost].password = '';
            console.log("new UUID username: " + notifClients[postOfficeHost].username);
            
            notifClients[postOfficeHost].createUserQueue(function() {
               notifClients[postOfficeHost].authSuccess(params, callbackFunc, postOfficeHost + ':' + postOfficePort); 
            });
        }
    }
    
    function genRandomUUID() {
        var uuidGenerator = Cc["@mozilla.org/uuid-generator;1"]
                           .getService(Ci.nsIUUIDGenerator);
        return uuidGenerator.generateUUID().toString();
    }
    return {
        init: function init() {
            pushNotifications.injectNotificationsAPI(requestPermissions);
        }
    };
}();

exports['OWANotificationsBridge'] = OWANotificationsBridge;