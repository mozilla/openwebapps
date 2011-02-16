function LaunchApp(id) {
    console.log("launching app: " + id);

    var appStorage = TypedStorage().open("app");
    var i = appStorage.get(id);
    if (!i || !i.origin) return false;
    var launchURL = i.origin + (i.manifest.launch_path ? i.manifest.launch_path : "");
    var appName = i.manifest.name;
    var parsedBaseURL = URLParse(i.origin).normalize();

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
