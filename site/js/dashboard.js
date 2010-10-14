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
var gDisplayMode = ROOT;

// Various display settings
var gIconSize = 48;// get from pref

$(document).ready(function() {
    // can this user use myapps?
    var w = window;
    if (w.JSON && w.postMessage && w.localStorage) {
        $("#container").fadeIn(500);
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
        } catch (e) {
            alert(e);
        }
    } else {
        $("#unsupportedBrowser").fadeIn(500);
    }
});

function elem(type, clazz) {
	var e = document.createElement(type);
  if (clazz) e.setAttribute("class", clazz);
  return e;
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
//  document.body.removeChild(document.getElementById(overlayId));
}

function renderAppInfo(selectedBox)
{
    $("#getInfo").remove();

    // Set up Info starting location
    var info = document.createElement("div");
    info.id = getInfoId;
    info.className = "getInfo";

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


    var off = $(selectedBox).offset();
    $(info).css("postion", "absolute").css("top", off.top).css("left", off.left);
    $(info).width(96).height(96).animate({
        width: 300,
        height: 300
    }, 200, function() {
        console.log("begin rendering");
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

        props.appendChild(makeColumn("Install Date", formatDate(gSelectedInstall.installTime)));
        props.appendChild(makeColumn("Installed From", gSelectedInstall.installURL));
        if (gSelectedInstall.authorization_token) props.appendChild(makeColumn("Authz Token", gSelectedInstall.authorization_token));

        info.appendChild(props);

        // finally, a delete link and action
        $("<div/>").text("Delete this application.").addClass("deleteText").appendTo(info).click(function() {
            gApps.remove(gSelectedInstall.app.app.launch.web_url);
            gSelectedInstall = null;
            gDisplayMode = ROOT;
            render();

            // let's now create a synthetic click to the document to cause the info dialog to get dismissed and
            // cleaned up properly
            $(document).click();

            return false;
        });

        $(info).click(function() {return false;});
    });

    $("body").append(info);

    // Dismiss box when user clicks anywhere else
    setTimeout( function() { // Delay for Mozilla
        $(document).click(function() {
            $(document).unbind('click');
            $(info).fadeOut(100, function() { $("#"+getInfoId).remove(); });
            return false;
        });
    }, 0);
}

function createAppIcon(install) 
{
    var appDiv = elem("div", "app");
    appDiv.onclick = makeOpenAppTabFn(install.app, install.app.app.launch.web_url);
    appDiv.setAttribute("id", "app:" + install.app.app.launch.web_url);

    var iconDiv = $("<div/>").addClass("icon");
    $(appDiv).append(iconDiv);

    var icon = gApps.getIcon(install.app, "96");
    if (icon) {
        iconDiv.css({
            background: "url(\"" + icon + "\") no-repeat",
            backgroundSize: "100%"
        });
    }

    var moreInfo = $("<div/>").addClass("moreInfo").appendTo(iconDiv);
    $("<a/>").appendTo(iconDiv);
    $("<div/>").text(install.app.name).addClass("appName").appendTo(iconDiv);

    // Set up the hover handler.  Only fade in after the user hovers for 
    // 500ms.
    var tHandle;
    $(iconDiv).hover(function() {
        var self = $(this);
        tHandle = setTimeout(function() {
            self.find(".moreInfo").fadeIn();
        }, 500);
    }, function() {
        $(this).find(".moreInfo").hide();
        clearTimeout(tHandle);
    });

    // bring up detail display when user clicks on info icon
    moreInfo.click(function(e) {
        // if there is currently an open info window, this synthetic click will
        // cause it to be cleaned up.  if not, its a noop.
        $(document).click();

        var app = install.app.app.launch.web_url;
        gSelectedInstall = gApps.getInstall(app);
        if (!gSelectedInstall) return;

        gDisplayMode = APP_INFO;
        render();
        return false;
    });

    return appDiv;
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
