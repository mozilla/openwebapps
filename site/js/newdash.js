function updateApps() {
    $('#applist > div').remove();

    navigator.apps.list(function(l) {
        for (key in l) {
            (function() {
                var appKey = key;

                var app = $("<div/>");
                app.append($('<span/>').text(l[key].name + ": "));
                app.append($("<a>launch</a>").attr('href', l[key].launchURL).attr('target', '__' + appKey));
                app.append($("<a>remove</a>").attr('href', '#').click(function(e) {
                    e.preventDefault();
                    navigator.apps.remove(appKey, function() {
                        updateApps();
                    });
                }));
                app.appendTo("#applist");
            })();
        }
    });
}

$(document).ready(function() { updateApps(); });
