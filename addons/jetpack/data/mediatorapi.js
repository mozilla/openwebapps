// The mediation API.  This script is injected by jetpack into all mediators.

if (!window.navigator.apps)
    window.navigator.apps = {}
if (!window.navigator.apps.mediation)
    window.navigator.apps.mediation = {}

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

Service.prototype = {
    call: function(activity, arguments, cb, cberr) {
        function cbshim(result) {
            cb(JSON.parse(result));
        }
        function cberrshim(result) {
            if (cberr) {
                cberr(JSON.parse(result));
            }
        }
        // Need to use unsafeWindow here for some reason.
        unsafeWindow.navigator.apps.mediation._invokeService(this.iframe.contentWindow, this.service, activity, arguments, cbshim, cberrshim);
    },

    // Get the closest icon that is equal to or larger than the requested size,
    // or the biggest icon below that if needed.
    getIconForSize: function (targetSize) {
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
    self.port.on("app_ready", function(href) {
        console.log("app_ready for", href);
        if (allServices[href]) {
            allServices[href]._invokeOn("ready");
        }
    });

    let setupHandler = function(msg) {
        console.log("setup event has", msg.serviceList.length, "services");
        let services = [];
        for (var i = 0; i < msg.serviceList.length; i++) {
            var svc = msg.serviceList[i];
            let iframe = document.createElement("iframe");
            iframe.src = svc.url;

            let svcob = new Service(svc, iframe);
            services.push(svcob);
            allServices[svc.url] = svcob;
        }
        invocationHandler(msg.method, msg.args, services);
        self.port.once("reconfigure", function() {
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
        self.port.once("setup", setupHandler);
        self.port.emit("ready");
    };

    doSetup();
    // next we should wind up with one 'setup' event then one 'app_ready'
    // event per app.
};


window.navigator.apps.mediation.invokeService = function(iframe, method, activity, arguments, callback) {
    function callbackShim(result) {
        dump("mediator shim got" + (typeof result) + "\n");
        callback(JSON.parse(result));
    }
    // ideally we could use the port mechanism, but this is stymied by the
    // inability to pass iframe or iframe.contentWindow in args to emit().
    // Need to use unsafeWindow here for some reason.
    unsafeWindow.navigator.apps.mediation._invokeService(iframe.contentWindow, method, activity, arguments, callbackShim);
};
