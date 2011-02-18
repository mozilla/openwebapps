console.log("OpenWebApps extension loaded");

function verifyMgmtAuthorized(url) {
    var authorized = false;
    [
      "https://myapps.mozillalabs.com",
      "https://stage.myapps.mozillalabs.com",
      "http://127.0.0.1:60172"
    ].forEach (function(x) {
        if (0 === url.indexOf(x)) authorized = true;
    });
    if (!authorized) throw [ "permissionDenied", "to access open web apps management apis, you must be on the same domain as the application repository" ];
}

chrome.extension.onConnect.addListener(function(port) {
    var sendResponse = function(msg, resp) {
        if (msg.tid) {
            if (typeof resp === 'object' && resp !== null && resp.error) {
                port.postMessage({tid: msg.tid, error: resp.error});
            } else port.postMessage({tid: msg.tid, resp: resp});
        }
    };

    var origin = port.sender.tab.url;

    port.onMessage.addListener(function(msg) {
        if (typeof(msg) === 'object' && msg.action) {
            try {
                switch (msg.action) {
                    // start with mgmt routines
                case 'list':
                    verifyMgmtAuthorized(origin);
                    Repo.list(function(v) {
                        sendResponse(msg, v);
                    });
                    break;
                case 'setOrigin':
                    // this is our content script calling from an isolated
                    // world to specify the proper origin, which seems the only
                    // reliable way to get origin (otherwise iframes have
                    // origin of parent doc)
                    origin = msg.origin;
                    break;
                case 'uninstall':
                    verifyMgmtAuthorized(origin);
                    Repo.uninstall(msg.args.id, function(v) {
                        sendResponse(msg, v);
                    });
                    break;
                case 'loadState':
                    verifyMgmtAuthorized(origin);
                    Repo.loadState(origin, function(v) {
                        sendResponse(msg, v);
                    });
                    break;
                case 'launch':
                    verifyMgmtAuthorized(origin);
                    LaunchApp(msg.args);
                    break;
                case 'loginStatus':
                    verifyMgmtAuthorized(origin);
                    sendResponse(msg, null);
                    break;
                case 'saveState':
                    verifyMgmtAuthorized(origin);
                    Repo.saveState(origin, msg.args, function(v) {
                        sendResponse(msg, v);
                    });
                    break;
                    // now routines for stores or apps
                case 'install':
                    Repo.install(origin, msg.args, ShowPrompt, FetchManifest, function(r) {
                        sendResponse(msg, r);
                    });
                    break;
                case 'amInstalled':
                    Repo.amInstalled(origin, function(v) {
                        sendResponse(msg, v);
                    });
                    break;
                case 'getInstalledBy':
                    Repo.getInstalledBy(origin, function(v) {
                        sendResponse(msg, v);
                    });
                    break;
                }
            } catch (e) {
                sendResponse(msg, { error: e });
            }
        }
    });
});
