function updateApps() {
    $('#applist > div').remove();

    navigator.apps.list(function(l) {
        for (key in l) {
            var app = $("<div/>");
            app.append($('<span/>').text(l[key].name + ": "));
            app.append($("<a>launch</a>").attr('href', key).attr('target', '__' + key));
            app.append($("<a>remove</a>").attr('href', '#').click((function() {
                var appKey = key;
                return function(e) {
                    e.preventDefault();
                    navigator.apps.remove(appKey, function() {
                        updateApps();
                    });
                }
            })()));

            app.appendTo("#applist");
        }
    });
}

$(document).ready(function() { updateApps(); });
