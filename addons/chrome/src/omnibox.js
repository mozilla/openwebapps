chrome.omnibox.setDefaultSuggestion({
    description: "Go to my dashboard"
});

function findMatchingApps(text, cb) {
    text = text.toLowerCase();
    Repo.list(function(l) {
        var results = [];
        for (var k in l) {
            var blob = l[k].manifest.name;
            if (l[k].manifest.developer) {
                if (l[k].manifest.developer.name) 
                    blob += l[k].manifest.developer.name
                if (l[k].manifest.developer.url) 
                    blob += l[k].manifest.developer.url
            }
            if (l[k].manifest.description) {    
                blob += l[k].manifest.description;
            }
            if (blob.toLowerCase().indexOf(text) != -1)
                results.push(l[k]);
        }
        cb(results);
    });
}

chrome.omnibox.onInputChanged.addListener(function(text, suggest) {
    findMatchingApps(text, function(results) {
        if (results.length) {
            for (var i = 0 ; i< results.length; i++) {
                results[i] = {
                    content: results[i].manifest.name,
                    description: "Launch " + results[i].manifest.name
                };
            }
            suggest(results);
        }
    });
});

chrome.omnibox.onInputEntered.addListener(function(text) {
    if (text.length == 0) {
        // launch dashboard!
        LaunchApp("dashboard")
        return;
    }

    findMatchingApps(text, function(results) {
        if (results.length) {
            // launch the first application
            LaunchApp(results[0].origin);
        } else {
            // no applications?  hmm. what to do?
            // if the text entered is part of dashboard, let's launch anyway.
            if ("dashboard".indexOf(text.toLowerCase()) >= 0) 
                LaunchApp("dashboard")
            else
                console.log("Uncertain what to do, ignoring command: " +
                            text);
        }
    });
});
