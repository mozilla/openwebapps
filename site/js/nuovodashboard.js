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

var gDashboardState = {};
gDashboardState.appsInDock = [];
gDashboardState.widgetPositions = {};

var minAppListHeight = 0;
var minAppListWidth = 0;

var getInfoId = "getInfo";

var gOverDock = false;

function saveDashboardState( callback ) {
  navigator.apps.mgmt.saveState(gDashboardState, callback);
}


//giant pain:  we have only one unique identifying piece of data per app, and it's a url.
// urls cannot be used for css/dom ids, as they contain disallowed characters.
// we must construct a 1-1 mapping unique string that only contains allowed characters.
// I have chose base32, in particular Crockford's version.  It is found in js/base32.js

function findInstallForID(appID32) {
  for ( var i = 0; i < gApps.length; i++ ) {
    if (gApps[i].id == decode(appID32)) return gApps[i];
  }
  return null;
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

function computeSlot(event) {
      //determine what slot they are over
      var appCount =  $("#dock").children().length;
      var newAppSlot = Math.floor((event.pageX - 20) / 80);
      if (newAppSlot > (appCount -1)) { newAppSlot = appCount; }
      return newAppSlot;
}
  
function displayPlaceholder(event) {
        if (!gOverDock) { return; };
        removePlaceholder();
        var slot = computeSlot(event);
        //insert a placeholder
        var apps = $("#dock").children();

        //shortcut
        if (slot >= apps.length) {
          $("#dock").append($("<div/>").addClass("appInDockDrop glowy-blue-outline"));
          return;
        }

        for (var i=0; i<apps.length; i++)
        {
          var currApp = apps[i];
          $(currApp).detach();
          if (i == slot) { $("#dock").append($("<div/>").addClass("appInDockDrop glowy-blue-outline")) };
          if ($(apps[i]).hasClass("appInDock")) { $("#dock").append(apps[i]) };
        }
}

function removePlaceholder( ) {
    $("#dock > .appInDockDrop").remove();
}



function dragOver(event, ui) { gOverDock = true; };


function dragOut(event, ui) { gOverDock = false;
                              removePlaceholder();
                              };



function insertAppInDock(newApp, event) {
    var newAppSlot = computeSlot(event);
    gDashboardState.appsInDock.splice(newAppSlot, 0, newApp.attr("id"));
    saveDashboardState();
    updateDock();
};


//called when an app is deleted, so we don't build up cruft in the dock list
function removeAppFromDock(deadAppID32) {
    var newDockList = [];
    var curApp;
    for ( var i = 0; i < gDashboardState.appsInDock.length; i++ ) {
          curApp = gDashboardState.appsInDock[i];
          
          //clean out this app, and also any other cruft we find
          if ( (deadAppID32 != curApp)  && ( findInstallForID(curApp)  ) ) {
             newDockList.push[curApp];          
           };
    };
    gDashboardState.appsInDock = newDockList;
};


function buttonHot() {
  $(this).addClass("hot");
};

function buttonCold() {
  $(this).removeClass("hot");
};

function infoHot() {
  $(this).addClass("infohot");
}

function infoCold() {
  $(this).removeClass("infohot");
}

//************** document.ready()

$(document).ready(function() {
    //temporarily set the repository origin to localhost
    navigator.apps.setRepoOrigin("..");

    $("#dock").droppable({ accept: ".dockItem", over: dragOver, out: dragOut,  
                        drop: function(event, ui) {
                          gOverDock = false;
                          removePlaceholder();
                          var newAppInDock = createDockItem(ui.draggable.context.id);
                          insertAppInDock(newAppInDock, event);
                        }
                   });
 
 
  $("#clearButton").click( function() { gFilterString = ""; $("#filter").attr("value", gFilterString); renderList(); });
  $("#clearButton").mouseenter(buttonHot).mouseleave(buttonCold);
  
  // can this user use myapps?
   var w = window;
   if (w.JSON && w.postMessage) {
       try {
                gFilterString = $("#filter").val().toLowerCase();
                updateDashboard();
                
            } catch (e) {
            
                 if (typeof console !== "undefined") console.log(e);
            }

   } else {
       $("#unsupportedBrowser").fadeIn(500);
   }
});



//this is the primary UI function.  It loads the latest app list from disk, the latest dashboard state from disk,
// and then proceeds to bring the visual depiction into synchrony with the data, with the least visual interruption.
function updateDashboard( completionCallback ) {
    //both the app list and dashboard data functions are asynchronous, so we need to do everything in the cal
      navigator.apps.mgmt.list( function (listOfInstalledApps) {
          gApps = listOfInstalledApps;
          gApps.sort( function(a,b) { return (a.name > b.name);  });

          //now, in the callback, load the dashboard state
          navigator.apps.mgmt.loadState( function (dashState) {
              if (dashState)  gDashboardState = dashState;
              
              //now, in the callback, update everything.
              //I'm rebuilding the entire app list and dock list for now, since it is likely not the bottleneck. they can be updated later, if they become a performance problem
              // I -am- carefully adding/removing widgets only where necessary, as it is quite expensive, since they contain iframes.
              renderList();
              updateDock();
              updateWidgets();
  
              if (completionCallback) { completionCallback(); };
           });                      
      });
}



// Creates an opener for an app tab.  The usual behavior
// applies - if the app is already running, we switch to it.
// If the app is not running, we create a new app tab and
// launch the app into it.
function makeOpenAppTabFn(id32)
{
    return function(evt) {
         if ($(this).hasClass("ui-draggable-dragged")) {
             $(this).removeClass("ui-draggable-dragged");
             return false;
         }

        navigator.apps.mgmt.launch(decode(id32));
    }
}

//here is where I cache the base32 version of the app id into the app
function renderList() {
  if (!gApps) return;
  var appList = $("#list");
  $('.app').remove();
  
  for ( var i = 0; i < gApps.length; i++ ) {
    try {
      var install = gApps[i];
      
      //BASE32 ENCODE HERE ONLY
      if ( ! install.id32) { install.id32 = encode(install.id); };
      
      if (gFilterString.length == 0 || gFilterString == install.name.substr(0,gFilterString.length).toLowerCase() ) {
        var icon = createAppListItem(install);
        //check for no icon here, and supply a default one
        appList.append(icon);
      }
    } catch (e) {
      if (typeof console !== "undefined") console.log("Error while creating list icon for app " + i + ": " + e);
    }
  }
}



//reloading the widgets is very expensive, so we only want to fix up the widgets, not reload them all, if we can possibly help it.
function updateWidgets( )  {
      
        //if we have no apps, bail out
        if (!gApps) return;

        var widgetSpace = $("#widgets");
        
        //first, walk the list of apps, adding/removing any widgets that should be displayed, but aren't currently (enabled button was toggled, app was added, etc.)
        gApps.forEach(function(install) {
            try {
              //does the app specify a widget?  if so, check to see if we already have one
              if (install.widgetURL) {      
                  var existingWidget = widgetSpace.children( "#" + install.id32 );
                  
                  if (existingWidget[0]) {
                      //if we already have a widget, but its enabled flag is set to 'NO', then delete it, and continue to next install
                      if (gDashboardState.widgetPositions[install.id32].disabled) {
                        $(" #widgets > #" + install.id32).remove();
                      }
                  } else {
                      //if we don't have a widget, and its enable flag is set to 'YES' (or no dashboard state), then create it, create the dashboard state for it, and continue to next install
                      
                      
                      //if it has no dashboard state, give it a default one
                        if (!gDashboardState.widgetPositions[install.id32])  {
                            //make a new one, and put it in the save state.  NOTE: we add some padding for the frame, but only when we create and save
                            // the widget the first time.  from then on, we use the outer frame as the thing to measure the size of
                            gDashboardState.widgetPositions[install.id32] = {"top": 0,
                                                                            "left": 0, 
                                                                            "height": ((install.widgetHeight ? install.widgetHeight : 120) + 16),
                                                                            "width": ((install.widgetWidth ? install.widgetWidth : 200) + 16),
                                                                            "zIndex" : 0
                                                                             };
                            //save state, since we added something
                            saveDashboardState();
                      }
                      
                      if (gDashboardState.widgetPositions[install.id32].disabled) { return; }


                      //NOTE: this takes the size of the outer widget frame, so pad it the first time if you want some specific content size
                       var widgetPos = gDashboardState.widgetPositions[install.id32];
                       var widget = createWidget(install, widgetPos.top, widgetPos.left, widgetPos.height, widgetPos.width, widgetPos.zIndex);  
                       widgetSpace.append(widget);

                  }

              }
          } catch (e) {
              if (typeof console !== "undefined") console.log("Error while creating widget for app : " + e);
          }
        });
          
      //then, walk the list of widgets, and remove any that belong to apps that have been deleted
      
      $("#widgets > .widgetFrame").each( function() {
          var app = findInstallForID(this.id);

          if (!app) {
              //delete the widget
              $(" #widgets > #" + this.id).remove();
          } else {
              //update the widget position
              var wPos = gDashboardState.widgetPositions[this.id];
               $(this).css({"zIndex": wPos.zIndex});
               $(this).animate( {"top": wPos.top + "px",
                          "left": wPos.left + "px", 
                          "height": wPos.height + 16 + "px", 
                          "width": wPos.width + 16 + "px"
                          } );
                          
              var selectorString = "#" + this.id + "client, #" + this.id + "hider";
              $(this).children(selectorString).animate({"height": wPos.height, "width": wPos.width});
          };
      
      });
      
}




function updateDock()
{
  if (!gApps) return;

  $('.appInDock').remove();
  var newDockList = [];
  
  for ( var i = 0; i < gDashboardState.appsInDock.length; i++ ) {
    try {
        var id32 = gDashboardState.appsInDock[i];
        var dockItem = createDockItem(id32);
        
        if ( ! dockItem ) { 
            //cruft left in array.  should have been cleaned up
            if (typeof console !== "undefined") console.log("no app found for dock id32:  " + id32);
            continue; 
        };
        
        $("#dock").append(dockItem);
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

function showAppInfo(appID32) {
  //gray out the screen, put up a modal dialog with the application info.
  //  items in the dialog:
  //  * app info, with links to origin, etc.
  //  * delete button
  //  * widget enable button
  //  * thingie to dismiss the dialog
  
  $("#appinfo").append(createAppInfoPane(appID32));
  revealModal("modalPage");
}

function createAppListItem(install)
{
  var appContainer = $("<div/>").addClass("app dockItem");
  appContainer.attr("id", install.id32);
  
  //the info button
  var infoButton = $("<img/>").addClass("glowButton");
  infoButton.attr("src", "img/appinfo.png");
  infoButton.attr("id", install.id32);
  appContainer.append(infoButton);
  
  infoButton.click( function() {showAppInfo(install.id32); });
  infoButton.mouseenter(infoHot).mouseleave(infoCold);


  var clickyIcon = $("<div/>").addClass("icon");
  var iconImg = getSmallIcon(install);


//this clips properly in  FF 3.6 , but not in 4
    clickyIcon.css({
    "background-image": "url(\"" + iconImg + "\")",
    "-moz-background-size": 32
    });

//   appContainer.click(makeOpenAppTabFn(install.id));
  appContainer.append(clickyIcon);

  var appName = $("<div/>").addClass("listLabel glowy-blue-text");
  appName.text(install.name);  
  appName.disableSelection();
  
  appName.click(makeOpenAppTabFn(install.id32));

  appContainer.append(appName);

  
  appContainer.draggable({revert : "invalid", 
                          zIndex: 1000,
                          helper : "clone", 
                          opacity: "0.5",
                          stop: function(event, ui) {
                            appContainer.addClass("ui-draggable-dragged");
                          },
                          
                          drag: function(event) { 
                                                  displayPlaceholder(event); 
                                                }

                          });
                        

  return appContainer;
}


function createDockItem(appID32, existingDiv)  //if you pass in an existing div, it will fill it instead of making a new one
{
  var installRecord = findInstallForID(appID32);
  if (!installRecord) return null;
  
  var dockContainer = existingDiv ? existingDiv : $("<div/>");
  dockContainer.removeClass("app");
  dockContainer.removeClass("ui-draggable");
  dockContainer.addClass("appInDock dockItem");
  dockContainer.attr("id", appID32);
  
  var clickyIcon = $("<div/>").addClass("dockIcon");
  var iconImg = getBigIcon(installRecord);
  
//this clips the image properly in FF 3.6, but not in 4
  clickyIcon.css({
    "background-image": "url(\"" + iconImg + "\")",
    "-moz-background-size": 64
    });

  dockContainer.click(makeOpenAppTabFn(appID32));
  dockContainer.append(clickyIcon);
  
  dockContainer.draggable({ 
                          zIndex: 1000,
                          helper : "clone", 
                          opacity: "0.5",
                          start: function(event, ui) { 
                                var which = computeSlot(event);
                                gDashboardState.appsInDock.splice(which, 1);
                                $(this).detach();
                          },
                          
                          stop: function(event, ui) {
                              saveDashboardState();
                              dockContainer.addClass("ui-draggable-dragged");
                          },
                          
                          drag: function(event) { 
                                                  displayPlaceholder(event); 
                                                }

                          });

  return dockContainer;
}

function restackWidgets(widget) {
        var highest = 0;
        $.each( gDashboardState.widgetPositions, function(n, v) {
          highest = Math.max(highest, v.zIndex);
          });
          
          $(widget).css({"zIndex" : highest+1});
           gDashboardState.widgetPositions[widget.id].zIndex = highest+1;
}



//create the optional iframe to hold the widget version of the app
function createWidget(install, top, left, height, width, zIndex) {

    var widgetSpace = $("#widgets");
    
    var widgetFrame = $("<div/>").addClass("widgetFrame glowy-blue-outline");
    widgetFrame.attr("id", install.id32);
            
    widgetFrame.css({"top" : top + "px",
                          "left" : left + "px",
                          "width" : (width + 16) + "px",
                          "height" : (height + 16) + "px",
                          "zIndex" : zIndex
                          });
                          
    widgetFrame.click( function() {
        restackWidgets(this);
       saveDashboardState();
    });
                          
    //this is a transparent overlay we move to the top of the widget when dragging or resizing, otherwise the iframe starts grabbing the events,
    // and it gets very laggy and broken
    var hider = $("<div id=\"" + install.id32 + "hider\" />").addClass("framehider").css({
                          "top" : "8px",
                          "left":"8px",
                          "width" : (width) + "px",
                          "height" : (height) + "px",
                          "zIndex" : "-1000",
                          "position" : "absolute",
                          });
    widgetFrame.append(hider);
    
    var clientFrame = $("<iframe id=\"" + install.id32 + "client\" />").addClass("clientframe");

    clientFrame.attr("src", install.widgetURL);
    clientFrame.attr("scrolling", "no");
    
    clientFrame.css({
      "width" : width + "px",
      "height" : height + "px",
    }); 
  
    widgetFrame.append(clientFrame);
    

//     var resizeHandle = $("<img/>");
//     resizeHandle.attr("src", "img/drag.png");
//     resizeHandle.attr("id", install.id32 + "resize");
//     resizeHandle.css({"position" : "absolute", "left": (width + 4) + "px", "top" : (height + 4) + "px"});
//   
//     widgetFrame.append(resizeHandle);

    
    widgetFrame.draggable({containment: widgetSpace,  zIndex: 1000, stack : ".widgetFrame", 
              //kludge code to replicate the iframeFix property of draggable, which keeps the iframe from stealing events
                 start: function(event, ui) {
                        $(".framehider").css({"zIndex" : 1000});
                   },

                stop: function(event, ui) {
                    //store the new position in the dashboard meta-data
                    gDashboardState.widgetPositions[install.id32] = {"top": ui.helper.position().top,  "left": ui.helper.position().left,  "height": ui.helper.height() -16, "width": ui.helper.width() -16, "zIndex" : ui.helper.zIndex() };
                    $(".framehider").css({"zIndex" : -1000});
                    saveDashboardState();
                  }
          });
                  
     var selectorString = "#" + install.id32 + "client, #" + install.id32 + "hider";
     widgetFrame.resizable({containment: widgetSpace, handles:'se', alsoResize: selectorString, minHeight:  64, minWidth: 64, maxHeight: 400, maxWidth: 400,
     
                stop: function(event, ui) {
                      //store the new position in the dashboard meta-data
                      gDashboardState.widgetPositions[install.id32] = {"left": ui.helper.position().left, "top": ui.helper.position().top, "height": ui.helper.height() -16 , "width": ui.helper.width() -16, "zIndex" : ui.helper.zIndex() };
                      saveDashboardState();
                      
                      $(".framehider").css({"zIndex" : -1000});
                    },
                  
                  //kludge code to replicate the iframeFix property of draggable, which keeps the iframe from stealing events
                     start: function(event, ui) {
                            restackWidgets(this);
                            saveDashboardState();
                            $(".framehider").css({"zIndex" : 1000});
                       }
                   
                  });

      //resizable changes it to position:relative, so we override it again, or our coordinates are all screwed up
      widgetFrame.css("position", "absolute");

    return widgetFrame;
}

function removeWidget(id32) {
      //remove the widget and position info for this dead app, and any other cruft we find
      delete gDashboardState.widgetPositions[id32];
      $(" #widgets > #" + id32).remove();
};


function toggleWidgetVisibility(id32) {
  if (gDashboardState.widgetPositions[id32].disabled) {
    delete gDashboardState.widgetPositions[id32].disabled;
  } else {
    gDashboardState.widgetPositions[id32].disabled = "YES";
  }
  saveDashboardState();
};

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
  updateDashboard( ) ;
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


///////////////////////////////////////////////
//modal dialog handling code below here

function revealModal(divID)
{
    window.onscroll = function () { document.getElementById(divID).style.top = document.body.scrollTop; };
    document.getElementById(divID).style.display = "block";
    document.getElementById(divID).style.top = document.body.scrollTop;
}

function hideModal(divID)
{
    $("#appinfo").empty();
    document.getElementById(divID).style.display = "none";
}


function createAppInfoPane(appID32) {
      var infoBox = $("<div/>").addClass("appinfobox");
      var install = findInstallForID(appID32);

      var appIcon = $("<div/>").addClass("dockIcon");
      var iconImg = getBigIcon(install);
      
    //this clips the image properly in FF 3.6, but not in 4
      appIcon.css({
        "background-image": "url(\"" + iconImg + "\")",
        "-moz-background-size": 64,
        "float" : "left"
        });
      infoBox.append(appIcon);
      
      
      var labelBox = $("<div class='labelBox glowy-blue-text'/>");
      
      var appName = $("<div/>").addClass("infoLabel ");
      appName.text(install.name);  
      appName.disableSelection();
      labelBox.append(appName);

      if (install.developer && install.developer.name) {
        var devName = $("<div/>").addClass("infoLabelSmall");
        devName.text(install.developer.name);  
        devName.disableSelection();
        labelBox.append(devName);
      }
      
      if (install.developer && install.developer.url) {
        var devLink = $("<a/>").addClass("infoLabelSmall glowy-blue-text");
        devLink.attr("href", install.developer.url);
        devLink.attr("target" , "_blank");
        devLink.text(install.developer.url);
        labelBox.append(devLink);
      }
      infoBox.append(labelBox);

      var descBox = $("<div/>").addClass("descriptionBox glowy-blue-text");
      descBox.text(install.description);
      infoBox.append(descBox);

      var delButton = $("<div/>").addClass("deleteAppButton glowy-red-text");
      delButton.text("DELETE");
      //this really needs to be moved out into a function
      delButton.click( function() {  navigator.apps.mgmt.remove( install.id,  function() { removeAppFromDock(install.id32);
                                                                                          removeWidget(install.id32);
                                                                                          saveDashboardState( function () {updateDashboard();} );
                                                                                          hideModal('modalPage')}  )  });
      infoBox.append(delButton);
      
      var widgetButton = $("<div/>").addClass("widgetToggleButton glowy-red-text");
      widgetButton.text("WIDGET");
      widgetButton.click( function() { toggleWidgetVisibility(install.id32); updateWidgets(); });
      infoBox.append(widgetButton);

      return infoBox;
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





//this doesn't clip properly in either FF 3.6 or FF 4
//   if (iconImg) {
//     var imgelem = $("<img/>"); 
//     imgelem.attr({
//       "src" : iconImg,
//       "width": 64,
//       "height": 64
//     });
//     
//     clickyIcon.append(imgelem);
//   }
  
