/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */

// Insert the mediator api into unsafeWindow
if (!unsafeWindow.navigator.wrappedJSObject.mozActivities.mediation)
  unsafeWindow.navigator.wrappedJSObject.mozActivities.mediation = {};

let allServices = {} // keyed by handler URL.
// This object should look very much like the Service object in repo.js
// with the addition of an 'iframe' attribute and a couple of helper fns.
// In particular, it has attributes:
// app: An app object with attributes such as 'origin', 'manifest'.
// service: The service name.
// launch_url: The end-point of the service itself.

function S4() {
  return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
function guid() {
  return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}
var invokeId = 0;

function Service(svcinfo, activity, iframe) {
  for (let name in svcinfo) {
    this[name] = svcinfo[name];
  }
  this.iframe = iframe;
  this._onHandlers = {}
  this.activity = activity;
};
unsafeWindow.Service = Service;

Service.prototype = {
  _getServiceFrame: function() {
    // Need to use unsafeWindow here for some reason.
    // TODO: turn this into a getter when all mediators are converted.  right
    // now some mediators will expect the iframe to be given to them, with
    // templatized mediators the iframe is created in the template.
    let cw = this.iframe.contentWindow;
    let frames = unsafeWindow.document.getElementsByTagName('iframe');
    for (var i=0 ; i < frames.length; i++) {
      if (frames[i].src == this.url) {
        return frames[i].contentWindow;
        break;
      }
    }
    return this.iframe.contentWindow
  },
  call: function(action, args, cb, cberr) {
    invokeId++;
    let activity = {
      action: this.activity.action,
      type: this.activity.type,
      message: action,
      data: args,
      success: 'owa.mediation.success.'+(invokeId),
      error: 'owa.mediation.error.'+(invokeId),
      origin: this.app.origin
    }

    function postResult(result) {
      self.port.removeListener(activity.error, postException);
      cb(result);
    }

    function postException(result) {
      self.port.removeListener(activity.success, postResult);
      if (cberr) {
        cberr(result);
      }
    }
    self.port.once(activity.success, postResult);
    self.port.once(activity.error, postException);

    self.port.emit('owa.mediation.invoke', activity);
  },

  // Get the closest icon that is equal to or larger than the requested size,
  // or the biggest icon below that if needed.
  _getIconForSize: function(targetSize) {
    let minifest = this.app.manifest;
    if (minifest && minifest.icons) {
      var bestFit = 0;
      var biggestFallback = 0;
      for (var z in minifest.icons) {
        var size = parseInt(z, 10);
        if (bestFit == 0 || size >= targetSize) {
          bestFit = size;
        }
        if (biggestFallback == 0 || size > biggestFallback) {
          biggestFallback = size;
        }
      }
      if (bestFit !== 0) return minifest.icons[bestFit];
      if (biggestFallback !== 0) return minifest.icons[biggestFallback];
    }
    return "default_app.png";
  },

  getIconForSize: function(targetSize) {
    let icon = this._getIconForSize(targetSize);
    if (!(icon.indexOf("data:") == 0)) {
      icon = this.app.launch_url + icon;
    }
    return icon;
  },

  // A poor mans event mechanism - 'ready' is about the only event used..
  on: function(name, callback) {
    this._onHandlers[name] = callback;
  },
  _invokeOn: function(name, args) {
    if (this._onHandlers[name]) {
      this._onHandlers[name](args);
    }
  }
};

self.port.on("owa.mediation.onLogin", function(params) {
  let {app, credentials} = params;
  allServices[app].call("setAuthorization", credentials, function() {
    // dispatch servicechanged
    allServices[app]._invokeOn("serviceChanged");
  });
});

unsafeWindow.navigator.wrappedJSObject.mozActivities.mediation.startLogin = function(origin) {
  allServices[origin].call("getParameters", {}, function(params) {
    // due to a limitation in our implementation, this getParameters call is
    // actually made on the "main" service rather than on the login specific
    // service - so for now we assume the auth specific data is wrapped in
    // an 'auth' element in the result.
    self.port.emit("owa.mediation.doLogin", {app: origin, auth: params.auth})
  });
}

// The API called by the mediator when it is ready to go.
// Note the invocation handler will be called once initially, and possibly
// again as the configuration of apps changes (ie, as apps are added or
// removed).
unsafeWindow.navigator.wrappedJSObject.mozActivities.mediation.ready = function(configureServices, updateActivity, fetchState) {
  self.port.on("owa.app.ready", function(origin) {
    //console.log("owa.app.ready for", origin);
    if (allServices[origin]) {
      allServices[origin]._invokeOn("ready");
    }
  });

  let onPanelHidden = function(msg) {
    // even if no state function was provided by the mediator (or if it fails)
    // we emit a null state so the .once() handler for the state is invoked.
    let mediatorState = null;
    if (fetchState) {
      try {
        mediatorState = fetchState();
      } catch (ex) {
        console.error("mediator fetchState function failed", ex, ex.stack);
      }
    }
    self.port.emit("owa.mediation.setMediatorState", mediatorState);
  };

  let setupHandler = function(msg) {
    //console.log("setup event has", msg.serviceList.length, "services");
    let document = unsafeWindow.document;

    // TODO: do not create iframes when mediators are converted to templates,
    // mediators should have an api to call to remove services rather than
    // removing the iframes as we do here.

    // To ensure the frames don't get created before the mediator receives
    // the message with the GUID, we create the frames using ping-pong - we
    // allocate IDs then emit() them to the mediator, then when the mediator
    // replies we can go ahead and finish the create process.
    let frameCreateInfo = [];
    for (var i = 0; i < msg.serviceList.length; i++) {
      let svc = msg.serviceList[i];
      let id = guid();
      // notify our mediator of the guid to watch for
      frameCreateInfo.push({
        origin: svc.app.origin,
        id: id
      });
    }
    self.port.once("owa.mediation.create-frames", function () {
      let services = [];
      for (let i = 0; i < frameCreateInfo.length; i++) {
        var svc = msg.serviceList[i];
        let id = frameCreateInfo[i].id;
        let iframe = document.createElement("iframe");
        iframe.setAttribute('id', id);
        iframe.src = svc.url;
        let svcob = new Service(svc, msg.activity, iframe);
        services.push(svcob);
        allServices[svc.app.origin] = svcob;
      }
      // send the services configuration to the mediator content
      configureServices(msg.activity, services);
  
      // listen for activity changes.
      self.port.on("owa.mediation.updateActivity", updateActivity);
      // and for panel hide notifications
      self.port.on("owa.mediation.panelHidden", onPanelHidden);
    });
    self.port.emit("owa.mediation.frames", frameCreateInfo);
    self.port.once("owa.mediation.reconfigure", function() {
      // nuke all iframes.
      for (let origin in allServices) {
        let iframe = allServices[origin].iframe;
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
        allServices[origin].iframe = null;
      }
      allServices = {};
      doSetup();
    });
  };

  let doSetup = function() {
    self.port.once("owa.mediation.setup", setupHandler);
    self.port.emit("owa.mediation.ready");
    self.port.removeListener("owa.mediation.updateActivity", updateActivity);
    self.port.removeListener("owa.mediation.panelHidden", onPanelHidden);
  };

  doSetup();
  // next we should wind up with one 'setup' event then one 'app_ready'
  // event per app.
};



var mPort = {
    emit: function (event, args) {
      // A hack for sizeToContent - as the panel doesn't expose the window
      // object for its iframe, we need to calculate it here.
      if (event === "owa.mediation.sizeToContent" && !args) {
        // hrmph - we used to use document.getElementsByTagName('body')[0], but
        // sometimes that returns undefined while document.body always works.
        let body = document.body;
        if (body) {
          args = {
            width: body.scrollWidth,
            height: body.scrollHeight
          };
        }
      }
      self.port.emit(event, args)
    },
    on: function (event, fn) {
      self.port.on(event, fn);
    },
    removeListener: function (event, fn) {
      self.port.removeListener(event, fn);
    }
};
unsafeWindow.navigator.wrappedJSObject.mozActivities.mediation.port = mPort;
