// a script that is inserted into the execution context of
// webpage.  his goal in life is to shim navigator.apps.
// to expose the OpenWebApps API and relay calls into trusted
// code.
if (!navigator.apps) {
    var transactions = {};
    var cur_trans_id = 1000;

    var is_array = function(v) {
        return v && typeof v === 'object' && v.constructor === Array;
    }

    var sendToExtension = function(action, args, cb) {
        var aObj = { action: action };
        if (args) aObj.args = args;
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

    console.log("injecting navigator.apps API");
    navigator.apps = {
        getInstalled:function () {
            console.log("getInstalled called");
        },
        getInstalledBy:function () {
            console.log("getInstalledBy called");
        },
        install:function () {
            console.log("install called");
        },
        setRepoOrigin: function () {
            console.log("WARNING: navigator.apps.setRepoOrigin is meaningless when the openwebapps extension is installed");
        },
        verify: function () {
            console.log("verify called");
        },
        mgmt: {
            list: function (cb) {
                console.log("mgmt.list called");
                sendToExtension('list', null, cb);
            },
            remove: function (id) {
                console.log("mgmt.remove called");
                sendToExtension('remove', { id: id }, (arguments.length == 2 ? arguments[1] : null));
            }
        }
    };
}
