

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

//caches the constructed app icon panes for speed, and to stop poking the network all the time.
var gAppItemCache = {};


function getWindowHeight() {
  return document.body.clientHeight;
}

function getWindowWidth() {
  return document.body.clientWidth;
}


/////////////////////////////////////////////////////////
// mousedown/mouseup click/drag/flick state vars
  var _mouseDownX = 0;			// mouse starting position
  var _mouseDownY = 0;
  var _mouseDownTime = 0;

  var _dashOffsetX;			
  var _dashOffsetY;
  
  var _appIcon;
  var _mouseDownHoldTimer;
  var _isDraggingApp = false;
  var _draggedApp;
  var _appOffsetX;
  var _appOffsetY;
  var _appOldZ;
  var _appDropSlot;
  var _appHole;
  var _appDraggingPage;
  
/////////////////////////////////////////////////////////
//important page layout global vars
var screenWidth = 0;
var screenHeight = 0;
var pageWidth = 0;
var appBoxWidth = 0;
var appBoxHeight = 0;
var appIconSize = 0;
var appBorderSize = 0;
var appNameSize = 0;
var appNameFontSize = 0;

var numPages = 0;


function computeLayoutVars() {
  screenWidth = 720;//getWindowWidth();
  pageWidth = screenWidth;
  screenHeight = 110;//getWindowHeight();
  
  appBoxWidth = 120;
  appBoxHeight = 90;
  appIconSize = 64; 
  appBorderSize = Math.floor(appIconSize/8);
  appNameSize = Math.floor(appBoxWidth * 0.8);
  appNameFontSize = Math.max(Math.ceil(appIconSize/6), 10);
  
//   console.log("screenWidth: " + screenWidth);
//   console.log("screenHeight: " + screenHeight);
//   console.log("pageWidth: " + pageWidth);
//   console.log("appBoxWidth: " + appBoxWidth);
//   console.log("appBoxHeight: " + appBoxHeight);
//   console.log("appIconSize: " + appIconSize);
//   console.log("appNameSize: " + appNameSize);
//   console.log("appNameFontSize: " + appNameFontSize);

}

//////////////////////
function getCurrentPage() {
  return Math.floor( (Math.abs($("#dashboard").position().left)) / screenWidth);
}

/////////////////////////////////////////////////////////
  function _onMouseDown(e)
  {    
    e.preventDefault();
    _mouseDownTime = e.timeStamp;
    _mouseDownHoldTimer = setTimeout(_onMouseHold, 1000, e);
    
    // grab the mouse position
    _mouseDownX = e.clientX;
    _mouseDownY = e.clientY;
                
    var curPage = getCurrentPage();

    var iconWrapper = $(e.target.parentNode.parentNode);
    var appDisplayFrame = $(e.target.parentNode.parentNode.parentNode);
    
    _dashOffsetX = extractNumber($("#dashboard").offset().left);
    _dashOffsetY = extractNumber($("#dashboard").offset().top);

    if (iconWrapper.hasClass("iconWrapper")) {
            _appIcon = iconWrapper;
            _appIcon.addClass("highlighted");
            _draggedApp = $(e.target.parentNode).attr("origin32");
            //console.log("dragging: " + _draggedApp);
    } 
  }
  
  
  function extractNumber(value)
  {
    var n = parseInt(value, 10);
    return n == null || isNaN(n) ? 0 : n;
  }
  
  function moveAppsAround(source, destination) {
    //console.log("start: " + source + "  current: " + destination);
    
    //get a copy of the current page
    var arrangedPage = gDashboardState.pages[getCurrentPage()].slice(0);
    //empty the source slot
    arrangedPage[source] = undefined;
    //figure out where the other apps should be, if the dragged app is held over 
    // the slot number in destination.  <apply magic>
    //////////////
    var i;
    var hole;
    //are they over a non-empty slot?
      // I think I need to start at the current slot, and iterate towards the hole, moving items.
      // I might get to stop sooner, if I run into another hole first.
      if (source < destination) { //hole is to the left
        for (i=source; i<destination; i++) {
          arrangedPage[i] = arrangedPage[i+1];
        }
      } else {  //hole is to the right
        for (i=source; i>destination; i--) {
          arrangedPage[i] = arrangedPage[i-1];
        }
      }
    
    arrangedPage[destination] = undefined;
    //return the copy of the page, with the changes made
    return arrangedPage;

  }
    
      
  function _onMouseMove(e)
  {
    e.preventDefault();
    clearTimeout(_mouseDownHoldTimer);
    if (_mouseDownTime == 0) { return; }

    if (_isDraggingApp) {
      //this is the icon dragging code
      //I need to do all the snapping, rearranging the other apps on the page, etc here
      gAppItemCache[_draggedApp].css("left", (_appOffsetX + e.clientX - _mouseDownX) + 'px');
      
      //we need to move the hole around and keep it under the dragged app

      // figure out which slot we are above
      // if it's empty, do nothing
      // if it's not, try to slide the app to the left (and push other leftish apps over too)
      // if it cannot go left, then slide it right (and push other rightish apps over too)
      var currentSlot = Math.floor((gAppItemCache[_draggedApp].position().left + (appBoxWidth/2)) / appBoxWidth);
      
      if (currentSlot > 5) currentSlot = 5;
      if (currentSlot < 0) currentSlot = 0;
      
      if (currentSlot != _appDropSlot) {      
        _appDropSlot = currentSlot;
        //now call the magic function that, given you are holding the lifted app over slot N, 
        // what the arrangement of the other apps in the page should be.
        var rearrangedApps = moveAppsAround(_appHole, _appDropSlot);
        
        //now loop over all of the app signatures in the array, and tell each appDisplayFrame (from the cache) 
        //  to animate to left = array slot * appBoxWidth
        var i;
        for (i=0; i<6; i++) {
        if (rearrangedApps[i]) {
            if (gAppItemCache[rearrangedApps[i]].position().left != (appBoxWidth * i)) {
              gAppItemCache[rearrangedApps[i]].stop(true, false);
              gAppItemCache[rearrangedApps[i]].animate({left: (appBoxWidth * i)}, 100);
            }
          }
        }
      
      }
      
//       if (_appDropSlot > 5) _appDropSlot = 5;
//       if (_appDropSlot < 0) _appDropSlot = 0;
//       if (_appDropSlot != _appHole) {      
//         var moveDir = _appHole - _appDropSlot;
//        // if (_appDropSlot < _appHole) { moveDir = _appDropSlot - _appHole; }
//         
//         var findPos = (_appDropSlot * appBoxWidth);
//              
//         var curPageName = "#page" + getCurrentPage();
//   
//         var appLeft;
//         var apps = $(curPageName).children('.appDisplayFrame');
//         jQuery.each(apps, function(i, a) {
//           if ($(a) != _draggedApp) {
//             appLeft = $(a).position().left;
//             if (appLeft == findPos) {
//               $(a).animate({left: appLeft + (moveDir * appBoxWidth)}, 100);
//               _appHole = _appDropSlot;
//             }
//           }
//         });
//       }
      
    } else {
      // this is the page scrolling code
      var newPos = (_dashOffsetX + e.clientX - _mouseDownX) + 'px';
  
      $("#dashboard").css("left", newPos);
      
      if (_appIcon != undefined) {
        _appIcon.removeClass("highlighted");
        _appIcon = undefined;
      }
    }
  }
  
  
  function _onMouseLeave(e) {
    //for now, jsut treat it as a mouse up
    if (_mouseDownTime == 0) { return; }
    
    //if (over left page button) { page left}
    //else if (over right page button) { page right}
    //else  {
      _onMouseUp(e);
    //}
  }
  
  
  
  function _onMouseUp(e)
  {    
    clearTimeout(_mouseDownHoldTimer);
    e.preventDefault();
    var curPage = getCurrentPage();

    if (_isDraggingApp) {
      //console.log("app dragged to slot: " + _appDropSlot + " offset: " + (_appDropSlot * appBoxWidth));
      //dragged an app, so we need to align it to the slot
      _appIcon.removeClass("liftedApp");
      var rearrangedApps = moveAppsAround(_appHole, _appDropSlot);
      rearrangedApps[_appDropSlot] = _draggedApp;
      gDashboardState.pages[curPage] = rearrangedApps;
      
      gAppItemCache[_draggedApp].animate({left: (_appDropSlot * appBoxWidth)}, 100);
      gAppItemCache[_draggedApp].css('z-index', _appOldZ);
      _draggedApp = undefined;
      _isDraggingApp = false;
      _appDraggingPage = undefined;
      
      //now write the changed order back to the dashboard state structure
      
    } else {
      //dragged the dashboard
  
      //they dragged or flicked the dash, or launched an app
      var _endX, _endY;
      
      _endX = e.clientX;
      _endY = e.clientY;
    
      var quick = (e.timeStamp - _mouseDownTime < 200);
      var small = Math.abs(_endX - _mouseDownX) < 10;
      
      var flick = quick && !small;
      var tap =  small;
      var drag = !quick;
        
      if (tap && (_appIcon != undefined)) {
        console.log("app launched");
        _appIcon.removeClass("highlighted");
        _appIcon = undefined;
  
        var origin32 = $(e.target.parentNode).attr("origin32");
        if (self.port != undefined) {
          self.port.emit("launch", Base32.decode(origin32));
        } else {
          navigator.apps.mgmt.launch(Base32.decode(origin32));
        }
      } else if (flick) {
        //we go to the next page in the direction specified by the flick
        console.log("dashboard flicked");
                  
        //left or right?
        var dir = (_endX - _mouseDownX) > 0;
  
        if (!dir) {
          curPage ++; 
        } else {
          curPage --;
        }
            
        goToPage(curPage, true);
    
      } else { //drag, which may or may not go to the next page
        console.log("dashboard dragged");
        
        snapPage = curPage;
        
        if ($("#dashboard").position().left < 0) {
            var offset = Math.abs($("#dashboard").position().left);
            var remainder = offset - (curPage * screenWidth);
            
            if ( remainder > Math.floor(screenWidth / 2) ) {
              snapPage++;
            }
        }
        goToPage(snapPage, true);
      }
    }
               
    _mouseDownTime = 0;
  }
  
  
  function _onMouseHold(e) {
    if (_draggedApp) {
      _appIcon.removeClass("highlighted");
      _appIcon.addClass("liftedApp");
      _appOffsetX = extractNumber(gAppItemCache[_draggedApp].offset().left);
      _appOffsetY = extractNumber(gAppItemCache[_draggedApp].offset().top);
      _isDraggingApp = true;
      _appOldZ = gAppItemCache[_draggedApp].css('z-index');

      gAppItemCache[_draggedApp].css('z-index', 10000);
      _appHole = Math.floor(gAppItemCache[_draggedApp].position().left / appBoxWidth);
      
      //copy the page struct, so we can mess with it
      _appDraggingPage = gDashboardState.pages[getCurrentPage()];
      //console.log(_appDraggingPage);
    }
  }
  
  
  function goToPage(whichPage, withAnimation) {
    if (whichPage >= numPages) { whichPage = numPages - 1; }
    if (whichPage < 0) { whichPage = 0; }
    $("#dashboard").animate({left: (whichPage * screenWidth * -1) }, (withAnimation?250:0));

  }
  
  
  
  //////////////////////////////////////////////////

function onFocus(event)
{
  if (self.port == undefined) {
  updateDashboard();
  }
}




function saveDashboardState( callback ) {
  //navigator.apps.mgmt.saveState(gDashboardState, callback);
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

  if (save && (typeof save == 'object')) {
    if (save.pages && $.isArray(save.pages)) return save;
  }
  return emptyState;
}

function updateDashboard() {
  if (self.port == undefined) {
    navigator.apps.mgmt.list( function (allApps) {
    redrawDashboard(allApps);
  });
  }
}


//this is the primary UI function.  It loads the latest app list from disk, the latest dashboard state from disk,
// and then proceeds to bring the visual depiction into synchrony with the data, with the least visual interruption.
function redrawDashboard( listOfInstalledApps ) {
    //both the app list and dashboard data functions are asynchronous, so we need to do everything in the callback
        
      //calculate various sizes of elements based on the window size, and set the background
      computeLayoutVars();      
          
          gApps = listOfInstalledApps;

          //tag them
          for (origin in gApps) {
            try {
                //Tag the items with a base32 version of their url to use as an ID if they don't have it already
                if (gApps[origin].origin32 == undefined) { 
                  gApps[origin].origin32 = Base32.encode(origin); 
                }        
            } catch (e) {
              if (typeof console !== "undefined") console.log("Error while adding base32 ID to app " + origin + ": " + e);
            }
          }


          //now, in the list callback, load the dashboard state
//           navigator.apps.mgmt.loadState( function (dashState) 
//           {
//               gDashboardState = checkSavedData(dashState);
//               
//               //if we get an empty dashboard state here, then we will just stuff everything into pages as we find them
//               if (gDashboardState.pages == undefined) {
//               
//                 //create the right number of pages to hold everything
               gDashboardState.pages = [];
                
                //put up to 6 apps into each page, or as many as we have
                var a=0;
                for (origin in gApps) {
                  if (gDashboardState.pages[Math.floor(a/6)] == undefined) { gDashboardState.pages[Math.floor(a/6)] = []; }
                  gDashboardState.pages[Math.floor(a/6)][(a % 6)] = gApps[origin].origin32;
                  a++;
                }
                //save this as the new state
                //saveDashboardState();
              //}
              
             numPages = gDashboardState.pages.length;
             layoutPages();
  
//            });                      

}



//create the full app list, and sort them for display
// here is also where I cache the base32 version of the origin into the app
function layoutPages() {
  if (!gApps) return;
  //clear the list
  $('.page').remove();
  
  $('#dashboard').css({width: (numPages * (screenWidth +2)), height: screenHeight});
  
  //now for each page, build zero or more icon items, and put them into the page
  for (var p = 0; p < numPages; p++) {
    //add the page div
    var nextPage = $("<div/>").addClass("page").attr("id", "page" + p);
    
    $("#dashboard").append(nextPage);
    nextPage.css({width: screenWidth, height: screenHeight});

    //put the apps in, used the cached items if we have them
    for (var a = 0; a < gDashboardState.pages[p].length; a++) {
        
        if (gAppItemCache[gDashboardState.pages[p][a]] == undefined)
        {
          gAppItemCache[gDashboardState.pages[p][a]] = createAppItem( findInstallForOrigin32(gDashboardState.pages[p][a]) );
        }
        
        var thisApp = gAppItemCache[gDashboardState.pages[p][a]];
        nextPage.append(thisApp);
        thisApp.css({left: (a*appBoxWidth)});
    }
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


function createAppItem(install)
{

  var appDisplayFrame = $("<div/>").addClass("appDisplayFrame");
  appDisplayFrame.css({width: appBoxWidth, height: appBoxHeight});
  
  //helpers
  var borders = appBorderSize * 2;
  var wrapperSize = appIconSize + borders;
  var heightRem = appBoxHeight - wrapperSize;
  var widthRem = appBoxWidth - wrapperSize;
  
  var iconWrapper = $("<div/>").addClass("iconWrapper").css({width: wrapperSize, 
                                                              height: wrapperSize,
                                                              marginTop: (heightRem/2) + "px", 
                                                              marginBottom: "0px",
                                                              marginLeft: (widthRem/2) + "px",
                                                              marginRight: (widthRem/2) + "px", 
                                                              "border-radius": (wrapperSize/6) + "px"
                                                              });
  
  var clickyIcon = $("<div/>").addClass("icon");
  clickyIcon.attr("origin32", install.origin32);

  clickyIcon.css({width: appIconSize, 
                  height: appIconSize, 
                  margin: appBorderSize,
                                    
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
  
  iconWrapper.append(clickyIcon);
  appDisplayFrame.append(iconWrapper);


  //TODO: size text to fit
  var appName = $("<div/>").addClass("listLabel");
  appName.css({width: appNameSize, 
              "font-size":  appNameFontSize});

  appName.text(install.manifest.name);  
  appDisplayFrame.append(appName);
                          

  return appDisplayFrame;
}

function _pageLeftClick() { 
  var curPage = getCurrentPage();
  goToPage(curPage - 1, true);
  }

 function _pageRightClick() { 
  var curPage = getCurrentPage();
  goToPage(curPage + 1, true);
  } 


//set up the message handler for the widget
if (self && self.port) {
  self.port.on("theList", redrawDashboard);
} else {
  updateDashboard();
}

//set up the mouse handlers for html page loads
 $(document).ready(function() {
  
  $("#dashboard").mousedown(_onMouseDown);
  $("#dashboard").mouseup(_onMouseUp);
  $("#dashboard").mousemove(_onMouseMove);
  $("#dashboard").mouseleave(_onMouseLeave);
  $("#pageLeft").click(_pageLeftClick);            
  $("#pageRight").click(_pageRightClick);

    document.addEventListener("contextmenu", function(e) {
      e.preventDefault();
    }, true);

 });


