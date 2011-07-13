const {Cu} = require("chrome");

const Utils = Cu.import("resource://services-sync/util.js").Utils;

exports.Engine = {
    addSubscription: function addSubscription(key,val) {
        this.subscriptions.keys[key] = val;
        this.saveSubscriptions();
    },
    generateBroadcastKeys: function generateBroadcastKeys() {
        return {
          encryption: Svc.Crypto.generateRandomKey(),
          hmac: Svc.Crypto.generateRandomKey()
      };
    },
    getBroadcastKeys: function getBroadcastKeys() {
        if (!this.storeKeys) {
            this.storeKeys = this.generateBroadcastKeys();
        }
        return this.storeKeys;
    },
    getQueueObj: function getQueueObj() {
        return this.subscriptions.queueObj;
    },
    getSubscription: function getSubscription(key) {
            return this.subscriptions.keys[key];
    },
    loadSubscriptions: function loadSubscriptions(callback) {
          Utils.jsonLoad(this.SUBSCRIPTIONS_FILENAME, this, function(obj) {
              if (obj) {
                  this.subscriptions = obj;
              }
              callback();
          });
    },
    saveSubscriptions: function saveSubscriptions() {
        Utils.jsonSave(this.SUBSCRIPTIONS_FILENAME, this, this.subscriptions);
    },
    setQueueObj: function setQueueObj(val) {
        this.subscriptions.queueObj = val;
        this.saveSubscriptions();
    },
    storeKeys: {
        
    },
    subscriptions: {
        keys: {},
        queueObj: null
    },
    SUBSCRIPTIONS_FILENAME: "notifications/subscriptions"
};