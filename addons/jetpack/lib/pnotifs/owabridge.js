const url = require("url");

var {FFRepoImplService} = require("api");

const pushNotifications = require("pnotifs/main");

// TODO: Find a way to generate random UUIDs that doesn't require chrome authority.
const {Cc, Ci, Cm, Cu, Cr, components} = require("chrome");
const Weave = Cu.import("resource://services-sync/main.js").Weave;

OWANotificationsBridge = function() {
    var notifClients = {};
    
    function requestPermissions(window, params, callbackFunc) {
        var postOfficeHost = url.URL(window.location).host;
        var postOfficePort = 8000;
        
        var notifClient = notifClients[postOfficeHost];
        if (!notifClient) {
            // For now, we'll assume that every notifications host is running the POST office
            // on port 8000. We should (TODO) insert that into the params for requestPermissions though.
            
            // We'll also assume that the client agent is running at the same address as the POST office.
            
            var postOfficeURL = 'http://' + postOfficeHost + ':' + postOfficePort + '/';
            notifClient = new pushNotifications.Client(postOfficeURL, postOfficeURL);
            notifClients[postOfficeHost] = notifClient;
            
            // For now, a random UUID is the identifier and password.
            notifClient.username = genRandomUUID();
            notifClient.password = '';
            console.log("new UUID username: " + notifClient.username);
            
            notifClient.createUserQueue(function() {
                notifClient.authSuccess(params, callbackFunc, postOfficeHost + ':' + postOfficePort); 
            });
            
            function onNotification(notifBody) {
                FFRepoImplService.getAppByUrl(window.location, function(app) {
                    if (!app) return;
                    
                    if (app.services && app.services['pushnotifications.notification']) {
                        var services = require("services");
                        var serviceInterface = new services.serviceInvocationHandler(window);
                        serviceInterface.invokeService(window.wrappedJSObject,
                                                       'pushnotifications.notification', 'notification',
                                                       {'notif' : notifBody},
                                                       function(result) {});
                    }
                    else {
                        notifClient.displayNotification(notifBody);
                    }
                });
            }
            notifClient.onNotification = onNotification;
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