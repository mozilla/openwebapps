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

//the saved state (app icon arrangement, mostly) for the dashboard
var gDashboardState = {};
//pages is a list of the known pages.  each page contains an array of apps refs.
gDashboardState.pages = [];


function getWindowHeight() {
  if(window.innerHeight) return window.innerHeight;
  if (document.body.clientHeight) return document.body.clientHeight;
}

function getWindowWidth() {
  if(window.innerWidth) return window.innerWidth;
  if (document.body.clientWidth) return document.body.clientWidth;
}



/////////////////////////////////////////////////////////
//important page layout global vars
var screenWidth = 0;
var screenHeight = 0;
var pageWidth = 0;
var appBoxWidth = 0;
var appBoxHeight = 0;
var appIconSize = 0;
var appNameSize = 0;


//I'm assuming 4 x 5 or 5 x 4 apps per page
function computeLayoutVars() {
  screenWidth = getWindowWidth();
  pageWidth = screenWidth-4;
  screenHeight = getWindowHeight();
  
  if (screenWidth > screenHeight)  {
    appBoxWidth = Math.floor(pageWidth / 5);
    appBoxHeight = Math.floor(screenHeight / 4);
  } else {
    appBoxWidth = Math.floor(pageWidth / 4);
    appBoxHeight = Math.floor(screenHeight / 5);
  }
  
  appIconSize = Math.floor(Math.min(appBoxWidth, appBoxHeight) / 2);
  appNameSize = Math.floor(appIconSize * 1.5);
  
  console.log("screenWidth: " + screenWidth);
  console.log("screenHeight: " + screenHeight);
  console.log("pageWidth: " + pageWidth);
  console.log("appBoxWidth: " + appBoxWidth);
  console.log("appBoxHeight: " + appBoxHeight);
  console.log("appIconSize: " + appIconSize);
  console.log("appNameSize: " + appNameSize);

}

//************** document.ready()

$(document).ready(function() {



  // can this user use myapps?
   var w = window;
   if (w.JSON && w.postMessage) {
     try  {
            updateDashboard();
          } catch (e) {
            if (typeof console !== "undefined") console.log(e);
          }
          
   } else {
      if (typeof console !== "undefined") console.log("unsuported browser!");
   }
});




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




function keyCount(obj) {
  var n=0;
  for (var p in obj) 
      n += Object.prototype.hasOwnProperty.call(obj, p);
  return n;
}



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
    //both the app list and dashboard data functions are asynchronous, so we need to do everything in the callback
      computeLayoutVars();
      $(".background").css({width: screenWidth, height: screenHeight});
      $(".dashboard").css({width: (5 * screenWidth) });
      $(".page").css({width: pageWidth, height: screenHeight});
      
      navigator.apps.mgmt.list( function (listOfInstalledApps) {
          
          gApps = listOfInstalledApps;

          //now, in the list callback, load the dashboard state
          navigator.apps.mgmt.loadState( function (dashState) {
              gDashboardState = checkSavedData(dashState);
              
              renderList();
  
              //and call the dream within a dream within a dream callback.  if it exists.
              if (completionCallback) { completionCallback(); };
           });                      
      });
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
  //see if the manifest has any icons, and if so, return a 96px one if possible
  if (manifest.icons) {
  //prefer 96
    if (manifest.icons["96"]) return manifest.icons["96"];
    
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


function createAppListItem(install)
{

  var appDisplayFrame = $("<div/>").addClass("appDisplayFrame");
  appDisplayFrame.css({width: appBoxWidth, height: appBoxHeight});
  
  var clickyIcon = $("<div/>").addClass("icon");
  clickyIcon.attr("origin32", install.origin32);

  clickyIcon.css({width: appIconSize, 
                  height: appIconSize, 
                  marginTop: ((appBoxHeight - appIconSize)/2) + "px", 
                  marginBottom: ((appBoxHeight - appIconSize)/5) + "px",
                  marginLeft: ((appBoxWidth - appIconSize)/2) + "px",
                  marginRight: ((appBoxWidth - appIconSize)/2) + "px", 
                  
                  "-moz-border-radius": (appIconSize/6) + "px",
	                "-webkit-border-radius": (appIconSize/6) + "px",
	                "border-radius": (appIconSize/6) + "px"

                  });

  var iconImg = getBigIcon(install.manifest);
  
  var appIcon = $("<img width='" + appIconSize + "' height='" + appIconSize + "'/>");
  
  if (iconImg.indexOf('/') === 0) {
    appIcon.attr('src', install.origin + iconImg);  
  } else {
    appIcon.attr('src', iconImg);  
  }
  
  clickyIcon.append(appIcon);

  appDisplayFrame.append(clickyIcon);


  //TODO: size text to fit
  var appName = $("<div/>").addClass("listLabel");
  appName.css({width: appIconSize * 1.4, 
              "font-size":  Math.max(Math.ceil(appIconSize/5.5), 10),
              color: '#ffffff'});

  appName.text(install.manifest.name);  
  appName.disableSelection();

  appDisplayFrame.append(appName);
                          

  return appDisplayFrame;
}




/////////////// screen paging code for dashboard

// this is simply a shortcut for the eyes and fingers
var _startX = 0;			// mouse starting positions
var _offsetX = 0;			// current element offset
var _dragElement;			// needs to be passed from OnMouseDown to OnMouseMove

var numPages = 0;
var wasDragged = false;

var dragstart = 0;

function InitPaging(count)
{
  numPages = count;
  document.onmousedown = document.ontouchstart = OnMouseDown;
  document.onmouseup = document.ontouchend = OnMouseUp;
}

function OnMouseDown(e)
{
  console.log("target: " + e.target + "  class: " + e.target.className + "  id: " + e.target.id);
  
  dragStart = e.timeStamp;
  
  //might not need this
	_dragElement = $(".dashboard");
	
	if (e.button == 0)
	{
		// grab the mouse position
		if (e.touches && e.touches.length) {
		  _startX = e.touches[0].clientX;
		} else {
		  _startX = e.clientX;
        }
		
		// grab the clicked element's position
		_offsetX = ExtractNumber(_dragElement.offset().left);
		
		// tell our code to start moving the element with the mouse
		document.onmousemove = OnMouseMove;
		document.ontouchmove = OnMouseMove;
	
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
  var curPos;
  if (e.touches && e.touches.length) {
    curPos = e.touches[0].clientX;
  } else {
    curPos = e.clientX;
  }

	// this is the actual "drag code"
	var newPos = (_offsetX + curPos - _startX) + 'px';
	_dragElement.css("left", newPos);

  wasDragged = true;
}


function OnMouseUp(e)
{
  var curPos;
  if (e.touches && e.touches.length) {
    curPos = e.touches[0].clientX;
  } else {
    curPos = e.clientX;
  }

  var quick = (e.timeStamp - dragStart < 200);
  var small = Math.abs(curPos - _startX) < 20;
  
  var flick = quick && !small;
  var tap = quick && small;
  var drag = !quick && !small;
    
	if (_dragElement != null)
	{
	  if (tap) {
	        console.log("was tapped");
          if (e.target.parentNode.className == "icon") {
              var origin32 = $(e.target.parentNode).attr("origin32");
              navigator.apps.mgmt.launch(Base32.decode(origin32));
	        }
    } else if (flick) {
      //we go to the next page in the direction specified by the flick
      console.log("was flicked");

      //left or right?
      var dir = (curPos - _startX) > 0;
      
      var newPos = _offsetX;
      if (dir) {
        newPos += screenWidth; 
        if (newPos > 0) newPos = 0;
      } else {
        newPos -= pageWidth;
        if (newPos < ((numPages - 1) * screenWidth * -1)) newPos = ((numPages - 1) * screenWidth * -1);
      }
          
      _dragElement.animate({left: newPos}, 250);

    } else { //drag, which may or may not go to the next page
      console.log("was dragged");
      e.preventDefault();
      var snapPage = 0;
      
      if (_dragElement.position().left < 0) {
          var offset = Math.abs(_dragElement.position().left);
          var snapPage = Math.floor(offset / screenWidth);
          var remainder = offset - (snapPage * screenWidth);
          
          if ( remainder > Math.floor(screenWidth / 2) ) {
            snapPage++;
          }
          
      }
      
      if (snapPage >= numPages) snapPage = numPages - 1;
      
      _dragElement.animate({left: (snapPage * screenWidth * -1) }, 250);
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
InitPaging(5);

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


