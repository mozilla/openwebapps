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
var gApps = {};

//the list filter string
// var gFilterString = "";

var gDashboardState = {};
gDashboardState.pages = [];

//prevent wiggling an app more than once
var gLastInstalledApp = "";


function saveDashboardState( callback ) {
  navigator.apps.mgmt.saveState(gDashboardState, callback);
}


//giant pain:  we have only one unique identifying piece of data per app, and it's a url.
// urls cannot be used for css/dom ids, as they contain disallowed characters.
// we must construct a 1-1 mapping unique string that only contains allowed characters.
// I have chose base32, in particular Crockford's version.  It is found in js/base32.js

function findInstallForOrigin32(origin32) {
  return gApps[Base32.decode(origin32)];
}


function getWindowHeight() {
  if(window.innerHeight) return window.innerHeight;
  if (document.body.clientHeight) return document.body.clientHeight;
}

function getWindowWidth() {
  if(window.innerWidth) return window.innerWidth;
  if (document.body.clientWidth) return document.body.clientWidth;
}






function getMinListHeight() {
  return  (keyCount(gApps) * 40) + 220 + 8; 
}

function keyCount(obj) {
  var n=0;
  for (var p in obj) 
      n += Object.prototype.hasOwnProperty.call(obj, p);
  return n;
}








//courtesy of:
// http://www.zachstronaut.com/posts/2009/02/17/animate-css-transforms-firefox-webkit.html
function getTransformProperty(element) {
    var properties = [
        'transform',
        'WebkitTransform',
        'MozTransform',
        'msTransform',
        'OTransform'
    ];
    var p;
    while (p = properties.shift()) {
        if (typeof element.style[p] != 'undefined') {
            return p;
        }
    }
    return false;
}


function paramValue( name )
{
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp( regexS );
  var results = regex.exec( window.location.href );
  if( results == null )
    return "";
  else
    return results[1];
}


function wiggleApp(origin32) {

  if (origin32 == gLastInstalledApp) return;

  //animate the app icon in the dock and/or the list, to indicate it has just been installed
  //use a combination of transition and window.timeout
  var dockIcons = $(".appInDock[origin32=" + origin32 + "]");
  var listIcon = $(".app[origin32=" + origin32 + "] > .appClickBox > .icon");
  if (!listIcon.length) return;
  
  var transformProp = getTransformProperty(listIcon[0]);

  var angles = [0, 5, 10, 5, 0, -5, -10, -5];
  var d = 0;
  var count = 0;
    
  var intervalID = setInterval(function () {
                                              d = (d + 1) % 9;
                                              dockIcons.each(function(i, e) {
                                                e.style[transformProp] = 'rotate(' + (angles[d]) + 'deg)';
                                              });
                                              if (listIcon.length) listIcon[0].style[transformProp] = 'rotate(' + (angles[d]) + 'deg)';
                                              
                                              count += d?0:1;
                                              if (count > 6) { 
                                                    clearInterval(intervalID); 
                                                    gLastInstalledApp = origin32;  
                                              };   

                                            }, 
                                            25 );
}


//************** document.ready()

$(document).ready(function() {



  // can this user use myapps?
   var w = window;
   if (w.JSON && w.postMessage) {
       try {
                updateDashboard();
                
            } catch (e) {
            
                 if (typeof console !== "undefined") console.log(e);
            }

   } else {
       $("#unsupportedBrowser").fadeIn(500);
   }
});


function checkSavedData(save) {
  //do a basic structure check on our saved data
  var emptyState = {};
  emptyState.appsInDock = [];
  emptyState.widgetPositions = {};

  if (save && (typeof save == 'object')) {
    if (save.appsInDock && $.isArray(save.appsInDock) && save.widgetPositions && (typeof save.widgetPositions == 'object')) return save;
  }
  return emptyState;
}



//this is the primary UI function.  It loads the latest app list from disk, the latest dashboard state from disk,
// and then proceeds to bring the visual depiction into synchrony with the data, with the least visual interruption.
function updateDashboard( completionCallback ) {
    //both the app list and dashboard data functions are asynchronous, so we need to do everything in the cal
      navigator.apps.mgmt.list( function (listOfInstalledApps) {
          
          gApps = listOfInstalledApps;

          //now, in the list callback, load the dashboard state
          navigator.apps.mgmt.loadState( function (dashState) {
              gDashboardState = checkSavedData(dashState);
              
              renderList();
  
//               var justInstalled = paramValue("emphasize");
//               if (justInstalled.length) {
//                 wiggleApp(Base32.encode(unescape(justInstalled)));
//               }
              //and call the dream within a dream within a dream callback.  if it exists.
              if (completionCallback) { completionCallback(); };
           });                      
      });
}



// launch the app into a tab.  we'd like it to just switch to it if it already exists. I think that needs to be handled in launch()
function makeOpenAppTabFn(origin32)
{
  try {
    return function(evt) {
//          if ($(this).hasClass("ui-draggable-dragged")) {
//              $(this).removeClass("ui-draggable-dragged");
//              return false;
//          }
        navigator.apps.mgmt.launch(Base32.decode(origin32));
    }
  } catch (e) {
      if (typeof console !== "undefined") console.log("error launching: " + e);
  }
}

//create the full app list, and sort them for display
// here is also where I cache the base32 version of the origin into the app
function renderList(andLaunch) {
  if (!gApps) return;
  //clear the list
  $('.app').remove();
  
  var results = [];
  
  for (origin in gApps) {
    try {
      
      //BASE32 ENCODE HERE ONLY
      if ( ! gApps[origin].origin32) { gApps[origin].origin32 = Base32.encode(origin); };
         results.push(gApps[origin]);
    } catch (e) {
      if (typeof console !== "undefined") console.log("Error while creating list icon for app " + origin + ": " + e);
    }
  }
  
  results.sort(function(a,b) {return (a.manifest.name > b.manifest.name) });
  
  for ( var i = 0; i < results.length; i++ ) {
    try {
        $(".applist").append(createAppListItem(results[i]));
    } catch (e) {
      if (typeof console !== "undefined") console.log("Error while inserting list icon for app " + results[i].origin + ": " + e);
    }
  }
  if (results.length == 1 && andLaunch)
  {
    navigator.apps.mgmt.launch(results[0].origin);
  }
}







function getBigIcon(manifest) {
  //see if the manifest has any icons, and if so, return a 64px one if possible
  if (manifest.icons) {
  //prefer 64
    if (manifest.icons["64"]) return manifest.icons["64"];
    
    var bigSize = 0;
    for (z in manifest.icons) {
      var size = parseInt(z, 10);
      if (size > bigSize) bigSize = size;
    }
    if (bigSize !== 0) return manifest.icons[bigSize];
  }
  return null;
}



function getSmallIcon(manifest) {
  //see if the manifest has any icons, and if so, return a 32px one if possible
  if (manifest.icons) {
  //prefer 32
    if (manifest.icons["32"]) return manifest.icons["32"];
    
    var smallSize = 1000;
    for (z in manifest.icons) {
      var size = parseInt(z, 10);
      if (size < smallSize) smallSize = size;
    }
    if (smallSize !== 1000) return manifest.icons[smallSize];
  }
  return null;
}


// function showAppInfo(origin32) {
//   //gray out the screen, put up a modal dialog with the application info.
//   //  items in the dialog:
//   //  * app info, with links to origin, etc.
//   //  * delete button
//   //  * widget enable button
//   //  * thingie to dismiss the dialog
//   
//   $("#appinfo").append(createAppInfoPane(origin32));
//   revealModal("modalPage");
// }

function createAppListItem(install)
{
  var appContainer = $("<div/>").addClass("app dockItem");
  appContainer.attr("origin32", install.origin32);

  var displayBox = $("<div/>").addClass("appClickBox");
  appContainer.append(displayBox);

  var clickyIcon = $("<div/>").addClass("icon");
  var iconImg = getBigIcon(install.manifest);
  
  if (iconImg.indexOf('/') === 0) {
    clickyIcon.append($('<img width="64" height="64"/>').attr('src', install.origin + iconImg));  
  } else {
    clickyIcon.append($('<img width="64" height="64"/>').attr('src', iconImg));  
  }
  
//   clickyIcon.mouseenter(function() {clickyIcon.addClass("glowy-blue-frame") });
//   clickyIcon.mouseleave(function() {clickyIcon.removeClass("glowy-blue-frame") });

  clickyIcon.click(makeOpenAppTabFn(install.origin32));

  displayBox.append(clickyIcon);


  //TODO: size text to fit
  var appName = $("<div/>").addClass("listLabel");
  appName.text(install.manifest.name);  
  appName.disableSelection();

  displayBox.append(appName);
  
//   appContainer.draggable({revert : "invalid", 
//                           cursorAt: {top: 32, left: 32},
//                           zIndex: 1000,
//                           helper : function() {return createDockItem(install.origin32)}, 
//                           opacity: "0.5",
//                           stop: function(event, ui) {
//                             appContainer.addClass("ui-draggable-dragged");
//                           },
//                           
//                           drag: function(event) { 
//                                                   displayPlaceholder(event); 
//                                                 }
// 
//                           });
                        

  return appContainer;
}




/////////////// screen paging code for dsahboard

// this is simply a shortcut for the eyes and fingers
var _startX = 0;			// mouse starting positions
var _offsetX = 0;			// current element offset
var _dragElement;			// needs to be passed from OnMouseDown to OnMouseMove

var numPages = 0;
var pageWidth = 0;
var wasDragged = false;

var dragstart = 0;

function InitPaging(count, width)
{
  numPages = count;
  pageWidth = width;
	document.onmousedown = OnMouseDown;
	document.onmouseup = OnMouseUp;
	document.MozTouchDown = OnMouseDown;
	document.MozTouchUp = OnMouseUp;
}

function OnMouseDown(e)
{	
  console.log("target class: " + e.target.className + "   target id: " + e.target.id);
  
  dragStart = e.timeStamp;
  
  //might not need this
	_dragElement = $("#dashboard");
	
	if (e.button == 0)
	{
		// grab the mouse position
		_startX = e.clientX;
		
		// grab the clicked element's position
		_offsetX = ExtractNumber(_dragElement.offset().left);
		
		// tell our code to start moving the element with the mouse
		document.onmousemove = OnMouseMove;
		document.MozTouchMove = OnMouseMove
	
		return false;
	}
}

function ExtractNumber(value)
{
	var n = parseInt(value);
	
	return n == null || isNaN(n) ? 0 : n;
}

function OnMouseMove(e)
{
	// this is the actual "drag code"
	var newPos = (_offsetX + e.clientX - _startX) + 'px';
	_dragElement.css("left", newPos);

  wasDragged = true;
}


function OnMouseUp(e)
{
  var quick = (e.timeStamp - dragStart < 150);
  var small = Math.abs(e.clientX - _startX) < 20;
  
  var flick = quick && !small;
  var tap = quick && small;
  var drag = !quick && !small;
    
	if (_dragElement != null)
	{
	  if (tap) {
	        console.log("was tapped");
          
	  
    } else if (flick) {
      //we go to the next page in the direction specified by the flick
      console.log("was flicked");

      //left or right?
      var dir = (e.clientX - _startX) > 0;
      
      var newPos = _offsetX;
      if (dir) {
        newPos += pageWidth; 
        if (newPos > 0) newPos = 0;
      } else {
        newPos -= pageWidth;
        if (newPos < ((numPages - 1) * pageWidth * -1)) newPos = ((numPages - 1) * pageWidth * -1);
      }
          
      _dragElement.animate({left: newPos}, 250);

    } else { //drag, which may or may not go to the next page
      console.log("was dragged");

      var snapPage = 0;
      
      if (_dragElement.position().left < 0) {
          var offset = Math.abs(_dragElement.position().left);
          var snapPage = Math.floor(offset / pageWidth);
          var remainder = offset - (snapPage * pageWidth);
          
          if ( remainder > Math.floor(pageWidth / 2) ) {
            snapPage++;
          }
          
      }
      
      if (snapPage >= numPages) snapPage = numPages - 1;
      
      _dragElement.animate({left: (snapPage * pageWidth * -1) }, 250);
    }
    
		// reset
		document.onmousemove = null;
		document.MozTouchMove = null;

		_dragElement = null;
		wasDragged = false;
		dragStart = 0;
	}
}

//hard coded temporarily
InitPaging(5, 1280);

////////////////

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
//  updateDashboard( ) ;
//   $("#filter").focus();
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


// function createAppInfoPane(origin32) {
//       var infoBox = $("<div/>").addClass("appinfobox");
//       var install = findInstallForOrigin32(origin32);
// 
//       var appIcon = $('<div width="64" height="64"/>').addClass("dockIcon");
//       var iconImg = getBigIcon(install.manifest);        
//       appIcon.append($('<img width="64" height="64"/>').attr('src', install.origin + iconImg));
//       infoBox.append(appIcon);
//       
//       
//       var labelBox = $("<div class='labelBox glowy-blue-text'/>");
//       
//       var appName = $("<div/>").addClass("infoLabel ");
//       appName.text(install.manifest.name);  
//       appName.disableSelection();
//       labelBox.append(appName);
// 
//       if (install.manifest.developer && install.manifest.developer.name) {
//         var devName = $("<div/>").addClass("infoLabelSmall");
//         devName.text(install.manifest.developer.name);  
//         devName.disableSelection();
//         labelBox.append(devName);
//       }
//       
//       if (install.manifest.developer && install.manifest.developer.url) {
//         var devLink = $("<a/>").addClass("infoLabelSmall glowy-blue-text");
//         devLink.attr("href", install.manifest.developer.url);
//         devLink.attr("target" , "_blank");
//         devLink.text(install.manifest.developer.url);
//         labelBox.append(devLink);
//       }
//       infoBox.append(labelBox);
// 
//       var descBox = $("<div/>").addClass("descriptionBox glowy-blue-text");
//       descBox.text(install.manifest.description);
//       infoBox.append(descBox);
// 
//       var delButton = $("<div/>").addClass("deleteAppButton glowy-red-text");
//       delButton.text("DELETE");
//       delButton.disableSelection();
//       delButton.mouseenter(function() {delButton.animate({ "font-size": 20 + "px", "padding-top": "6px", "padding-bottom": "2px"}, 50) });
//       delButton.mouseleave(function() {delButton.text("DELETE"); delButton.animate({ "font-size": 14 + "px", "padding-top": "8px", "padding-bottom":"0px"}, 50) });
// 
// 
//       //this really needs to be moved out into a function
//       delButton.click( function() { if (delButton.text() == "DELETE") {
//                                           delButton.text("DELETE ?");
//                                         } else {
//       
//                                           navigator.apps.mgmt.uninstall( install.origin, function() { 
//                                                                                             removeAppFromDock(install.origin32);
//                                                                                             removeWidget(install.origin32);
//                                                                                             saveDashboardState( function () {updateDashboard();} );
//                                                                                             hideModal('modalPage')
//                                                                                         }  
//                                                                         ) }});
//       infoBox.append(delButton);
//       
//       if (install.manifest.widget) {
//         var widgetButton = $("<div/>").addClass("widgetToggleButton glowy-red-text");
//         widgetButton.text("WIDGET");
//         widgetButton.disableSelection();
//         if (isWidgetVisible(origin32)) {
//           widgetButton.addClass("glowy-green-text");
//         }
//         widgetButton.click( function() { if (toggleWidgetVisibility(install.origin32)) {
//                                             widgetButton.addClass("glowy-green-text");
//                                           } else {
//                                             widgetButton.removeClass("glowy-green-text");
//                                           }; 
//                                          });
//                                          
//         widgetButton.mouseenter(function() {widgetButton.animate({ "font-size": 20 + "px", "padding-top": "6px", "padding-bottom": "2px"}, 50) });
//         widgetButton.mouseleave(function() {widgetButton.animate({ "font-size": 14 + "px", "padding-top": "8px", "padding-bottom": "0px"}, 50) });
//         infoBox.append(widgetButton);
//       }
// 
//       return infoBox;
// }


