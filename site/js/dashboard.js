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


APP_STORAGE_DOMAIN = "http://myapps.mozillalabs.com";

// Singleton instance of the Apps object:
var gApps = null;

// The selected app
var gSelectedInstall = null;

// Display mode:
/* const */ ROOT = 1;
/* const */ APP_INFO = 2;
/* const */ NOTIFICATIONS = 3;
var gDisplayMode = ROOT;

// Various display settings
var gIconSize = 48;// get from pref

function init() {
  try {
    // Construct our Apps handle
    gApps = new Apps();

    // Draw it
    gDisplayMode = ROOT;
    try {
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

function elem(type, clazz) {
	var e = document.createElement(type);
  if (clazz) e.setAttribute("class", clazz);
  return e;
}

function NotificationDB() {
  this.notifications = [];
}

NotificationDB.prototype = {
  add: function(install, notifications) {
    for (var i=0;i<notifications.length;i++) {
      var notif = notifications[i];
      notif.install = install;
      this.notifications.push(notif);
      
      if (window.navigator && window.navigator.apps && window.navigator.apps.externalNotify) {
        window.navigator.apps.externalNotify(notif.title, 
                                             notif.summary, 
                                             notif.link, 
                                             function (data) {
                                             
                                                if (navigator.apps && navigator.apps.openAppTab)
                                                {
                                                  navigator.apps.openAppTab(install, data, {});
                                                }
                                                else
                                                {
                                                  window.open(data, "_blank");
                                                }
                                             });
                                             
      }
    }
  },

  getForApp: function(appKey) {
    var result = [];
    for (var i=0;i<this.notifications.length;i++) {
      var notif = this.notifications[i];

      if (notif.install.app.app.launch.web_url == appKey) {
        result.push(notif);
      }
    }
    return result;
  },

  getSortedByDate: function() {
    this.notifications.sort(function(a,b) {
      if (a.updated && b.updated) {
        return new Date(b.updated) - new Date(a.updated);
      } else if (a.updated) {
        return 1;
      } else if (b.updated) {
        return -1;
      } else {
        return 0;
      }
    });
    return this.notifications;
  },

  anyNotifications: function() {
    return (this.notifications.length > 0);
  },

  count: function() {
    return this.notifications.length;
  }
}
var gNotificationDB = new NotificationDB();

function notificationsWereRefreshed(install, notifications)
{
    try {
        gNotificationDB.add(install, notifications);
        render();
    } catch (e) {
        dump("Error while parsing notification: " + e + "\n");
    }
}


function showNotifications()
{
  gDisplayMode = NOTIFICATIONS;
  render();
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
  var box = $("#appList");
  box.empty();

  var notifTab = $("#notifTab");
  notifTab.empty();
  if (gNotificationDB.anyNotifications()) {
    notifTab.text("Notifications (" + gNotificationDB.count() + ")");
    renderNotifications();
  } else {
    notifTab.text("No notifications");
  }

  if (false) { /*(showInbox) {*/
    box.append(createAppIcon(messageInboxInstall));
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

const SORT_DATE = 1;
const SORT_APP = 2;
var gNotificationSort = SORT_DATE;
function renderNotifications()
{
  var box = $("#notifications");
  box.empty();
  
  var nots;
  if (gNotificationSort == SORT_DATE) {
    nots = gNotificationDB.getSortedByDate();
  } else if (gNotificationSort == SORT_APP) {
    nots = gNotificationDB.getSortedByApp();
  }

  for (var i=0;i<nots.length;i++)
  {
    var nBox = $("<div>").addClass("notification");
    var nIconBox = $("<div>").addClass("notIcon");
    var nIcon = $("<img>").attr({
      width:16, height:16, src:gApps.getIcon(nots[i].install.app, 16)});
    nIconBox.append(nIcon);
    nBox.append(nIconBox);

    var nTitle = $("<div>").addClass("notTitle");
    nBox.append(nTitle);

    if (nots[i].link) {
      var nLink = $("<a>").text(nots[i].title).attr({href:"#"});
      nLink.click(makeOpenAppTabFn(nots[i].install.app, nots[i].link));
      // attr({href:nots[i].link}).
      nTitle.append(nLink);
    } else {
      nTitle.text(nots[i].title);
    }
    var nDate = $("<div>").addClass("notDate").text(formatDate(nots[i].updated));
    nBox.append(nDate);
    var nSummary = $("<div>").addClass("notSummary").text(nots[i].summary);
    nBox.append(nSummary);

    // TODO support ActivityStreams for image preview, etc.

    box.append(nBox);
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
//  document.body.removeChild(document.getElementById(overlayId));
}

function renderAppInfo(selectedBox)
{
//  var od = showDarkOverlay();
  $("getInfo").remove();

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
  var appIcon = elem("div", "app_icon");
  var icon = gApps.getIcon(gSelectedInstall.app, "96");
  if (icon) {
    appIcon.setAttribute("style", 
      "background:url(\"" + icon + "\") no-repeat; background-size:100%");
  }
  
  var label = elem("div", "appBadgeName");
  label.appendChild(document.createTextNode(gSelectedInstall.app.name));

  badge.appendChild(label);
  badge.appendChild(appIcon);
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

    var searchable = false;
    var notifications = false;
    if (gSelectedInstall.app.supportedAPIs) {
        for (var i=0; i < gSelectedInstall.app.supportedAPIs.length; i++) {
            if (gSelectedInstall.app.supportedAPIs[i] === 'search') {
                searchable=true;
            } else if (gSelectedInstall.app.supportedAPIs[i] === 'notification') {
	        notifications=true;
            }
	}
    }

    if (searchable) {
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

    if (notifications) {
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
      return false;
    });
  }, 0);

}

function createAppIcon(install) 
{
  var appDiv = elem("div", "app");
  appDiv.onclick = makeOpenAppTabFn(install.app, install.app.app.launch.web_url);
  appDiv.setAttribute("id", "app:" + install.app.app.launch.web_url);

  var iconDiv = elem("div", "icon");
  $(iconDiv).appendTo($(appDiv));
  
  var icon = gApps.getIcon(install.app, "96");
  if (icon) {
    iconDiv.setAttribute("style", 
      "background:url(\"" + icon + "\") no-repeat; background-size:100%");
    //iconDiv.style.background = "url(\"" + icon + "\") no-repeat";
    //iconDiv.style.backgroundScale = "100%";
  }

  var link = elem("a");
  $(link).appendTo($(iconDiv));

  var nameDiv = elem("div", "appName");
  $(nameDiv).text(install.app.name).appendTo($(iconDiv));
  
  // Set up the context menu:
  $(appDiv).contextMenu(
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
      else if (action == "appUninstall")
      {
        gApps.remove(app);
        gSelectedInstall = null;
        render();
      }
    }
  );
  return appDiv;
}


function drawNotificationBadge(ctx, count)
{
  circle(ctx, gIconSize - 2, 12, 10, "rgba(0,0,0,200)", null);
  circle(ctx, gIconSize - 3, 11, 10, "rgb(255,0,0)", "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.fillStyle = "rgb(255,255,255)";
  ctx.strokeStyle = "rgb(255,255,255)";
  ctx.font = "11px Helvetica, sans-serif";
  ctx.fillText("" + count, gIconSize - 8, 14);
  ctx.strokeText("" + count, gIconSize - 8, 14);
}

function drawAlertBadge(ctx)
{
  ctx.beginPath();
  ctx.moveTo(gIconSize - 10, 17);
  ctx.lineTo(gIconSize , 0);
  ctx.lineTo(gIconSize + 10, 17);
  ctx.lineTo(gIconSize - 10, 17);
  ctx.fillStyle = "rgb(239,221,112)";
  ctx.strokeStyle = "rgb(0,0,0)";
  ctx.fill();
  ctx.stroke();
  ctx.font = "11px serif";
  ctx.strokeText("!", gIconSize-2, 14);
  ctx.endPath();
}

function formatDate(dateStr)
{
  if (!dateStr) return "null";

  var now = new Date();
  var then = new Date(dateStr);

  if (then.getTime() > now.getTime()) {
    return "the future";
  }
  else if (then.getMonth() != now.getMonth() ||  then.getDate() != now.getDate())
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
      str = hr + ":" + (mins < 10 ? "0" : "") + Math.floor(mins) + " " + (hrs >= 12 ? "P.M." : "A.M.") + " today";
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
function onFocus(event)
{
  if (gApps) {
    gApps.reload();
    render();
    gNotificationDB = new NotificationDB();
    gApps.refreshNotifications(notificationsWereRefreshed);
  }
}


if (window.addEventListener) {
    window.addEventListener('message', onMessage, false);
} else if(window.attachEvent) {
    window.attachEvent('onmessage', onMessage);
}

if (window.addEventListener) {
    window.addEventListener('focus', onFocus, false);
} else if(window.attachEvent) {
    window.attachEvent('onfocus', onFocus);
}

$(function(){

});
