console.log("OpenWebApps extension loaded");

function mgmtAuthorized(url) {
    // XXX: write me
    return true;
}

chrome.extension.onConnect.addListener(function(port) {
    var sendResponse = function(msg, resp) {
        if (msg.tid) port.postMessage({tid: msg.tid, resp: resp});
    }

    var url = port.sender.tab.url;
    port.onMessage.addListener(function(msg) {
        if (typeof(msg) === 'object' && msg.action) {
            switch (msg.action) {
            // start with mgmt routines
            case 'list':
                if (mgmtAuthorized(url)) {
                    sendResponse(msg, Repo.list());
                }
                break;
            case 'remove':
                if (mgmtAuthorized(url)) {
                }
                break;
            }
        }
    });
});
