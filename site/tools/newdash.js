function updateApps() {
    $('#applist > div').remove();

    navigator.mozApps.mgmt.list(function(l) {
        for (key in l) {
            (function() {
                var id = l[key].id;

                var app = $("<div/>");
                app.append($('<span class="appname"/>').text(l[key].name + ": "));
                app.append($("<a>launch</a>").attr('href', '#').click(function(e) {
                    e.preventDefault();
                    navigator.mozApps.mgmt.launch(id);
                }));
                app.append($("<a>remove</a>").attr('href', '#').click(function(e) {
                    e.preventDefault();
                    navigator.mozApps.mgmt.remove(id, function() {
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
