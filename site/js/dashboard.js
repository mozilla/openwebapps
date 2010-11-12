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
 * The Original Code is App Dashboard, dashboard.js
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Michael Hanson <mhanson@mozilla.com>
 *  Dan Walkowski <dwalkowski@mozilla.com>
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



// Singleton instance of the Apps object:
var gApps = null;

// The selected app
var gSelectedInstall = null;

// Display mode:
var ROOT = 1;
var APP_INFO = 2;
var gDisplayMode = ROOT;
var gAppPositions = null;


//simplify localStorage reading/writing
Storage.prototype.setObject = function(key, value) {
    this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function(key) {
    return this.getItem(key) && JSON.parse(this.getItem(key));
}


function retrieveInstalledApps() 
{
  var listOfApps;
  navigator.apps.mgmt.list(function (listOfInstalledApps) {
    (function () {
      gApps = listOfInstalledApps;
      gDisplayMode = ROOT;
      render();
    })();
  });
  
  
}


$(document).ready(function() {                      
  // can this user use myapps?
   var w = window;
   if (w.JSON && w.postMessage && w.localStorage) {
       $("#container").fadeIn(500);
       try {
           // Construct our Apps handle
            retrieveInstalledApps();
            if (w.localStorage.dashposition) {
              gAppPositions = w.localStorage.getObject("dashposition");   
            }

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
              if ($(this).hasClass("ui-draggable-dragged")) {
              $(this).removeClass("ui-draggable-dragged");
              return false;
            }

      navigator.apps.openAppTab(app, targetURL, {background:evt.metaKey});
    }
  }
  else
  {
    return function(evt) {
          if ($(this).hasClass("ui-draggable-dragged")) {
              $(this).removeClass("ui-draggable-dragged");
              return false;
            }

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
  for ( aKey in gApps)
  {
    try {
      var install = gApps[aKey];

      var icon = createAppIcon(install);

      if (install === gSelectedInstall) {
        selectedBox = icon;
      }
      box.append(icon);
    } catch (e) {

      alert("Error while creating application icon for app " + i + ": " + e);
    }
  }

    if (gDisplayMode == APP_INFO) {
        // kick back to "ROOT" display mode if there's no
        // selected application for which to display an info pane
        if (selectedBox) {
            renderAppInfo(selectedBox);
        } else {
            gDisplayMode == ROOT;
        }
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

function getBiggestIcon(minifest) {
  //see if the minifest has any icons, and if so, return the largest one
  if (minifest.icons) {
    var biggest = 0;
    for (z in minifest.icons) {
      var size = parseInt(z, 10);
      if (z > biggest) biggest = z;
    }
    if (biggest !== 0) return minifest.icons[biggest];
  }
  return null;
}

function renderAppInfo(selectedBox)
{
    $("#getInfo").remove();

    // Set up Info starting location
    var info = document.createElement("div");
    info.id = getInfoId;
    info.className = "getInfo";

    var badge = elem("div", "appBadge");
    var appIcon = elem("div", "icon");
    
    var icon = getBiggestIcon(gSelectedInstall);
    
    if (icon) {
        appIcon.setAttribute("style", 
                             "background:url(\"" + icon + "\") no-repeat; background-size:100%");
    }
    
    $(appIcon).css("position", "absolute").css("top", -4).css("left", 8);

    var label = elem("div", "appBadgeName");
    label.appendChild(document.createTextNode(gSelectedInstall.name));

    badge.appendChild(appIcon);
    badge.appendChild(label);
    info.appendChild(badge);
    

    var off = $(selectedBox).offset();
    $(info).css("postion", "absolute").css("top", off.top + -4).css("left", off.left + -8);
    $(info).width(110).height(128).animate({
        width: 300,
        height: 320
    }, 200, function() {
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
        if (gSelectedInstall.developer) {
          if (gSelectedInstall.developer.url) {
            var a = elem("a");
            a.setAttribute("href", gSelectedInstall.developer.url);
            a.setAttribute("target", "_blank");
            a.appendChild(document.createTextNode(gSelectedInstall.developer.name));
            dev.appendChild(a);
            data.appendChild(dev);

            var linkbox = elem("div", "developerLink");
            a = elem("a");
            a.setAttribute("href", gSelectedInstall.developer.url);
            a.setAttribute("target", "_blank");
            a.appendChild(document.createTextNode(gSelectedInstall.developer.url));
            linkbox.appendChild(a);
            data.appendChild(linkbox);

          } else {
            if (gSelectedInstall.developer.name) {
                dev.appendChild(document.createTextNode(gSelectedInstall.developer.name));
                data.appendChild(dev);
            } else {
                dev.appendChild(document.createTextNode("No developer info"));
                $(dev).addClass("devUnknown");
                data.appendChild(dev);
            }
          }
        }
        
        info.appendChild(data);

        var desc = elem("div", "desc");
        desc.appendChild(document.createTextNode(gSelectedInstall.description));
        info.appendChild(desc);

        var props = elem("div", "appProperties");

        props.appendChild(makeColumn("Install Date", formatDate(gSelectedInstall.installTime)));
        props.appendChild(makeColumn("Installed From", gSelectedInstall.installURL));

        info.appendChild(props);

        // finally, a delete link and action
        $("<div/>").text("Delete this application.").addClass("deleteText").appendTo(info).click(function() {
            navigator.apps.mgmt.remove(gSelectedInstall.launchURL, 
                                        function() {
                                                     retrieveInstalledApps();
                                                  });

            //gApps.remove(gSelectedInstall.launchURL);
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
    appDiv.onclick = makeOpenAppTabFn(install, install.launchURL);
    
    
    appDiv.setAttribute("id", "app:" + install.launchURL);

    $(appDiv).draggable({ containment: "#appList", scroll: false, stop: function(event, ui) {
                            //store the new position in the dashboard meta-data
                            var offset = ui.offset;
                            if (!gAppPositions) { gAppPositions = {}; }
                            gAppPositions[install.launchURL] = offset;
                            window.localStorage.setObject("dashposition", gAppPositions);
                            $(this).addClass("ui-draggable-dragged");
                        }
                      });

    var iconDiv = $("<div/>").addClass("icon");
    $(appDiv).append(iconDiv);

    var icon = getBiggestIcon(install);
    if (icon) {
        iconDiv.css({
            background: "url(\"" + icon + "\") no-repeat #FFFFFF",
            backgroundSize: "100%"
        });
    }

    var moreInfo = $("<div/>").addClass("moreInfo").appendTo(iconDiv);
    $("<a/>").appendTo(iconDiv);

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
        var app = install.launchURL;
        gSelectedInstall = gApps[app];
        if (!gSelectedInstall) return;

        gDisplayMode = APP_INFO;
        render();
        return false;
    });

    if (gAppPositions) {
      var appPos = gAppPositions[install.launchURL];
      if (appPos) {
          $(appDiv).css("position", "absolute").css("top", appPos.top).css("left", appPos.left);
      }
    }
    
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
    gDisplayMode = ROOT;
    retrieveInstalledApps();
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
