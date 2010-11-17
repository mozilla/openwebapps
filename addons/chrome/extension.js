console.log("OpenWebApps extension loaded");

function mgmtAuthorized(url) {
    // XXX: write me
    return true;
}

chrome.extension.onConnect.addListener(function(port) {
    var sendResponse = function(msg, resp) {
        if (msg.tid) port.postMessage({tid: msg.tid, resp: resp});
    }

    var origin = port.sender.tab.url;
    port.onMessage.addListener(function(msg) {
        if (typeof(msg) === 'object' && msg.action) {
            switch (msg.action) {
            // start with mgmt routines
            case 'list':
                if (mgmtAuthorized(origin)) {
                    sendResponse(msg, Repo.list());
                }
                break;
            case 'remove':
                if (mgmtAuthorized(origin)) {
                    sendResponse(msg, Repo.remove(msg.args.id));
                }
                break;
            // now routines for stores or apps
            case 'install':
                Repo.install(origin, msg.args, function(r) {
                    sendResponse(msg, r);
                });
                break;
            }
        }
    });
});
