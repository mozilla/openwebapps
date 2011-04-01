dump("XxXxX loading OPENWEBAPPS content.js\n");

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

addMessageListener("OpenWebApps:Disable", disableScript);
addMessageListener("OpenWebApps:AddToHomeScreen", addToHomeScreen);

// In a restartless add-on, it is not possible to remove frame scripts. So, in order to keep
// collisions from happening as we install/enable and uninstall/disable, we'll just
// remove the message listener in this frame script
function disableScript(aMessage) {
  if (aMessage.name != "OpenWebApps:Disable")
    return;
  try {
    removeMessageListener("OpenWebApps:AddToHomeScreen", addToHomeScreen);
  } catch(e) {}
}

function addToHomeScreen(aMessage) {
  let document = content.document;
  
  let container = document.getElementById("apps-container");
  let list = document.getElementById("openwebapps");
  if (container) {
    container.parentNode.removeChild(container);
  }
  
  let JSON = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
  let payload = JSON.decode(aMessage.json.payload);
  let apps = JSON.decode(payload.ciphertext).value;
  let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService); 
  for (appuri in apps) {
    let app = apps[appuri];
    let uri = ios.newURI(appuri, null, null);
    let outer = document.createElement("div");
    outer.setAttribute("role", "button");
    outer.setAttribute("onclick", "openTabs(['" + uri.resolve(app.manifest.launch_path) + "']);");

    let img = document.createElement("img");
    img.className = "favicon";
    img.setAttribute("src", uri.resolve(app.manifest.icons["128"]));
    outer.appendChild(img);

    let inner = document.createElement("div");
    inner.className = "inner";

    let titlePart = document.createElement("div");
    titlePart.textContent = app.manifest.name;
    titlePart.className = "title";
    inner.appendChild(titlePart);

    outer.appendChild(inner);
    list.appendChild(outer);
  }
}

function contentLoaded() {
    let uri = content.document.location.toString();
    if (uri != "about:home")
      return;
  
    
    if (uri == "about:home") {
	let doc = content.document;
	let addonsSection = doc.getElementById("newAddons");

	let apps = doc.createElement("div");
	apps.setAttribute("id", "openwebapps");
	apps.className = "section-box";
        let title = apps.appendChild(doc.createElement("h1"));
	title.appendChild(doc.createTextNode("Applications"));
	let container = apps.appendChild(doc.createElement("div"));
        container.setAttribute("id", "apps-container");
        container.className = "loading";
        let img = container.appendChild(doc.createElement("img"));
        img.setAttribute("src", "chrome://browser/skin/images/throbber.png");
	addonsSection.parentNode.insertBefore(apps, addonsSection);

	// to update the app list on page reload
        sendAsyncMessage("OpenWebApps:GetApplications", {});
    }
}

addEventListener("DOMContentLoaded", contentLoaded, false);

