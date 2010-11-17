console.log("OpenWebApps extension loaded");

function mgmtAuthorized(url) {
    // XXX: write me
    return true;
}

chrome.extension.onConnect.addListener(function(port) {
    var sendResponse = function(msg, resp) {
        console.log("trying to send response on " + msg.tid);
        if (msg.tid) port.postMessage({tid: msg.tid, resp: resp});
    }

    var url = port.sender.tab.url;
    console.log("you connected to me!  how awesome!  hi, " + url);
    port.onMessage.addListener(function(msg) {
        console.log(msg);
        if (typeof(msg) === 'object' && msg.action) {
            switch (msg.action) {
            // start with mgmt routines
            case 'list':
                console.log("extension gota list invocation from content script");
                if (mgmtAuthorized(url)) {
                    sendResponse(msg, [ ]);
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