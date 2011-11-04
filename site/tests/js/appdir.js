function extractIcon(manifest, origin) {
    var iconURL = "../i/openbox.png";
    if (manifest && manifest.icons) {
        if (manifest.icons["128"]) iconURL = manifest.icons["128"];
        else {

        }
    }
    if (iconURL.indexOf("/") === 0) iconURL = origin + iconURL;
    return iconURL;
}

$(document).ready(function() {
    var installed = null;

    $.getJSON( "db/apps.json", function(contents) {
        // whee!  we got our app database.  let's rip through and add all them apps to the
        // directory
        var d = $("#contentWrap");
        d.empty();

        for (var i = 0; i < contents.length; i++) {
            var app = contents[i];
            var e = $("<div />");
            var button = $("<div />").addClass("button").html("<img class='loading' src='i/spinner.gif'>");
            button.appendTo(e);
            var icon = $('<img />');
            icon.attr('src', extractIcon(app.manifest, app.origin));
            icon.appendTo(e);

            // on load error, reset to default icon.
            icon.error(function() {
                $(this).unbind("error").attr("src", extractIcon());
            });
            var name = $("<div />").addClass("name").text(app.manifest.name);
            name.appendTo(e);
            if (app.manifest.developer && app.manifest.developer.name) {
                var attribution = $("<div />").addClass("attribution");
                attribution.append("<span/>").text("by ");
                if (app.manifest.developer.url) {
                    $("<a/>").attr("href", app.manifest.developer.url)
                        .text(app.manifest.developer.name).appendTo(attribution);
                } else {
                    $("<span/>").text(app.manifest.developer.name).appendTo(attribution);
                }
                attribution.appendTo(e);

            }

            function updateStatus(elem) { 
                function checkMe(elem) {
                    var origin = $(elem).attr("origin");
                    for (var i = 0; i < installed.length; i++) {
                        if (origin === installed[i].origin) break;
                    }
                    if (i === installed.length) {
                        $(elem).find(".button").addClass("installable").html("<img src='i/download.png'> Install")
                            .click(function() {
                                $(elem).find(".button").unbind('click').removeClass("installable").html("<img class='loading' src='i/spinner.gif'>");
                                navigator.mozApps.install(
                                    $(elem).attr("appManifestURL"), {},
                                    function() {
                                        installed = null;
                                        updateStatus(elem);
                                    },
                                    function(errObj) {
                                        alert("oh no baby, business hours are over: " + errObj.code + " - " + errObj.message);
                                        updateStatus(elem);
                                    }
                                );
                            });
                    } else {
                        $(elem).find(".button").addClass("installed").html("&#x2714; Installed!")
                    }
                }

                if (installed === null) {
                    navigator.mozApps.getInstalledBy(function(i) {
                        installed = i;
                        checkMe(elem);
                    });
                } else {
                    checkMe(elem);
                }
            }

            // Have to figure out how this works on mobile
            //e.hover(function() {
            //    var self = this;
                $(e).unbind('mouseenter mouseleave');
                updateStatus(e);
            //});
            e.attr("appManifestURL", app.src_url);
            e.attr("origin", app.origin);
            e.addClass("singleColumn").appendTo(d);
        }
    });
});

