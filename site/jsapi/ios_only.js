// Inject a new API into navigator to present a merged web & native app list
navigator.apps = (function() {
    var _state;

    function doList(onsuccess, onerror) {
        var webapps = {};
        for (var i = 0; i < 42; i++) {
        webapps["http://example.org"+i] = {
            origin: "http://example.org",
            manifest: {
              name: "Sample App",
              description: "this is an example",
              icons: {
                "48": "https://photobooth.mozillalabs.com/i/rainbow_48.png"
              }
            }
        };
        }
        if (onsuccess) onsuccess(webapps);
    }

    function doLaunch(id, onsuccess, onerror) {
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
