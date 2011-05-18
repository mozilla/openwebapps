// Inject a new API into navigator to present a merged web & native app list
if (!navigator.allApps) navigator.allApps = {};

navigator.allApps = (function() {
    var _nativeApps = {};

    function getNativeApps(webapps, onsuccess, onerror) {
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
                onsuccess(webapps);
            },
            function(code, message) {
                if (onerror) onerror(message);
            }
        );
    }

    function doList(onsuccess, onerror) {
        // First get list of web apps
        navigator.apps.mgmt.list(
            function(webapps) {
                getNativeApps(webapps, onsuccess, onerror);
            },
            function(err) {
                // Power through to native apps
                getNativeApps({}, onsuccess, onerror);
            }
        );
    }

    function doLaunch(id, onsuccess, onerror) {
        if (id.substr(0, 10) == "android://") {
            navigator.service.ApplicationManager.launchApplication(
                _nativeApps[id]
            );
            onsuccess(true);
        } else {
            navigator.apps.mgmt.launch(id, onsuccess, onerror);
        }
    }

    return {
        mgmt: {
            list: doList,
            launch: doLaunch,
            loadState: navigator.apps.mgmt.loadState,
            saveState: navigator.apps.mgmt.saveState,
            uninstall: navigator.apps.mgmt.uninstall,
        }
    };
})();

