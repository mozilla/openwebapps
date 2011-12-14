const { Cc, Ci, Cm, Cu, Cr, components } = require("chrome");
var tmp = {};
Cu.import("resource://gre/modules/Services.jsm", tmp);
Cu.import("resource://gre/modules/AddonManager.jsm", tmp);
Cu.import("resource://gre/modules/XPCOMUtils.jsm", tmp);
var { XPCOMUtils, AddonManager, Services } = tmp;

const addon = require("self");


let unloaders = [];


//----- navigator.mozActivities api implementation
function NavigatorAPI() {};
NavigatorAPI.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDOMGlobalPropertyInitializer]),
  init: function API_init(aWindow) {
    //console.log("API object init for "+aWindow.location);
    let chromeObject = this._getObject(aWindow);
  
    // We need to return an actual content object here, instead of a wrapped
    // chrome object. This allows things like console.log.bind() to work.
    let contentObj = Cu.createObjectIn(aWindow);
    function genPropDesc(fun) {
      return { enumerable: true, configurable: true, writable: true,
               value: chromeObject[fun].bind(chromeObject) };
    }
    let properties = {};
    
    for (var fn in chromeObject.__exposedProps__) {
      //console.log("adding property "+fn);
      properties[fn] = genPropDesc(fn);
    }
  
    Object.defineProperties(contentObj, properties);
    Cu.makeObjectPropsNormal(contentObj);
  
    return contentObj;
  }
};

MozActivitiesAPIContract = "@mozilla.org/openwebapps/mozActivities;1";
MozActivitiesAPIClassID = Components.ID("{9175e12d-2377-5649-815b-2f49983d0ff3}");
function MozActivitiesAPI() {}
MozActivitiesAPI.prototype = {
  __proto__: NavigatorAPI.prototype,
  classID: MozActivitiesAPIClassID,
  _getObject: function(aWindow) {
    return {
      startActivity: function(activity, successCB, errorCB) {
        let wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
        let recentWindow = wm.getMostRecentWindow("navigator:browser");
        recentWindow.serviceInvocationHandler.invoke(aWindow, activity, successCB, errorCB);
      },
      __exposedProps__: {
        startActivity: "r"
      }
    };
  }
}
let MozActivitiesAPIFactory = {
  createInstance: function(outer, iid) {
    if (outer != null) throw Cr.NS_ERROR_NO_AGGREGATION;
    return new MozActivitiesAPI().QueryInterface(iid);
  }
};

//----- navigator.mozActivities api implementation

function ActivitiesLoader() {
  console.log("ActivitiesLoader init");
  Services.obs.addObserver(this, "openwebapps-mediator-load", true);
  Services.obs.addObserver(this, "openwebapps-mediator-init", true);
}
ActivitiesLoader.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),
  observe: function(subject, topic, data) {
    console.log("ActivitiesLoader observed "+topic);
    switch (topic) {
    case "openwebapps-mediator-load":
      console.log("initialize window.serviceInvocationHandler");
      let doc = subject.document.documentElement;
      if (doc.getAttribute("windowtype") == "navigator:browser") {
        console.log("attache the serviceInvocationHandler");
        try {
          let serviceInvocationHandler = require("services").serviceInvocationHandler;
          subject.serviceInvocationHandler = new serviceInvocationHandler(subject);
        } catch(e) {
          console.log("error "+e);
        }
      }
      break;
    case "openwebapps-mediator-init":
      console.log("initialize webActivities APIs");
      // register our navigator api's that will be globally attached
      Cm.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
        MozActivitiesAPIClassID, "MozActivitiesAPI", MozActivitiesAPIContract, MozActivitiesAPIFactory
      );
      Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager).
                  addCategoryEntry("JavaScript-navigator-property", "mozActivities",
                          MozActivitiesAPIContract,
                          false, true);
    
      unloaders.push(function() {
        Cm.QueryInterface(Ci.nsIComponentRegistrar).unregisterFactory(
          MozActivitiesAPIClassID, MozActivitiesAPIFactory
        );
        Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager).
                    deleteCategoryEntry("JavaScript-navigator-property", "mozActivities", false);
      });
    }
  },
  removeObservers: function() {
    Services.obs.removeObserver(this, "openwebapps-mediator-load");
    Services.obs.removeObserver(this, "openwebapps-mediator-init");
  }
}

var loader = new ActivitiesLoader();
unloaders.push(function () {
  loader.removeObservers();
  loader = null;
});

exports.main = function(options, callbacks) {
  console.log("web activities addon starting")
  let owa = require("openwebapps/main");
}

exports.onUnload = function(reason) {
  // variable why is one of 'uninstall', 'disable', 'shutdown', 'upgrade' or
  // 'downgrade'. doesn't matter now, but might later
  unloaders.forEach(function(unload) unload && unload());
}


