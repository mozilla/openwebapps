// this script is run at 'document_start' for all web content.
// it's executed before any scripts are executed and before the
// DOM is fully built.  it's job is to inject a script tag into the
// loaded page which will shim in functions into navigator.apps.
//
// navigator.apps will then communicate with this content script
// via custom DOM events and embedding data in the DOM.  This
// content script will the communicate into trusted code using
// chrome provided mechanisms.
//
// All of this is a bit on the  yucky side.

// first let's inject our script to run inside the page's evaluation
// context

function inject_api() {
    // a script that is inserted into the execution context of
    // webpage.  his goal in life is to shim navigator.apps.
    // to expose the OpenWebApps API and relay calls into trusted
    // code.

    function callOnerror(onerror, error) {
        if (! onerror) {
            return;
        }
        if (error.error) {
            error = error.error;
        }
        if (error.length == 2) {
            error = {code: error[0], message: error[1]};
        }
        onerror(error);
    }

    if (!navigator.apps || navigator.apps.html5Implementation) {
        var transactions = {};
        var cur_trans_id = 1000;

        var is_array = function(v) {
            return v && typeof v === 'object' && v.constructor === Array;
        };

        // delay interaction with the dom (for the return listener) until
        // a message is sent into the extension.  At this early stage of
        // page load we cannot query the DOM.
        var returnEventListenerRegistered = false;

        var sendToExtension = function(action, args, cb) {
            if (!returnEventListenerRegistered) {
                returnEventListenerRegistered = true;
                // now let's register for events incoming from the extension
                document.getElementById("__openWebAppsOut").addEventListener('__openWebAppsOutEvent', function() {
                    var data = document.getElementById('__openWebAppsOut').innerText;
                    var msg = JSON.parse(data);
                    if (transactions[msg.tid]) {
                        var cb = transactions[msg.tid];
                        delete transactions[msg.tid];
                        cb(msg.resp);
                    }
                });
            }

            var aObj = { action: action };
            if (args !== undefined) aObj.args = args;
            if (cb) {
                var i = cur_trans_id++;
                transactions[i] = cb;
                aObj.tid = i;
            }
            var div = document.getElementById("__openWebAppsIn");
            div.innerText = JSON.stringify(aObj);
            var ev = document.createEvent('Event');
            ev.initEvent('__openWebAppsInEvent', true, true);
            div.dispatchEvent(ev);
        };

        console.log("injecting navigator.apps API");
        navigator.apps = {
            amInstalled:function (cb) {
                sendToExtension('amInstalled', undefined, cb);
            },
            getInstalledBy:function (cb) {
                sendToExtension('getInstalledBy', undefined, cb);
            },
            install:function (obj) {
                if (! obj || !obj.url) {
                    throw "install missing required url argument";
                }
                var onsuccess = obj.onsuccess;
                var onerror = obj.onerror;
                delete obj.onsuccess;
                delete obj.onerror;
                sendToExtension('install', obj, function (r) {
                    if (r === true) {
                        onsuccess();
                    } else {
                        callOnerror(onerror, r);
                    }
                });
            },
            setRepoOrigin: function () {
                console.log("WARNING: navigator.apps.setRepoOrigin is meaningless when the openwebapps extension is installed");
            },
            verify: function () {
                console.log("verify called");
            },
            mgmt: {
                launch:function (id) {
                    sendToExtension('launch', id);
                },
                list: function (cb) {
                    sendToExtension('list', undefined, cb);
                },
                uninstall: function (id) {
                    var callback = null;
                    if (arguments.length > 1) {
                        var onsuccess = arguments[1];
                        var onerror = arguments[2];
                        callback = function (r) {
                            if (r === true) {
                                onsuccess();
                            } else {
                                callOnerror(onerror, r);
                            }
                        };
                    }
                    sendToExtension('uninstall', { id: id }, callback);
                },
                loadState: function (cb) {
                    sendToExtension('loadState', undefined, cb);
                },
                loginStatus: function (cb) {
                    sendToExtension('loginStatus', undefined, cb);
                },
                saveState: function (obj, cb) {
                    sendToExtension('saveState', obj, cb);
                }
            }
        };
    }
}

var owaContainer = document.createElement('div');
owaContainer.style.display = "none";

var s = document.createElement('script');
s.innerHTML = "(" + inject_api.toString() +")();";
owaContainer.appendChild(s);

// now let's inject two custom DOM nodes that will be used for communication
// into and out of the page
var d = document.createElement('div');
d.id = "__openWebAppsOut";
owaContainer.appendChild(d);

d = document.createElement('div');
d.id = "__openWebAppsIn";
owaContainer.appendChild(d);

document.documentElement.appendChild(owaContainer);

// establish a connection to the extension
var port = chrome.extension.connect();

// first message we send is our *real* origin, as the
// chrome.extension.onConnect stuff doesn't handle x-domain frames well
var realOrigin = window.location.protocol + "//" + window.location.host;
port.postMessage({action: "setOrigin", origin: realOrigin});

// next, let's register to receive incoming events from the page
d.addEventListener('__openWebAppsInEvent', function() {
    var data = document.getElementById('__openWebAppsIn').innerText;
    var msg = JSON.parse(data);
    port.postMessage(msg);
});

// a listener to receive messages from the extension
port.onMessage.addListener(function(msg) {
    var d = document.getElementById('__openWebAppsOut');
    d.innerText = JSON.stringify(msg);
    var ev = document.createEvent('Event');
    ev.initEvent('__openWebAppsOutEvent', true, true);
    d.dispatchEvent(ev);
});
