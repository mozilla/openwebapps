// Inject a new API into navigator to present a merged web & native app list
navigator.mozApps = (function() {
    var _state;
    var _nativeApps = {};

    function doList(onsuccess, onerror) {
        var webapps = {};
        // Now get list of native apps
        navigator.service.ApplicationManager.getInstalledApplications(
            function(apps, count) {
                // Add native apps to the webapp list
                for (var i = 0; i < count; i++) {
                    var id = "android://" + i;
                    _nativeApps[id] = apps[i];
                    webapps[id] = {
                        origin: id,
                        manifest: {
                            name: apps[i].name,
                            description: apps[i].description,
                            icons: {
                                "48": apps[i].icon
                            }
                        }
                    };
                }
                if (onsuccess) onsuccess(webapps);
            },
            function(code, message) {
                if (onerror) onerror(message);
            }
        );
    }

    function doLaunch(id, onsuccess, onerror) {
        if (id.substr(0, 10) == "android://") {
            navigator.service.ApplicationManager.launchApplication(
                _nativeApps[id]
            );
            if (onsuccess) onsuccess(true);
        }
    }

    function doSaveState(state, onsuccess) {
        _state = state;
        if (onsuccess) onsuccess(true);
    }

    function doLoadState(onsuccess) {
        if (onsuccess) onsuccess(_state);
    }

    return {
        mgmt: {
            list: doList,
            launch: doLaunch,
            saveState: doSaveState,
            loadState: doLoadState
        }
    };
})();
