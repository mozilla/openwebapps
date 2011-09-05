/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
// The mediation API.  This script is injected by jetpack into all mediators.
if (!window.navigator.apps) window.navigator.apps = {}
if (!window.navigator.apps.mediation) window.navigator.apps.mediation = {}

let allServices = {} // keyed by handler URL.
// This object should look very much like the Service object in repo.js
// with the addition of an 'iframe' attribute and a couple of helper fns.
// In particular, it has attributes:
// app: An app object with attributes such as 'origin', 'manifest'.
// service: The service name.
// launch_url: The end-point of the service itself.


function Service(svcinfo, iframe) {
  for (let name in svcinfo) {
    this[name] = svcinfo[name];
  }
  this.iframe = iframe;
  this._onHandlers = {}
};
unsafeWindow.Service = Service;

Service.prototype = {
  call: function(activity, args, cb, cberr) {
    function cbshim(result) {
      cb(JSON.parse(result));
    }

    function cberrshim(result) {
      if (cberr) {
        cberr(JSON.parse(result));
      }
    }
    // Need to use unsafeWindow here for some reason.
    // TODO: turn this into a getter when all mediators are converted.  right
    // now some mediators will expect the iframe to be given to them, with
    // templatized mediators the iframe is created in the template.
    let cw = this.iframe.contentWindow;
    if (!cw) {
      let frames = unsafeWindow.document.getElementsByTagName('iframe');
      for (var i=0 ; i < frames.length; i++) {
        if (frames[i].src == this.url) {
          cw = frames[i];
          break;
        }
      }
    }
    unsafeWindow.navigator.apps.mediation._invokeService(cw, this.service, activity, args, cbshim, cberrshim);
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

// The API called by the mediator when it is ready to go.
// Note the invocation handler will be called once initially, and possibly
// again as the configuration of apps changes (ie, as apps are added or
// removed).
window.navigator.apps.mediation.ready = function(invocationHandler) {
  self.port.on("owa.app.ready", function(href) {
    console.log("owa.app.ready for", href);
    if (allServices[href]) {
      allServices[href]._invokeOn("ready");
    }
  });

  let setupHandler = function(msg) {
    console.log("setup event has", msg.serviceList.length, "services");
    // We record the invocation ID in the mediator window so we can later
    // link the "app ready" calls back to the specific mediator instance.
    unsafeWindow.navigator.apps.mediation._invocationid = msg.invocationid;
    let services = [];
    let document = unsafeWindow.document;

    // TODO: do not create iframes when mediators are converted to templates,
    // mediators should have an api to call to remove services rather than
    // removing the iframes as we do here.

    for (var i = 0; i < msg.serviceList.length; i++) {
      var svc = msg.serviceList[i];
      let iframe = document.createElement("iframe");
      iframe.src = svc.url;

      let svcob = new Service(svc, iframe);
      services.push(svcob);
      allServices[svc.url] = svcob;
    }
    invocationHandler(msg.method, msg.args, services);
    self.port.once("owa.mediation.reconfigure", function() {
      // nuke all iframes.
      for (let url in allServices) {
        let iframe = allServices[url].iframe;
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
        allServices[url].iframe = null;
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

unsafeWindow.navigator.apps.mediation.ready = window.navigator.apps.mediation.ready;

window.navigator.apps.mediation.emit = function(event, args) {
  // A hack for sizeToContent - as the panel doesn't expose the window
  // object for its iframe, we need to calculate it here.
  if (event === "owa.mediation.sizeToContent" && !args) {
    let body = document.getElementsByTagName('body')[0];
    if (body) {
      args = {
        width: body.scrollWidth,
        height: body.scrollHeight
      };
    }
  }
  self.port.emit(event, args)
}

unsafeWindow.navigator.apps.mediation.emit = window.navigator.apps.mediation.emit;

window.navigator.apps.mediation.invokeService = function(iframe, method, activity, args, callback) {
  function callbackShim(result) {
    dump("mediator shim got" + (typeof result) + "\n");
    callback(JSON.parse(result));
  }
  // ideally we could use the port mechanism, but this is stymied by the
  // inability to pass iframe or iframe.contentWindow in args to emit().
  // Need to use unsafeWindow here for some reason.
  unsafeWindow.navigator.apps.mediation._invokeService(iframe.contentWindow, method, activity, args, callbackShim);
};

unsafeWindow.navigator.apps.mediation.invokeService = window.navigator.apps.mediation.invokeService;
