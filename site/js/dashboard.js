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



APP_STORAGE_DOMAIN = "http://myapps.mozillalabs.com";


  // HACK DEBUGGING
function setUpDemoApps() {

window.localStorage.setItem("http://www.debugapp.com", JSON.stringify({
  
    installTime: new Date().getTime(),
    installURL: "http://megaappsite.com",
    app: {
      name:"CowWorld",
      app:{
        urls: [],
        launch: {
          web_url: "http://www.debugapp.com"
        }
      },
      icons: {
        "96":"/cows.png"
      },
      description: "Manage your phlogiston remotely, using our fabulous fluxtronic impellers!",
      developerName: "Miskatonix",
      developerURL: "http://miskatonix.com/",
      notification: "http://www.debugapp.com.faketld/notification.atom",
      search: "http://www.debugapp.com.faketld/search?q={searchTerms}",
      permissions: []
    }})
);

window.localStorage.setItem("http://www.greplin.com", 
  JSON.stringify({
    installTime: new Date().getTime(),
    installURL: "http://megaappsite.com",
    app: {
      name:"Greplin",
      app:{
        urls: [],
        launch: {
          web_url: "http://www.greplin.com"
        }
      },
      icons: {
        "96":"cows.png"
      },
      description: "The search bar for your life.",
      developerName: "greplin",
      developerURL: "http://blog.greplin.com/",
      search: "https://www.greplin.com/ajax/spotlight?q={searchTerms}&fq=0",
      permissions: []
    }
  }
));

window.localStorage.setItem("http://docs.google.com", 
  JSON.stringify({
    installTime: new Date().getTime(),
    installURL: "http://megaappsite.com",
    app: {
      name:"Google Docs",
      app:{
        urls: [],
        launch: {
          web_url: "http://docs.google.com"
        }
      },
      icons: {
        "96":"cows.png"
      },
      description: "Create documents, spreadsheets and presentations online.",
      developerName: "Google",
      developerURL: "http://www.google.com/support",
      search: "https://docs.google.com/feeds/default/private/full", // ?q={searchTerms}", // v=3?
      searchScope: "https://docs.google.com/feeds",
      oauthGetRequestURL:"https://www.google.com/accounts/OAuthGetRequestToken",
      oauthAuthorizeURL:"https://www.google.com/accounts/OAuthAuthorizeToken",
      oauthGetAccessURL:"https://www.google.com/accounts/OAuthGetAccessToken",
      permissions: []
    }
  }
));

window.localStorage.setItem("http://contacts.google.com", 
  JSON.stringify({
    installTime: new Date().getTime(),
    installURL: "http://megaappsite.com",
    app: {
      name:"Google Contacts",
      app:{
        urls: [],
        launch: {
          web_url: "http://contacts.google.com"
        }
      },
      icons: {
        "96":"cows.png"
      },
      description: "Google Contacts is a place to import, store and view all of the contact information that's important to you.",
      developerName: "Google",
      developerURL: "http://www.google.com/support",
      search: "https://www.google.com/m8/feeds/contacts/default/full",//?q={searchTerms}",
      searchScope: "https://www.google.com/m8/feeds",
      oauthGetRequestURL:"https://www.google.com/accounts/OAuthGetRequestToken",
      oauthAuthorizeURL:"https://www.google.com/accounts/OAuthAuthorizeToken",
      oauthGetAccessURL:"https://www.google.com/accounts/OAuthGetAccessToken",
      permissions: []
    }
  }
));

window.localStorage.setItem("http://www.facebook.com", 
  JSON.stringify({
    installTime: new Date().getTime(),
    installURL: "http://megaappsite.com",
    app: {
      name:"Facebook",
      app:{
        urls: [],
        launch: {
          web_url: "http://www.facebook.com"
        }
      },
      icons: {
        "96":"cows.png"
      },
      description: "Facebook!",
      developerName: "Facebook",
      developerURL: "http://www.facebook.com/about",

      // Search notes:
      // Ajax typeahead is:
      // http://www.facebook.com/ajax/typeahead/search.php?__a=1&value={searchTerms}&viewer={usernumber}
      //
      // There's a Graph API search too.
      // oauthVersion:"2.0",
      // oauthAuthorizeURL:"https://graph.facebook.com/oauth/authorize",
      // oauthGetAccessURL:"https://graph.facebook.com/oauth/access_token",
      permissions: []
    }
  }
));

init();
}



// Singleton instance of the Apps object:
var gApps = null;

// The selected app
var gSelectedInstall = null;

// Display mode:
/* const */ ROOT = 1;
/* const */ APP_INFO = 2;
var gDisplayMode = ROOT;

// Various display settings
var gIconSize = 48;// get from pref

function init() {
  try { 
    // Construct our Apps handl
    gApps = new Apps();

    // Draw it
    gDisplayMode = ROOT;
    try {
/*      if (window.location.hash) {
        var action = JSON.parse(window.location.hash.substring(1));
        if (action.a == "info")
        {
          gDisplayMode = APP_INFO;
        }
      }*/
    } catch (e) {
      gApps.logError("Error while initializing apps: " + e);
    }
    render();
    
    // Refresh notifications
    gApps.refreshNotifications(notificationsWereRefreshed);
  } catch (e) {
    alert(e);
  }
}

// pseudoinstallation for the global inbox
var messageInboxInstall = {
  app:
  {
    name:"Messages",
    app:{
      urls: [],
      launch: {
        web_url: "http://www.gmail.com"
      }
    },
    icons: {
      "96":"inbox_96.png"
    }
  }
};

function elem(type, clazz) {
	var e = document.createElement(type);
  if (clazz) e.setAttribute("class", clazz);
  return e;
}

// TODO: got some notifications. do something.
function notificationsWereRefreshed()
{
}

// Creates an opener for an app tab.  The usual behavior
// applies - if the app is already running, we switch to it.
// If the app is not running, we create a new app tab and
// launch the app into it.
function makeOpenAppTabFn(app, targetURL)
{
  if (navigator.apps && navigator.apps.openAppTab)
  {
    return function(evt) {
      navigator.apps.openAppTab(app, targetURL, {background:evt.metaKey});
    }
  }
  else 
  {
    return function(evt) {
      window.open(targetURL, "_blank");
    }
  }
  return null;
}

// Render the contents of the "apps" element by creating canvases
// and labels for all apps.
function render() 
{
  // if gDisplayMode == .......
  
  var box = $("#apps");
  box.empty();
  if (false) { /*(showInbox) {*/
    box.append(createAppIcon(messageInboxInstall));
  }
  if (true /*gApps.installs.length == 0*/) {
    var b = elem("button");
    b.appendChild(document.createTextNode("Get Me Some Demo Apps!"));
    b.onclick = setUpDemoApps;
    box.append(b);
  }

  var selectedBox = null;
  for (var i=0;i<gApps.installs.length;i++)
  {
    try {
      var install = gApps.installs[i];

      var icon = createAppIcon(install);

      if (install === gSelectedInstall) {
        selectedBox = icon;
      }
      box.append(icon);
    } catch (e) {

      gApps.logError("Error while creating application icon for app " + i + ": " + e);
    }
  }
  
  if (gDisplayMode == APP_INFO) {
    renderAppInfo(selectedBox);
  }
}

var overlayId = "myAppsDialogOverlay";
var getInfoId = "getInfo";

function showDarkOverlay() {
  try { hideDarkOverlay() } catch(e) { };
  // create a opacity overlay to focus the users attention 
  var od = document.createElement("div");
  od.id = overlayId;
  od.style.background = "#000";
  od.style.opacity = ".10";
  od.style.filter = "alpha(opacity=10)";
  od.style.position = "fixed";
  od.style.top = "0";
  od.style.left = "0";
  od.style.height = "100%";
  od.style.width = "100%";
  od.style.zIndex ="998";
  document.body.appendChild(od);
//  document.getElementById(dialogId).style.display = "inline";
  return od;
}

function hideDarkOverlay() {
//  document.getElementById(dialogId).style.display = "none";
  document.body.removeChild(document.getElementById(overlayId));
}

function renderAppInfo(selectedBox)
{
  var od = showDarkOverlay();

  // Set up Info starting location
  var info = document.createElement("div");
  info.id = getInfoId;
  info.className = "getInfo";
  info.style.width="96px";
  info.style.height="96px";
  var rect = selectedBox.getBoundingClientRect();
  info.style.left= rect.left + "px";
  info.style.top= rect.top-8 + "px";

  // Start animation to target size
  var width = 300, height = 340;
  var docRect = document.body.getBoundingClientRect();
  var targetLeft = rect.left;
  var targetTop = rect.top - 8;
  if (rect.left + width > docRect.right-20) targetLeft = docRect.right-20 - width;
  window.setTimeout(function() { 
    if (targetLeft != rect.left) info.style.left = targetLeft +"px";
    info.style.width=width+"px";
    info.style.height=height+"px";
  }, 0);

  var badge = elem("div", "appBadge");
  var canvas = createAppCanvas(gSelectedInstall.app);
  canvas.setAttribute("class", "app_icon");
  badge.appendChild(canvas);
  var label = elem("div", "appBadgeName");
  label.appendChild(document.createTextNode(gSelectedInstall.app.name));
  badge.appendChild(label);
  info.appendChild(badge);

  // Render the contents once we reach full size
  window.setTimeout(function() {

    var data = elem("div", "appData");
    function makeColumn(label, value) {
      var boxDiv = elem("div", "appDataBox");
      var labelDiv = elem("div", "appDataLabel");
      var valueDiv = elem("div", "appDataValue");
      labelDiv.appendChild(document.createTextNode(label));
      if (typeof value == "string") {
        valueDiv.appendChild(document.createTextNode(value));
      } else {
        valueDiv.appendChild(value);
      }
      boxDiv.appendChild(labelDiv);
      boxDiv.appendChild(valueDiv);
      return boxDiv;
    }
    var dev = elem("div", "developerName");
    if (gSelectedInstall.app.developerURL) {
      var a = elem("a");
      a.setAttribute("href", gSelectedInstall.app.developerURL);
      a.setAttribute("target", "_blank");
      a.appendChild(document.createTextNode(gSelectedInstall.app.developerName));
      dev.appendChild(a);
      data.appendChild(dev);

      var linkbox = elem("div", "developerLink");
      a = elem("a");
      a.setAttribute("href", gSelectedInstall.app.developerURL);
      a.setAttribute("target", "_blank");
      a.appendChild(document.createTextNode(gSelectedInstall.app.developerURL));
      linkbox.appendChild(a);
      data.appendChild(linkbox);

    } else {
      if (gSelectedInstall.app.developerName) {
        dev.appendChild(document.createTextNode(gSelectedInstall.app.developerName));
        data.appendChild(dev);
      } else {
        dev.appendChild(document.createTextNode("No developer info"));      
        $(dev).addClass("devUnknown");
        data.appendChild(dev);
      }
    }
    info.appendChild(data);

    var desc = elem("div", "desc");
    desc.appendChild(document.createTextNode(gSelectedInstall.app.description));
    info.appendChild(desc);

    var props = elem("div", "appProperties");

    if (gSelectedInstall.app.search) {
      var searchDiv = elem("div", "cbox");
      var cbox = elem("input");
      cbox.setAttribute("type", "checkbox");
      searchDiv.appendChild(cbox);
      if (!(gSelectedInstall.prefs && gSelectedInstall.prefs.doNotSearch))
      {
        cbox.checked = true;
      }
      searchDiv.appendChild(document.createTextNode("Include in search results"));
      props.appendChild(makeColumn("Search?", searchDiv));
    } else {
      props.appendChild(makeColumn("Search?", "Not searchable"));
    }
    

    if (gSelectedInstall.app.notification) {
      var notifyDiv = elem("div", "cbox");
      var cbox = elem("input");
      cbox.setAttribute("type", "checkbox");
      notifyDiv.appendChild(cbox);
      if (!(gSelectedInstall.prefs && gSelectedInstall.prefs.doNotNotify))
      {
        cbox.checked = true;
      }
      notifyDiv.appendChild(document.createTextNode("Display notifications"));
      props.appendChild(makeColumn("Notifications?", notifyDiv));
    } else {
      props.appendChild(makeColumn("Notifications?", "None"));
    }    

    props.appendChild(elem("div", "hdiv"));
    props.appendChild(makeColumn("Install Date", formatDate(gSelectedInstall.installTime)));
    props.appendChild(makeColumn("Installed From", gSelectedInstall.installURL));
    if (gSelectedInstall.authorization_token) props.appendChild(makeColumn("Authz Token", gSelectedInstall.authorization_token));

    info.appendChild(props);
    $(info).click(function() {return false;});
  }, 200);
  
  document.body.appendChild(info);

  // Dismiss box when user clicks anywhere else
  setTimeout( function() { // Delay for Mozilla
    $(document).click( function() {
      $(document).unbind('click');
      $(info).fadeOut(100);
      hideDarkOverlay();
      return false;
    });
  }, 0);



}

function createAppIcon(install) {

  var div = elem("div", "appbox");
  div.onclick = makeOpenAppTabFn(install.app, install.app.app.launch.web_url);
  div.setAttribute("id", "app:" + install.app.app.launch.web_url);
  var canvas = createAppCanvas(install.app);
    
  canvas.setAttribute("class", "app_icon");
  div.appendChild(canvas);

  var label = elem("div", "app_name");
  $(label).text(install.app.name).appendTo($(div));

  // Set up the context menu:
  $(div).contextMenu(
    {
      menu: 'appContextMenu'
    },
    function(action, el, pos) {
      var app = $(el).attr('id').substring(4);
      gSelectedInstall = gApps.getInstall(app);
      if (!gSelectedInstall) return;

      if (action == "appDetails")
      {
        gDisplayMode = APP_INFO;
        render();
      }
      else if (action == "appActivate")
      {
        window.location = "startOAuth.html?app=" + gSelectedInstall.app.app.launch.web_url;
      }
      else if (action == "appUninstall")
      {
        gApps.remove(app);
        gSelectedInstall = null;
        render();
      }
    }
  );
  return div;
}


function createAppCanvas(manifest)
{
  var img = new Image();

  var size = null;

  var icons = manifest.icons;
  if (icons["96"]) size = "96";
  else if (icons["48"]) size = "48";
  else{
    // take the first one?
  }
  img.src = manifest.icons[size];

  try {
    var cvs = elem("canvas");
    cvs.width = gIconSize+6;
    cvs.height = gIconSize+6;
    ctx = cvs.getContext("2d");
    
    // TODO: put a generic icon in first because it could load slowly.
    // TODO: be clever about which icon to use
    
    img.onload = makeAppCanvasDrawFn(ctx, img, manifest);
    return cvs;
  } catch(e) {
    // no canvas!
  }

  img.width = gIconSize+6;
  img.height = gIconSize+6;

  return img;
}

function makeAppCanvasDrawFn(ctx, img, manifest)
{
  return function() {
    for (var i=0;i<6;i++) {
      ctx.fillStyle = "rgba(0,0,0," + (i / 20.0) + ")";
      roundRect(ctx, 6-i, 6-i, gIconSize, gIconSize, badgeRadius, true, false)
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
  /*for each (var r in theRules)
  {
    if (r.selectorText == ".ticket")
    {
      r.style.width = size + 24 + "px";
      r.style.height = size + 24 + "px";
    }
  }*/
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

function onMessage(event) 
{
  // unfreeze request message into object
  var msg = JSON.parse(event.data);
  if(!msg) {
    return;
  }
}

if (window.addEventListener) {
    window.addEventListener('message', onMessage, false);
} else if(window.attachEvent) {
    window.attachEvent('onmessage', onMessage);
}

// TODO: onfocus, reload
