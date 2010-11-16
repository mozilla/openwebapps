function updateApps() {
    $('#applist > div').remove();

    navigator.apps.mgmt.list(function(l) {
        for (key in l) {
            (function() {
                var appKey = key;

                var app = $("<div/>");
                app.append($('<span class="appname"/>').text(l[key].name + ": "));
                app.append($("<a>launch</a>").attr('href', l[key].launchURL).attr('target', '__' + appKey));
                app.append($("<a>remove</a>").attr('href', '#').click(function(e) {
                    e.preventDefault();
                    navigator.apps.mgmt.remove(appKey, function() {
                        updateApps();
                    });
                }));
                app.append($("<pre/>").text(JSON.stringify(l[key], null, 4)));
                app.appendTo("#applist");
            })();
        }
    });
}

$(document).ready(function() { updateApps(); });
