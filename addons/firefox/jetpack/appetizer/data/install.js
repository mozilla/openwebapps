console.log("hello world");
window.onload = function() {
  console.log("Setting up prompt");
  try {
    window.document.getElementById("prompt").innerHTML = "<div class='headline'>Installing <span class='appName'>" + gApplicationToInstall.name + "</span></div>" + 
      "<div class='body'>Install this application from " + gInstallingOrigin + "?<br><br>This application runs at " + gAppOrigin + ".</div>";
  } catch (e) {
    console.log(e);
  }

  try {
    if (gOriginWarnings.length || gAppWarnings.length) {
      var s = "<b>Warning</b>: This may not be entirely safe.<ul>";
      gOriginWarnings.forEach(function(a) s += "<li>" + a + "</li>");
      gAppWarnings.forEach(function(a) s += "<li>" + a + "</li>");
      window.document.getElementById("warnings").innerHTML = s + "</ul>";
    }
  } catch (e) {
    console.log(e);
  }
  

  window.document.getElementById("cancel_button").addEventListener("click", function()
  {
    postMessage({cmd:'cancel'});
  }, false);

  window.document.getElementById("install_button").addEventListener("click", function()
  {
    postMessage({cmd:'confirm'});
  }, false);
}