console.log("OpenWebApps extension loaded");

function mgmtAuthorized(url) {
    // XXX: write me
    return true;
}

function launch(id) {
    console.log("launching app: " + id);
    var i = appStorage.get(id);
    if (!i || !i.app.base_url) return false;
    var baseURL = i.app.base_url;
    var launchURL = baseURL + (i.app.launch_path ? i.app.launch_path : "");
    var appName = i.app.name;
    var parsedBaseURL = URLParse(baseURL).normalize();
    
    // determine if this application is running in some tab in some window
    chrome.windows.getAll({populate:true}, function(windows) { 
        for (var i = 0; i < windows.length; i++) {
            var w = windows[i];
            for (var j = 0; j < w.tabs.length; j++) {
                var t = w.tabs[j];
                if (parsedBaseURL.contains(t.url)) {
                    console.log("found application running (" + appName + "), focusing");
                    chrome.windows.update(w.id, { focused: true });                        
                    chrome.tabs.update(t.id, { selected: true });
                    return;
                }
            }
        }
        console.log("app not running (" + appName + "), spawning");
        chrome.tabs.create({url: launchURL});
    });

    return true;
}

chrome.extension.onConnect.addListener(function(port) {
    var sendResponse = function(msg, resp) {
        if (msg.tid) port.postMessage({tid: msg.tid, resp: resp});
    }

    var origin = port.sender.tab.url;

    // for clients from file:// urls we'll store the string "null".
    // XXX: this is for symmetry with the HTML implementation.  Are we
    // happy with this?
    origin = ((origin.indexOf('file://') == 0) ? "null" : origin);

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
            case 'loadState':
                if (mgmtAuthorized(origin)) {
                    var state = Repo.loadState(origin);
                    sendResponse(msg, state);
                }
                break;
            case 'launch':
                if (mgmtAuthorized(origin)) {
                    launch(msg.args);
                }
                break;
            case 'loginStatus':
                if (mgmtAuthorized(origin)) {
                    console.log("XXX: implement login status for sync");
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
            case 'getInstalled':
                sendResponse(msg, Repo.getInstalled(origin));
                break;
            case 'getInstalledBy':
                sendResponse(msg, Repo.getInstalledBy(origin));
                break;
            }
        }
    });
});
