
function handleChangeLayout() {
    alert("Change layout from menubar called!");
}

window.navigator.apps.services.registerHandler('link.transition', 'transition', function(args, cb) {
    if (window.skimmer) {
        skimmer("article").load(args.url, "");
        var list = document.getElementById("links");
        var num = list.childNodes.length + 1;

        var item = document.createElement("li");
        item.innerHTML = '<a href="' + args.url + '">Article ' + num + '</a>';
        list.appendChild(item);
    } else {
        window.location = args.url;
    }
});

window.navigator.apps.services.ready();
