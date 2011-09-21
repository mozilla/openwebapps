/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
// The mediation API.  This script is injected by jetpack into all mediators.
if (!window.navigator.mozApps) window.navigator.mozApps = {}
if (!window.navigator.mozApps.mediation) window.navigator.mozApps.mediation = {}

let allServices = {} // keyed by handler URL.
// This object should look very much like the Service object in repo.js
// with the addition of an 'iframe' attribute and a couple of helper fns.
// In particular, it has attributes:
// app: An app object with attributes such as 'origin', 'manifest'.
// service: The service name.
// launch_url: The end-point of the service itself.


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
    let activity = {
      action: this.activity.action,
      type: this.activity.type,
      message: action,
      data: args
    }

    function cbshim(result) {
      cb(JSON.parse(result));
    }

    function cberrshim(result) {
      if (cberr) {
        cberr(JSON.parse(result));
      }
    }
    unsafeWindow.navigator.mozApps.mediation._invokeService(this._getServiceFrame(), activity, action, cbshim, cberrshim);
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

window.navigator.mozApps.mediation.startLogin = function(origin) {
  self.port.once("owa.mediation.onLogin", function(params) {
    allServices[origin].call("setAuthorization", params, function() {
      // dispatch servicechanged
      allServices[origin]._invokeOn("serviceChanged");
    });
  });
  allServices[origin].call("getParameters", {}, function(params) {
    // due to a limitation in our implementation, this getParameters call is
    // actually made on the "main" service rather than on the login specific
    // service - so for now we assume the auth specific data is wrapped in
    // an 'auth' element in the result.
    self.port.emit("owa.mediation.doLogin", params.auth)
  });
}
unsafeWindow.navigator.mozApps.mediation.startLogin = window.navigator.mozApps.mediation.startLogin;

// The API called by the mediator when it is ready to go.
// Note the invocation handler will be called once initially, and possibly
// again as the configuration of apps changes (ie, as apps are added or
// removed).
window.navigator.mozApps.mediation.ready = function(invocationHandler) {
  self.port.on("owa.app.ready", function(origin) {
    console.log("owa.app.ready for", origin);
    if (allServices[origin]) {
      allServices[origin]._invokeOn("ready");
    }
  });

  let setupHandler = function(msg) {
    console.log("setup event has", msg.serviceList.length, "services");
    // We record the invocation ID in the mediator window so we can later
    // link the "app ready" calls back to the specific mediator instance.
    unsafeWindow.navigator.mozApps.mediation._invocationid = msg.invocationid;
    let services = [];
    let document = unsafeWindow.document;

    // TODO: do not create iframes when mediators are converted to templates,
    // mediators should have an api to call to remove services rather than
    // removing the iframes as we do here.

    for (var i = 0; i < msg.serviceList.length; i++) {
      var svc = msg.serviceList[i];
      let iframe = document.createElement("iframe");
      iframe.src = svc.url;

      let svcob = new Service(svc, msg.activity, iframe);
      services.push(svcob);
      allServices[svc.app.origin] = svcob;
    }
    invocationHandler(msg.activity, services);
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
  };

  doSetup();
  // next we should wind up with one 'setup' event then one 'app_ready'
  // event per app.
};

unsafeWindow.navigator.mozApps.mediation.ready = window.navigator.mozApps.mediation.ready;

window.navigator.mozApps.mediation.emit = function(event, args) {
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
}

unsafeWindow.navigator.mozApps.mediation.emit = window.navigator.mozApps.mediation.emit;

window.navigator.mozApps.mediation.invokeService = function(iframe, activity, message, callback) {//XX error cb?
  function callbackShim(result) {
    callback(JSON.parse(result));
  }
  // ideally we could use the port mechanism, but this is stymied by the
  // inability to pass iframe or iframe.contentWindow in args to emit().
  // Need to use unsafeWindow here for some reason.
  unsafeWindow.navigator.mozApps.mediation._invokeService(iframe.contentWindow, activity, message, callbackShim);
};

unsafeWindow.navigator.mozApps.mediation.invokeService = window.navigator.mozApps.mediation.invokeService;
