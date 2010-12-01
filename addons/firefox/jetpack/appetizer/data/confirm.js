window.onload = function() {
  try {
    window.document.getElementById("prompt").innerHTML = "<div class='headline'>Installed <span class='appName'>" + gApplicationToInstall.name + "</span></div>" + 
      "<div class='body'>The application has been installed.<br><br><a href='#'>Open Application Dashboard</a></div>";
  } catch (e) {
    console.log(e);
  }
}