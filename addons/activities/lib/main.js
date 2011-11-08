

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
        recentWindow.apps._services.invoke(aWindow, activity, successCB, errorCB);
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

exports.main = function(options, callbacks) {

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

  // initialize the injector if we are <fx9
  require("openwebapps/injector").init();
}

exports.onUnload = function(reason) {
  // variable why is one of 'uninstall', 'disable', 'shutdown', 'upgrade' or
  // 'downgrade'. doesn't matter now, but might later
  unloaders.forEach(function(unload) unload && unload());
}


