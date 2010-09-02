/*
 * An abstraction around the cross domain trickery
 * required to allow this chrome extension to read and write
 * localStorage for myapps.mozillalabs.com.
 */

;MyAppsStorage = (function() {
    var id = Math.floor(Math.random() * 10000000);
    var request_table = { };
    var myappsCommDomain = "https://myapps.mozillalabs.com";
    var myappsIframeId = "myappsIframe";

    var tgtWindow = document.getElementById(myappsIframeId).contentWindow;
    var win = window;

    function onMessage(event) {
        // we only accept messages from our friends
        if (event.origin !== myappsCommDomain) {
            console.log("dropping event, untrusted origin: " + event.origin);
            return;
        }
        
        var msg = null;
        try { msg = JSON.parse(event.data); } catch(e) { }
        if (!msg) {  
            console.log("invalid JSON message received, dropping");
            return;
        }
            
        if (!msg.id) { console.log("poorly formed message, id required"); return; }

        if (!request_table.hasOwnProperty(msg.id)) {
            console.log("response recieved, but no corresponding request.  Dropping.");
            return; 
        }

        // invoke callback
        var cb = request_table[msg.id];
        delete request_table[msg.id];
        cb(msg.val);
    }

    // Setup postMessage event listeners
    if (win.addEventListener) {
        win.addEventListener('message', onMessage, false);
    } else if(win.attachEvent) {
        win.attachEvent('onmessage', onMessage);
    }

    function createTransaction(callback) {
        if (typeof(callback) != 'function') throw "MyAppsStorage requires function callback argument";
        var rid = id++;
        request_table[rid] = callback; 
        return rid;
    }

    return {
        get: function(key, callback) {
            if (typeof(key) != 'string') throw "MyAppsStorage requires string 'key' argument";
            var rid = createTransaction(callback);
            tgtWindow.postMessage(JSON.stringify({action: 'getItem', id: rid, key: key}), myappsCommDomain);
        },
        set: function(key, value, callback) {
            if (typeof(key) != 'string') throw "MyAppsStorage requires string 'key' argument";
            var rid = createTransaction(callback);
            tgtWindow.postMessage(JSON.stringify({action: 'setItem', id: rid, key: key, data: value}), myappsCommDomain);
        },
        keys: function(callback) {
            var rid = createTransaction(callback);
            tgtWindow.postMessage(JSON.stringify({action: 'getKeys', id: rid}), myappsCommDomain);
        }
    };
})();