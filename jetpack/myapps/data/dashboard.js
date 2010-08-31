/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is App Dashboard
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Michael Hanson <mhanson@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

/*
inbox icons from http://kateengland.bigcartel.com/product/workflow-desktop-icons
 we do not yet have license - redo, or negotiate with her!
*/

const APP_STORAGE_DOMAIN = "http://myapps.org";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const SCRIPT_SECURITY_MGR = Cc["@mozilla.org/scriptsecuritymanager;1"].getService(Ci.nsIScriptSecurityManager);
const STORAGE_MANAGER = Cc["@mozilla.org/dom/storagemanager;1"].getService(Ci.nsIDOMStorageManager);
const IO_SERVICE = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

// Singleton instance of the Apps object
var gApps = null;

// Glue to talk to Jetpack and get our module from it
function loadJetpackModule(module) {
  return Components.classes["@mozilla.org/harness-service;1?id=jid0-SauOgWZPJJ7lDBV2KQplMVvzJhY"].
    getService().wrappedJSObject.loader.require(module);
}
var apps_jetpack = null;
apps_jetpack = loadJetpackModule("apps");

function init() {
  try { 
    // Get access to local storage for the application domain
    var appStorageURI = IO_SERVICE.newURI(APP_STORAGE_DOMAIN, null, null);
    var principal = SCRIPT_SECURITY_MGR.getCodebasePrincipal(appStorageURI);
    var storage = STORAGE_MANAGER.getLocalStorageForPrincipal(principal, {});
    gApps = new Apps(storage);

    // Draw it
    render();
    
    // Refresh notifications
    gApps.refreshNotifications(notificationsWereRefreshed);
  } catch (e) {
    alert(e);
  }
}


var servers = {};
var storage;
var manageMode = false;
var serverAppLookup = {}; // maps from server+appID to ticket
var gIconSize = 48;// get from pref

// Global message inbox
var gMessageInboxMap = {};

// pseudoinstallation for the global inbox
var messageInboxInstall = {
  app:
  {
    name:"Messages",
    app:{
      urls: [],
      launch: {
        web_url: "apps://apps/inbox.html"
      }
    },
    icons: {
      "96":apps_jetpack.getDataURL("inbox_96.png")
    }
  }
};

function elem(type, clazz) {
	var e = document.createElement(type);
  if (clazz) e.setAttribute("class", clazz);
  return e;
}

function notificationsWereRefreshed()
{
}

// Creates an opener for an app tab.  The usual behavior
// applies - if the app is already running, we switch to it.
// If the app is not running, we create a new app tab and
// launch the app into it.
function makeOpenAppTabFn(app, targetURL)
{
  return function(evt) {
    apps_jetpack.openAppURL(app, targetURL, evt.metaKey);
  }
}

// Render the contents of the "apps" element by creating canvases
// and labels for all apps.
function render() {
  var box = document.getElementById("apps");
  box.innerHTML = "";
 
  function createAppIcon(install) {
    var div = elem("div", "appbox");
    div.style.cursor = "pointer";
    div.onclick = makeOpenAppTabFn(install.app, install.app.app.launch.web_url);

    img = createAppCanvas(install.app);
    img.setAttribute("class", "app_icon");
    div.appendChild(img);

    var label = elem("div", "app_name");
    label.appendChild(document.createTextNode(install.app.name));
    div.appendChild(label);

    box.appendChild(div);
  }


  if (true) { /*(showInbox) {*/
    let total = 0;
    for each (let inbox in gMessageInboxMap) {
      total += inbox.length;
    }
    messageInboxInstall.notificationCount = total;
    createAppIcon(messageInboxInstall);
  }
  
  for (let i=0;i<gApps.installs.length;i++)
  {
    try {
      let install = gApps.installs[i];
      createAppIcon(install);
    } catch (e) {
      alert(e);
    }
  }
  
/*
  var serverDiv = document.getElementById("servers");
  serverDiv.innerHTML = "";
  for (var server in servers)
  {
    var div = elem("div", "server");
    var a = elem("a");
    a.setAttribute("href", server);
    a.appendChild(document.createTextNode(server));
    div.appendChild(a)
    serverDiv.appendChild(div);
  }
*/
}

function createAppCanvas(manifest)
{
  var cvs = elem("canvas");
  cvs.manifest = manifest;
  cvs.width = gIconSize + 12;
  cvs.height = gIconSize + 12;
  ctx = cvs.getContext("2d");
  ctx.fillStyle = "rgb(255,255,255)";
  
  var img = new Image();
  // TODO: be clever about which icon to use
  
  var icons = manifest.icons;
  var size = null;
  if (icons["96"]) size = "96";
  else if (icons["48"]) size = "48";
  else{
    // take the first one?
  }
  img.src = manifest.icons[size];
  img.onload = makeAppCanvasDrawFn(ctx, img, manifest);
  return cvs;
}

function  roundRect(ctx, x, y, width, height, radius, fill, stroke) 
{
  stroke = stroke === undefined ? true : false;
  radius = radius === undefined ? 5 : radius;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) {
    ctx.fill();
  }       
  if (stroke) {
    ctx.stroke();
  }
}

function circle(ctx, x, y, radius, fill, stroke)
{
  if (fill) ctx.fillStyle = fill;
  if (stroke) ctx.strokeStyle = stroke;
  ctx.beginPath();
  ctx.moveTo(x+radius, y);
  ctx.arc(x, y, radius, 0, 2 * 3.14,false);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function makeAppCanvasDrawFn(ctx, img, manifest)
{
  return function() {
    for (var i=0;i<6;i++) {
      ctx.fillStyle = "rgba(0,0,0," + (i / 20.0) + ")";
      roundRect(ctx, 6-i, 6-i, gIconSize, gIconSize, badgeRadius, true, false);
    }
    ctx.save();
    ctx.beginPath();
    var badgeRadius = gIconSize / 4;
    roundRect(ctx, 0, 0, gIconSize, gIconSize, badgeRadius, false, true);
    ctx.clip();
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, gIconSize, gIconSize);
    ctx.restore();

    if (manifest.notificationCount) {
      drawNotificationBadge(ctx, manifest.notificationCount);
    }
  }
}

function drawNotificationBadge(ctx, count)
{
  circle(ctx, gIconSize - 2, 12, 10, "rgba(0,0,0,200)", null);
  circle(ctx, gIconSize - 3, 11, 10, "rgb(255,0,0)", "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.fillStyle = "rgb(255,255,255)";
  ctx.strokeStyle = "rgb(255,255,255)";
  ctx.font = "12px sans serif";
  ctx.fillText("" + manifest.notificationCount, gIconSize - 8, 14);
  ctx.strokeText("" + manifest.notificationCount, gIconSize - 8, 14);
}

function setIconSize(size)
{
  gIconSize = size;
  var theRules;
  if (document.styleSheets[0].cssRules) {
		theRules = document.styleSheets[0].cssRules;
	} else if (document.styleSheets[0].rules) {
		theRules = document.styleSheets[0].rules;
	}

  // I'm not sure putting the icons into the DOM 
  // is really the right approach.  But this is
  // necessary for spacing them out, for now.
  for each (var r in theRules)
  {
    if (r.selectorText == ".ticket")
    {
      r.style.width = size + 24 + "px";
      r.style.height = size + 24 + "px";
    }
  }
  render();
} 

function formatDate(dateStr)
{
  if (!dateStr) return "null";
  
  var now = new Date();
  var then = new Date(dateStr);

  if (then.getDate() != now.getDate())
  {
     var dayDelta = (new Date().getTime() - then.getTime() ) / 1000 / 60 / 60 / 24 // hours
     if (dayDelta < 2) str = "yesterday";
     else if (dayDelta < 7) str = Math.floor(dayDelta) + " days ago";
     else if (dayDelta < 14) str = "last week";
     else if (dayDelta < 30) str = Math.floor(dayDelta) + " days ago";
     else str = Math.floor(dayDelta /30)  + " month" + ((dayDelta/30>2)?"s":"") + " ago";
  } else {
      var str;
      var hrs = then.getHours();
      var mins = then.getMinutes();
      
      var hr = Math.floor(Math.floor(hrs) % 12);
      if (hr == 0) hr =12;
      var mins = Math.floor(mins);
      str = hr + ":" + (mins < 10 ? "0" : "") + Math.floor(mins) + " " + (hrs >= 12 ? "P.M." : "A.M.");
  }
  return str;
}


// TODO: onfocus, reload

