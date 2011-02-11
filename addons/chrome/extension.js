console.log("OpenWebApps extension loaded");

function mgmtAuthorized(url) {
    // XXX: write me
    return true;
}

chrome.extension.onConnect.addListener(function(port) {
    var sendResponse = function(msg, resp) {
        if (msg.tid) port.postMessage({tid: msg.tid, resp: resp});
    };

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
            case 'setOrigin':
                // this is our content script calling from an isolated
                // world to specify the proper origin, which seems the only
                // reliable way to get origin (otherwise iframes have
                // origin of parent doc)
                origin = msg.origin;
                break;
            case 'uninstall':
                if (mgmtAuthorized(origin)) {
                    try {
                        sendResponse(msg, Repo.uninstall(msg.args.id));
                    } catch (e) {
                        sendResponse(msg, {error: e});
                    }
                }
                break;
            case 'loadState':
                if (mgmtAuthorized(origin)) {
                    var state = Repo.loadState(origin);
                    sendResponse(msg, state);
                }
                break;
            case 'launch':
                if (mgmtAuthorized(origin)) {
                    LaunchApp(msg.args);
                }
                break;
            case 'loginStatus':
                if (mgmtAuthorized(origin)) {
                    sendResponse(msg, null);
                }
                break;
            case 'saveState':
                if (mgmtAuthorized(origin)) {
                    sendResponse(msg, Repo.saveState(origin, msg.args));
                }
                break;
            // now routines for stores or apps
            case 'install':
                Repo.install(origin, msg.args, ShowPrompt, FetchManifest, function(r) {
                    sendResponse(msg, r);
                });
                break;
            case 'amInstalled':
                sendResponse(msg, Repo.amInstalled(origin));
                break;
            case 'getInstalledBy':
                sendResponse(msg, Repo.getInstalledBy(origin));
                break;
            }
        }
    });
});
