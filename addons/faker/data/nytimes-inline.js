
function handleChangeLayout() {
    alert("Change layout from menubar called!");
}

navigator.apps.services.registerHandler('link.transition', 'transition',
  function(activity) {
    var url = activity.data.url;
    if (window.skimmer) {
      skimmer("article").load(url, "");
      var list = document.getElementById("links");
      var num = list.childNodes.length + 1;

      var item = document.createElement("li");
      item.innerHTML = '<a href="' + url + '">Article ' + num + '</a>';
      list.appendChild(item);
    } else {
      window.location = url;
    }
  }
);

window.navigator.apps.services.ready();
