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
 * The Original Code is Nuovo Dashboard, nuovodashboard.js
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

//the list filter string
var gFilterString = "";

// Display mode:
var ROOT = 1;
var APP_INFO = 2;
var gDisplayMode = ROOT;
var gDashboardState = {};
gDashboardState.appsInDock = [];
gDashboardState.widgetPositions = {};

var minAppListHeight = 0;
var minAppListWidth = 0;

var getInfoId = "getInfo";



function retrieveInstalledApps()
{
  var listOfApps;
  navigator.apps.mgmt.list(function (listOfInstalledApps) {
    (function () {
      gApps = listOfInstalledApps;
      gDisplayMode = ROOT;
      renderList();
      renderDock();
      renderWidgets();
    })();
  });
}



function getWindowHeight() {
  if(window.innerHeight) return window.innerHeight;
  if (document.body.clientHeight) return document.body.clientHeight;
}

function resizeAppList() {
  var listPos = $("#list").position();
  $("#list").height(getWindowHeight() - (listPos.top + 16));
}

function resizeWidgetArea() {
  var widgePos = $("#widgets").position();
  $("#widgets").height(getWindowHeight() - (widgePos.top + 16));
}


window.onload = function() {
  resizeAppList();
  resizeWidgetArea();
}

window.onresize = function() {
  resizeAppList();
  resizeWidgetArea();
}


function filterAppList(event) {
    //get the current contents of the text field, and only show the ones in the list that match
    gFilterString = $("#filter").val().toLowerCase();
    renderList();
  };

  

$(document).ready(function() {
    //temporarily set the repository origin to localhost
    navigator.apps.setRepoOrigin("..");

  $("#dock").droppable({ accept : function(item) {
      for ( var i = 0; i < gDashboardState.appsInDock.length; i++ ) {
        if ((item[0].classList[0] != "app") || (gDashboardState.appsInDock[i] == item[0].id))
          return false;
        }
        return true;
      }, 
      
      drop : function(event, ui) { 
        gDashboardState.appsInDock.push(ui.helper.context.id); 
        //save state, since we changed item
        navigator.apps.mgmt.saveState(gDashboardState);
        renderDock(); 
      } 
  }).sortable();
  

  // can this user use myapps?
   var w = window;
   if (w.JSON && w.postMessage) {
       try {
             gFilterString = $("#filter").val().toLowerCase();

             // Construct our Apps handle
             retrieveInstalledApps();
             navigator.apps.mgmt.loadState( ( function (s) {
                 gDashboardState = s;
                 if (!gDashboardState) {
                     gDashboardState = {};
                     gDashboardState.appsInDock = [];
                     gDashboardState.widgetPositions = {};
                 } else {
                     // re-render dashboard now that state has been fetched
                     renderList();
                     renderDock();
                     renderWidgets();
                 }
             }));
           } catch (e) {
           if (typeof console !== "undefined") console.log(e);
       }

       // figure out which browser we are on, and whether the addon has been installed and enabled, and whether we should pester them if not.
     // self.recommendAddon();

   } else {
       $("#unsupportedBrowser").fadeIn(500);
   }

   //updateLoginStatus();
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
function makeOpenAppTabFn(app, id)
{
    return function(evt) {
         if ($(this).hasClass("ui-draggable-dragged")) {
             $(this).removeClass("ui-draggable-dragged");
             return false;
         }

        navigator.apps.mgmt.launch(id);
    }
}

function renderList() {
  if (!gApps) return;
  var appList = $("#list");
  $('.app').remove();
  
  for ( var i = 0; i < gApps.length; i++ ) {
    try {
      var install = gApps[i];
      
      if (gFilterString.length == 0 || gFilterString == install.name.substr(0,gFilterString.length).toLowerCase() ) {
        var icon = createAppIcon(install);
        //check for no icon here, and supply a default one
        appList.append(icon);
      }
    } catch (e) {
      if (typeof console !== "undefined") console.log("Error while creating list icon for app " + i + ": " + e);
    }
  }
}


// Render the contents of the "apps" element by creating canvases
// and labels for all apps.
function renderWidgets()
{
  if (!gApps) return;
  
  var widgetSpace = $("#widgets");

  $('.widget').remove();
  
  //loop over all the installed apps, adding them to the big app list, and then checking to see if they
  // have a widget (and it's enabled?) and drawing that, and also checking to see if they are in the dock,
  // and adding the big icon there too
  for ( var i = 0; i < gApps.length; i++ ) {
    try {
      var install = gApps[i];
      
      //do we have a widget?  if so, make it and put it in the widgetspace
      if (install.widgetURL) {
        var height;
        var width;
        var left;
        var top;
        var savedWidgetState = gDashboardState.widgetPositions[install.id];
        
        if (savedWidgetState) {
          left = savedWidgetState.left;
          top = savedWidgetState.top;
          height = savedWidgetState.height;
          width = savedWidgetState.width;
        }
        else {
          top = 0;
          left = 0;
          width = (install.widgetWidth ? install.widgetWidth : 200);
          height = (install.widgetHeight ? install.widgetHeight : 120);
        }
        
        var widget = createWidget(install, top, left, height, width);
        widgetSpace.append(widget);
        
        widget.draggable({iframeFix: true, containment: widgetSpace, scroll: true, zIndex: 1000,
        
                          stop: function(event, ui) {
                            //store the new position in the dashboard meta-data
                            gDashboardState.widgetPositions[install.id] = {"left": ui.position.left - 8,  //these are subtracting the border
                                                                            "top": ui.position.top - 8,
                                                                            "width": (ui.helper.width() - 16),
                                                                            "height": (ui.helper.height() - 16) };
                            navigator.apps.mgmt.saveState(gDashboardState);
                          }
        
        
        });
                
        
        widget.resizable({handles: "se", containment: widgetSpace, alsoResize: widget.children("#clientFrame"), stop: function(event, ui) {
                            //store the new position in the dashboard meta-data
                            gDashboardState.widgetPositions[install.id] = {"left": ui.position.left - 8,  //these are subtracting the border
                                                                            "top": ui.position.top - 8,
                                                                            "width": (ui.helper.width() - 16),
                                                                            "height": (ui.helper.height() - 16) };
                            navigator.apps.mgmt.saveState(gDashboardState);
                            
                            //kludge code to replicate the iframeFix property of draggable.
                            $("div.ui-resizable-iframeFix").each(function( ) { this.parentNode.removeChild(this); }); 

                          },
                        
                        //kludge code to replicate the iframeFix property of draggable.
                       start: function(event, ui) {
                          $("iframe").each( function() {
                           $('<div class="ui-resizable-iframeFix" style="background: #fff;"></div>')
                           .css({
                            width: this.offsetWidth+"px", height: this.offsetHeight+"px",
                            position: "absolute", opacity: "0.001", zIndex: 1000
                           })
                           .css(jQuery(this).offset())
                           .appendTo("body");
                          });
                         }
                         
                        });
    
      }     
      
    } catch (e) {

      if (typeof console !== "undefined") console.log("Error while creating widget for app " + i + ": " + e);
    }
  }

}

function renderDock()
{
  if (!gApps) return;

  $('.appInDock').remove();

  for ( var i = 0; i < gDashboardState.appsInDock.length; i++ ) {
    try {
        var appID = gDashboardState.appsInDock[i];
        
        for ( var i = 0; i < gApps.length; i++ ) {
          var someApp = gApps[i];
          if (appID == someApp.id)
          {
            //add the icon to the dock, in big form.
            var dockIcon = createDockIcon(someApp);
            $("#dock").append(dockIcon);
            break;  //get out of loop, we are done
          }
        }
              
    } catch (e) {

      if (typeof console !== "undefined") console.log("Error while creating dock icon for app " + i + ": " + e);
    }
  }
}



function getBigIcon(minifest) {
  //see if the minifest has any icons, and if so, return the largest one
  if (minifest.icons) {
  //prefer 32
    if (minifest.icons["64"]) return minifest.icons["64"];
    
    var bigSize = 0;
    for (z in minifest.icons) {
      var size = parseInt(z, 10);
      if (size > bigSize) bigSize = size;
    }
    if (bigSize !== 0) return minifest.icons[bigSize];
  }
  return null;
}



function getSmallIcon(minifest) {
  //see if the minifest has any icons, and if so, return the largest one
  if (minifest.icons) {
  //prefer 32
    if (minifest.icons["32"]) return minifest.icons["32"];
    
    var smallSize = 1000;
    for (z in minifest.icons) {
      var size = parseInt(z, 10);
      if (size < smallSize) smallSize = size;
    }
    if (smallSize !== 1000) return minifest.icons[smallSize];
  }
  return null;
}


//other words for widget:
// sketch, recap, clipping, nutshell, aperture, channel, spout,
// beacon, buzz, meter, crux, ticker, ...

function createAppIcon(install)
{
  var appContainer = $("<div/>").addClass("app");
  appContainer.attr("id", install.id);
  
  var clickyIcon = $("<div/>").addClass("icon");
  var iconImg = getSmallIcon(install);
  if (iconImg) {
    var imgelem = $("<img/>"); 
    imgelem.attr({
      "src" : iconImg,
      "width": 32,
      "height": 32
    });
    
    clickyIcon.append(imgelem);
    clickyIcon.css({
         background: "#000000"
    });
  }
  appContainer.click(makeOpenAppTabFn(install, install.id));
  appContainer.append(clickyIcon);

  var appName = $("<div/>").addClass("glowy-blue-text");
  appName.css({
      "font-size": "18px",
      "line-height": "36px",
      "margin-left": "44px",
      "letter-spacing": "1px"
  });
  appName.text(install.name);  
  appContainer.append(appName);

  appContainer.draggable({revert : "invalid", 
                          zIndex: 1000,
                          helper : "clone", 
                          opacity: "0.5",
                          stop: function(event, ui) {
                          appContainer.addClass("ui-draggable-dragged");
                        } });
                        

  return appContainer;
}

function createDockIcon(install)
{
  var dockContainer = $("<div/>").addClass("appInDock");
  dockContainer.attr("id", install.id);
  
  var clickyIcon = $("<div/>").addClass("dockIcon");
  var iconImg = getBigIcon(install);
  if (iconImg) {
    var imgelem = $("<img/>"); 
    imgelem.attr({
      "src" : iconImg,
      "width": 64,
      "height": 64
    });
    
    clickyIcon.append(imgelem);
    clickyIcon.css({
         background: "#000000"
    });
  }
  dockContainer.click(makeOpenAppTabFn(install, install.id));
  dockContainer.append(clickyIcon);

  dockContainer.draggable({revert : "invalid", 
                          zIndex: 1000,
                          helper : "clone", 
                          opacity: "0.5",
                          stop: function(event, ui) {
                          dockContainer.addClass("ui-draggable-dragged");
                        } });
                        

  return dockContainer;
}


//create the optional iframe to hold the widget version of the app
function createWidget(install, top, left, height, width) {

    var widgetContainer = $("<div/>").addClass("widget glowy-blue-outline");
    widgetContainer.attr("id", install.id);
    
    widgetContainer.css({ "position" :"relative",
                          "top" : top + 8,
                          "left" : left + 8,
                          "width" : width + 16,
                          "height" : height + 16
                          });
    
    var clientFrame = $("<iframe/>");
    clientFrame.attr("src", install.widgetURL);
    clientFrame.attr("scrolling", "no");
    clientFrame.attr("id", "clientFrame");
    
    clientFrame.css({
      "position" : "relative",
      "margin-left" : 8,
      "margin-top" : 8,
      "width" : width,
      "height" : height,
      "border" : "0px white",
      "borderRadius" : "0.5em",
      "-moz-border-radius" : "0.5em",
      "-webkit-border-radius" : "0.5em",
      "background" : "white",
    });
        
    widgetContainer.append(clientFrame);
    
    return widgetContainer;
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
//   if (gApps) {
//     gDisplayMode = ROOT;
//     retrieveInstalledApps();
//     render();
//   }
}

function updateLoginStatus() {
  navigator.apps.mgmt.loginStatus(function (userInfo, loginInfo) {
    if (! userInfo) {
      $('#login-link a').attr('href', loginInfo.loginLink);
      $('#login-link').show();
    } else {
      $('#username').text(userInfo.email);
      $('#signed-in a').attr('href', loginInfo.logoutLink);
      $('#signed-in').show();
    }
  });
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




// function renderAppInfo(selectedBox)
// {
//     $( "#" + getInfoId ).remove();
// 
//     // Set up Info starting location
//     var info = document.createElement("div");
//     info.id = getInfoId;
//     info.className = getInfoId;
// 
//     var badge = elem("div", "appBadge");
//     var appIcon = elem("div", "icon");
// 
//     var icon = getSmallIcon(gSelectedInstall);
// 
//     if (icon) {
//         appIcon.setAttribute("style",
//                              "background:url(\"" + icon + "\") no-repeat; background-size:100%");
//     }
// 
//     $(appIcon).css("position", "absolute").css("top", -3).css("left", 9);
// 
//     var label = elem("div", "appBadgeName");
//     label.appendChild(document.createTextNode(gSelectedInstall.name));
// 
//     badge.appendChild(appIcon);
//     badge.appendChild(label);
//     info.appendChild(badge);
// 
// 
//     var off = $(selectedBox).offset();
//     $(info).css("postion", "absolute").css("top", off.top + -4).css("left", off.left + -8);
//     $(info).width(110).height(128).animate({
//         width: 300,
//         height: 320
//     }, 200, function() {
//         var data = elem("div", "appData");
//         function makeColumn(label, value) {
//             var boxDiv = elem("div", "appDataBox");
//             var labelDiv = elem("div", "appDataLabel");
//             var valueDiv = elem("div", "appDataValue");
//             labelDiv.appendChild(document.createTextNode(label));
//             if (typeof value == "string") {
//                 valueDiv.appendChild(document.createTextNode(value));
//             } else {
//                 valueDiv.appendChild(value);
//             }
//             boxDiv.appendChild(labelDiv);
//             boxDiv.appendChild(valueDiv);
//             return boxDiv;
//         }
//         var dev = elem("div", "developerName");
//         if (gSelectedInstall.developer) {
//           if (gSelectedInstall.developer.url) {
//             var a = elem("a");
//             a.setAttribute("href", gSelectedInstall.developer.url);
//             a.setAttribute("target", "_blank");
//             a.appendChild(document.createTextNode(gSelectedInstall.developer.name));
//             dev.appendChild(a);
//             data.appendChild(dev);
// 
//             var linkbox = elem("div", "developerLink");
//             a = elem("a");
//             a.setAttribute("href", gSelectedInstall.developer.url);
//             a.setAttribute("target", "_blank");
//             a.appendChild(document.createTextNode(gSelectedInstall.developer.url));
//             linkbox.appendChild(a);
//             data.appendChild(linkbox);
// 
//           } else {
//             if (gSelectedInstall.developer.name) {
//                 dev.appendChild(document.createTextNode(gSelectedInstall.developer.name));
//                 data.appendChild(dev);
//             } else {
//                 dev.appendChild(document.createTextNode("No developer info"));
//                 $(dev).addClass("devUnknown");
//                 data.appendChild(dev);
//             }
//           }
//         }
// 
//         info.appendChild(data);
// 
//         var desc = elem("div", "desc");
//         desc.appendChild(document.createTextNode(gSelectedInstall.description));
//         info.appendChild(desc);
// 
//         var props = elem("div", "appProperties");
// 
//         props.appendChild(makeColumn("Install Date", formatDate(gSelectedInstall.installTime)));
//         props.appendChild(makeColumn("Installed From", gSelectedInstall.installURL));
// 
//         info.appendChild(props);
// 
//         // finally, a delete link and action
//         $("<div/>").text("Delete this application.").addClass("deleteText").appendTo(info).click(function() {
//             navigator.apps.mgmt.remove(gSelectedInstall.id,
//                                         function() {
//                                                      retrieveInstalledApps();
//                                                   });
//             gSelectedInstall = null;
//             gDisplayMode = ROOT;
//             render();
// 
//             // let's now create a synthetic click to the document to cause the info dialog to get dismissed and
//             // cleaned up properly
//             $(document).click();
// 
//             return false;
//         });
// 
//         $(info).click(function() {return false;});
//     });
// 
//     $("body").append(info);
// 
//     // Dismiss box when user clicks anywhere else
//     setTimeout( function() { // Delay for Mozilla
//         $(document).click(function() {
//             $(document).unbind('click');
//             $(info).fadeOut(100, function() { $("#"+getInfoId).remove(); });
//             return false;
//         });
//     }, 0);
// }
