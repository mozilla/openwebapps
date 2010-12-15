$(document).ready(function() {
    var l = Repo.list();

    $('body').css('width', l.length * 100);
    for (var i = 0; i < l.length; i++) {
        var s = $("<span/>");
        s.addClass("launchIcon");
        var iurl = (l[i].icons && l[i].icons['96']) ? l[i].icons['96'] : chrome.extension.getURL("icon.png");
        s.append($("<img/>").attr("src", iurl).attr('alt', l[i]['name']).attr("width", 96));
        s.click((function() {
            var id = l[i].id;
            return function() {
                Repo.launch(id);
            };
        })());
        s.appendTo('body');
    }
});