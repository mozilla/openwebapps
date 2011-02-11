$(document).ready(function() {
    function getBiggestIcon(icons) {
        //see if the icons has any icons, and if so, return the largest one
        if (icons) {
            var biggest = 0;
            for (z in icons) {
                var size = parseInt(z, 10);
                if (size > biggest) biggest = size;
            }
            if (biggest !== 0) return icons[biggest];
        }
        return chrome.extension.getURL("icon.png");
    }

    var l = Repo.list();

    $('body').css('width', l.length * 100);
    for (var i in l) {
        if (!l.hasOwnProperty(i)) continue;
        var s = $("<span/>");
        s.addClass("launchIcon");
        var iurl = getBiggestIcon(l[i].icons);
        var img = $("<img/>");
        img.attr("src", iurl);
        img.attr('alt', l[i]['name']);
        img.width("96").height("96").appendTo(s);
        s.click((function() {
            var id = i;
            return function() {
                LaunchApp(id);
            };
        })());
        s.appendTo('body');
    }
});