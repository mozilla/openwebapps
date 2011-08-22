const dataDir = require("self").data;
const inject = require('pnotifs/inject');
const notifications = require("notifications");
const panel = require("panel");
const pageMod = require("page-mod");
const tabs = require("tabs");
const url = require("url");
const widgets = require("widget");
const windows = require("windows")

const amqp = require("pnotifs/amqp091/connection");
const Engine = require("./engine").Engine;

const {Cc,Ci,Cu} = require("chrome");

const Svc = Cu.import("resource://services-sync/util.js").Svc;
const Weave = Cu.import("resource://services-sync/main.js").Weave;

const ServicesRes = Cu.import("resource://services-sync/resource.js");
const AsyncResource = ServicesRes.AsyncResource;
// FIXME: BrokenBasicAuthenticator works only for ASCII passwords
const BasicAuthenticator = ServicesRes.BrokenBasicAuthenticator;


// Utter hackery, necessary to access the window.btoa/atob function.
// source: http://cat-in-136.blogspot.com/2010/08/tip-calling-windowatob-and-btoa-from.html
var win = require("window-utils").windowIterator().next();
var btoa = win.QueryInterface(Ci.nsIDOMWindowInternal).btoa;
var atob = win.QueryInterface(Ci.nsIDOMWindowInternal).atob;
function utf8_to_b64( str ) {
    return btoa(unescape(encodeURIComponent( str )));
}
function b64_to_utf8( str ) {
    return decodeURIComponent(escape(atob( str )));
}

var mainWindow = Cc["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Ci.nsIWindowMediator);

const TOKEN_LENGTH = 32;
const ENCR_KEY_LENGTH = 32;
const HMAC_KEY_LENGTH = 32;

const REGISTER_APP = "services.notifications.register_app";

// FIXME: In the future, don't use global variables to store the last
// set of auth params/callback function.
var authParams = {};
var authCallback = null;

var canHidePanel = true;

var haveLoggedIn = false;

function initUI() {
    var authPanel = panel.Panel({
        contentURL: dataDir.url('pnotifs/auth.html'),
        contentScriptFile: dataDir.url('pnotifs/auth.js'),
        contentScriptWhen: 'ready',
        onMessage: function(msg) {
            canHidePanel = true;
            authPanel.hide();
            // FIXME: Get host (and port) from worker.contentURL instead of passing it through message.
            if (msg.authDecision)
                Client.authSuccess(authParams,authCallback,authParams.contentHost);
        },
        onHide: function() {
            // Cheesy way of making sure the panel doesn't disappear when you click off.
            if (!canHidePanel)
                this.show();
        },
    });
    
    function handleAuthMessage() {
        canHidePanel = false;
        authPanel.show();
    }
    
    function requestPermissions(window, params,callbackFunc) {
        authParams = params;
        var postOfficeHost = url.URL(window.location).host;
        var postOfficePort = url.URL(window.location).port;
        authParams['contentHost'] = postOfficeHost;
        authCallback = callbackFunc;
        if (haveLoggedIn)
            handleAuthMessage();
        else
            showLoginBox(true);
    }
    
    injectNotificationsAPI(requestPermissions);

    // showLoginBox(false); 
}

function injectNotificationsAPI(requestPermissionsFunc) {
    inject.Injector.injectObjNavigator('pushNotifications', {
        requestPermissions: requestPermissionsFunc
    });
}

function showLoginBox(authAfterward) {
    canHidePanel = false;
    var loginPanel = panel.Panel({
        contentURL: dataDir.url('pnotifs/login.html'),
        contentScriptFile: dataDir.url('pnotifs/login.js'),
        contentScriptWhen: 'ready',
        onMessage: function(msg) {
            canHidePanel = true;
            this.hide();
            Client.username = msg['username'];
            Client.password = msg['password'];  
            Client.createUserQueue(function() {
                haveLoggedIn = true;
                if (authAfterward)
                    handleAuthMessage();
            });
        },
        onHide: function() {
            // Cheesy way of making sure the panel doesn't disappear when you click off.
            if (!canHidePanel)
                this.show();
        },
    });
    loginPanel.show();
}

function Client(clientAgent, postOffice) {
    this.Prefs = {};
    //"http://push1.mtv1.dev.svc.mozilla.com:8000/";
    this.Prefs["clientAgentURL"] = clientAgent ? clientAgent : 'http://localhost:8000/';
    this.Prefs["postOfficeURL"] = postOffice ? postOffice : 'http://localhost:8000/';
    
    this.username = '';
    this.password = '';
    
    var that = this;
    // Load subscriptions/queueObj from disk first.            
    Engine.loadSubscriptions(function() {
        if (Engine.getQueueObj()) {
            haveLoggedIn = true;
            that.connectAMQP(function() {});
        }
    });
}

    Client.prototype.authSuccess = function authSuccess(params,callback,contentHost) {    
        var subscription = {
          app_name: params.app_name,
          account: params.account,
          host: contentHost, // This is the host (and port) of the current web app
          silent: false,
          token: btoa(Weave.Utils.generateRandomBytes(TOKEN_LENGTH)),
          encryptionKey: btoa(Weave.Utils.generateRandomBytes(ENCR_KEY_LENGTH)),
          hmacKey: btoa(Weave.Utils.generateRandomBytes(HMAC_KEY_LENGTH))
        };
        var response = {
          token: subscription.token,
          encryptionKey: subscription.encryptionKey,
          hmacKey: subscription.hmacKey,
          serverURL: this.Prefs["postOfficeURL"]
        };
        var regAppCallback = function () {
          if(!callback) {
            Weave.Svc.Obs.notify("services:notifications:newerror", 
                                 REG_CALLBACK);
            return;
          }
          callback(response, subscription);
        };

        // Register the app with the token on the server side.
        this.regAppSubscription(subscription, regAppCallback);
    }
    
    Client.prototype.connectAMQP = function connectAMQP(successCallback) {
        var queueObj = Engine.getQueueObj();
        console.log("queueName = " + queueObj.queueName);
        var conn = new amqp.Connection(queueObj.queueHost, queueObj.queuePort);
        var that = this;
        conn.open(function() {
          console.log('AMQP connection success!');
          conn.createChannel(function(channel) {
            channel.consume("notifsConsumer", function(message, deliveryTag) {
              try {
                that.onConsumeNotification(message, deliveryTag);
                channel.basic_ack(deliveryTag);
              } catch (ex) {
                console.log("BAD: " + JSON.stringify(ex) + "\n");
              }
            }, queueObj.queueName);
          if (successCallback)
              successCallback();
          });
        });
    },
    
    Client.prototype.createUserQueue = function createUserQueue(successCallback) {
        var resourceURL = this.Prefs['clientAgentURL'] + "1.0/new_queue";
        var res = new AsyncResource(resourceURL);
        res.authenticator = this.getAuthenticator();
        var that = this;
        res.post("", function(error, result) {
            if (error || !result.success) { 
              console.log("Couldn't POST!");
              console.log(error);
              console.log(result);
              //TODO: Real error handling.
              return;
            }
            var agentResponse = JSON.parse(result);         
            // FIXME: Config push1 to report its hostname properly so that we don't need to hardcode this. (!)
            Engine.setQueueObj({
                queueHost: 'localhost',//'push1.mtv1.dev.svc.mozilla.com',//agentResponse.host,
                queuePort: agentResponse.port,
                queueName: agentResponse.queue_id
            });
            that.connectAMQP(successCallback);
        });
    },
    

    Client.prototype.decryptMessageBody = function decryptMessageBody(body, engine) {
      var encryptionKey;

      // Get the right encryption key based on message type
      if (body.token) {
        subscription = Engine.getSubscription(body.token);
        encryptionKey = subscription.encryptionKey;
      } else {
        encryptionKey = Engine.getBroadcastKeys().encryption;
      }

      var clearText;
      try {
        clearText = Weave.Svc.Crypto.decrypt(
          body.ciphertext,
          encryptionKey,
          body.IV
        );
      } catch (ex) {
        Weave.Svc.Obs.notify("services:notifications:newerror", 
                               DECRYPT_MESSAGE);
        return;
      }
      var payload;
      try {
        payload = JSON.parse(clearText);
      } catch (ex) {
        Weave.Svc.Obs.notify("services:notifications:newerror", 
                               DECRYPT_MESSAGE);
        return;
      }

      // Cloning isn't really necessary, but it doesn't cost much
      var decryptedBody = JSON.parse(JSON.stringify(body));

      // Remove attributes related to encryption and replace with payload
      delete decryptedBody.ciphertext;
      delete decryptedBody.IV;
      decryptedBody.payload = payload;

      return decryptedBody;
    },

    Client.prototype.displayNotification = function displayNotification(notificationBody) {
      notifications.notify({
          title: notificationBody.payload.title,
          text: notificationBody.payload.text
      });
    },

    Client.prototype.doSync = function doSync(callback) {
        return;
      // Register handler if a callback is defined
      if (callback) {
        Svc.Obs.add("weave:service:sync:finish", function onSyncFinish(subject, data) {
          Svc.Obs.remove("weave:service:sync:finish", onSyncFinish);
          callback();
        });
      }

      Weave.Utils.delay(function() Weave.Service.sync(), 0);
    },
    
    Client.prototype.getAuthenticator = function getAuthenticator() {
        return new BasicAuthenticator({
            'username': this.username,
            'password': this.password
        });
    },

    Client.prototype.onConsumeNotification = function onConsumeNotification(messageText, deliveryTag) {        
      // Make sure we have an engine
      var engine = Weave.Engines.get("notifications");

      // TODO: Encapsulate message json and body in message object. Decapsulation happens
      // in this message.

      // Parse message and its body
      var message;
      var body;
      try {
        message = JSON.parse(messageText);
        body = JSON.parse(message.body);
      } catch (ex) {
        Weave.Svc.Obs.notify("services:notifications:newerror", 
                             NOTIFICATION_BODY_PARSE);
        return;
      }

      // Ignore any invalid notifications
      if (!this.verifyMessage(message, body, engine)) {
        console.log('Invalid notification, verification failed.');
        return;
      }

      var decryptedBody = this.decryptMessageBody(body, engine);

      // Handle based on the type of message
      if (decryptedBody.token) {
        this.displayNotification(decryptedBody);
      } else {
        // No subscription token indicates broadcast message from other client
        
        // TODO: broadcast message.
    
        // this.handleBroadcast(decryptedBody, engine);
      }
    },

    Client.prototype.regAppSubscription = function regAppSubscription(subscription, callback) {
      console.log("Registering subscription...\n");
      var packetURL = this.Prefs["clientAgentURL"] + "1.0/new_subscription";
      var body = {token: subscription.token};
      var res = new AsyncResource(packetURL);
      res.authenticator = this.getAuthenticator();
      
      res.post(body, function(error, result) {
        if (error || !result.success) {
          Weave.Svc.Obs.notify("services:notifications:newerror", REGISTER_APP);
          return;
        }
        // var engine = Weave.Engines.get("notifications");
        Engine.addSubscription(subscription.token, subscription);
        // this.syncAndPropagate();
        console.log('in regAppSubscription, about to callback');
        callback();
      });
    },
    
    Client.prototype.sendBroadcast = function sendBroadcast(payload, callback) {
      var engine = Weave.Engines.get("notifications");
      var broadcastKeys = Engine.getBroadcastKeys();
      var encryptionKey = broadcastKeys.encryption;
      var hmacKey = broadcastKeys.hmac;
      var iv = Weave.Svc.Crypto.generateRandomIV();
      var ciphertext = Weave.Svc.Crypto.encrypt(JSON.stringify(payload), encryptionKey, iv);

      var body = JSON.stringify({
        timestamp: Date.now() / 1000,
        ttl: BROADCAST_TTL, 
        ciphertext: ciphertext,
        IV: iv
      });

      // TODO: Use KeyBundle HMAC hasher so we're not creating objects each time
      var hmacKeyObj = Weave.Utils.makeHMACKey(atob(hmacKey));
      var hasher = Weave.Utils.makeHMACHasher(Ci.nsICryptoHMAC.SHA256, hmacKeyObj);
      var hmac = btoa(Weave.Utils.digestBytes(body, hasher));

      var broadcast = {
        body: body,
        HMAC: hmac,
      };

      // TODO: API const
      // Send POST request to Client Agent
      var postURL = this.Prefs["clientAgentURL"] + "1.0/broadcast";
      new AsyncResource(postURL).post(JSON.stringify(broadcast), function(error, result) {
        if (error || !result.success) {
          Weave.Svc.Obs.notify("services:notifications:newerror",
                               SEND_BROADCAST);
          return;
        }
        if (callback) {
          callback();
        }
      });
    },
    
    Client.prototype.sendSyncNowBroadcast = function sendSyncNowBroadcast(callback) {
      this.sendBroadcast({
        type: "sync_now",
        sender_id: Weave.Clients.localID
      }, callback);
    },
    
    Client.prototype.syncAndPropagate = function syncAndPropagate(callback) {
      this.doSync(function() {
        this.sendSyncNowBroadcast(callback);
      });
    },
    
    Client.prototype.verifyMessage = function verifyMessage(message, body, engine) {
      // Determine which HMAC we should compare against
      var hmacKey;
      if (!body.token) {
        hmacKey = Engine.getBroadcastKeys().hmac;
      } else {
        subscription = Engine.getSubscription(body.token);
        if (!subscription) {
          return false;
      }
        hmacKey = subscription.hmacKey;
      }
      // Check HMAC before we do any more processing
      // TODO: Use KeyBundle HMAC hasher so we're not creating objects each time
      var hmacKeyObj = Weave.Utils.makeHMACKey(atob(hmacKey));
      var hasher = Weave.Utils.makeHMACHasher(Ci.nsICryptoHMAC.SHA256, hmacKeyObj);
      var hmac = btoa(Weave.Utils.digestBytes(message.body, hasher));

      // Ignore notifications with invalid HMACs
      if (hmac != message.HMAC) {
        return false;
      }

      return true;
  }

exports.Client = Client;
exports.injectNotificationsAPI = injectNotificationsAPI;