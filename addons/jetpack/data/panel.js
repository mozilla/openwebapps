

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
  var _pageAnimating = false;
    
  //application dragging/rearranging globals  
  var _mouseDownHoldTimer;  //timer that determines whether we are dragging the app or the dashboard
  var _mouseDragoutTimer;   //timer that retains the mouse for a brief time after they user drags out of the window

  //the id of the currently dragged app, or undefined if none
  var _draggedApp;
  //the starting coordinates of the dragged app
  var _draggedAppOffsetX;
  var _draggedAppOffsetY;

  //the previous z-height that the dragged app began at
  var _draggedAppOrigZ;
  //the previous slot the currently dragged app was over, used to trigger animations only when the app is moved over
  // a different slot
  var _draggedAppLastSlot;

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



function computeLayoutVars() {
  screenWidth = 720;//getWindowWidth();
  pageWidth = screenWidth;
  screenHeight = 110;//getWindowHeight();
  
  appBoxWidth = 120;
  appBoxHeight = 90;
  appIconSize = 64; 
  appBorderSize = Math.floor(appIconSize/12);
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
                
    var iconWrapper = $(e.target.parentNode.parentNode);
    
    _dashOffsetX = extractNumber($("#dashboard").position().left);
    _dashOffsetY = extractNumber($("#dashboard").position().top);

    if (iconWrapper.hasClass("iconWrapper")) {
            _appIcon = iconWrapper;
            _appIcon.addClass("highlighted");
    } 
  }
  
  
  function extractNumber(value)
  {
    var n = parseInt(value, 10);
    return n == null || isNaN(n) ? 0 : n;
  }
  
  //This code computes the (minimal) changes to the initial arrangement that will leave a hole under the 
  // currently dragged item.  The resultant array is used to move the necessary items around in the page.
  function arrangeAppsOnPageToFit(pageIdx, overSlot) {    
    //get a copy of the page in question
    var arrangedPage = gDashboardState.pages[pageIdx].slice(0);

    //do nothing if the overSlot is empty
    if (arrangedPage[overSlot])
    {  
      //find a hole in the array, so we can slide things over
      // prefer a hole that is to the left of the dragged item, and as close as possible to it, so as to move only the
      // apps that must be moved, and no others.
      // if we are unable to find a hole to the left, then find the closest one to the right of the dragged item.
      // if there are no holes to be found, then use a virtual hole that is off the end of the array to the right.
      //  we will fix the array up after the drop
      var hole = 6;
      var i;
      //try to find a left hole
      for (i=0; i<overSlot; i++) {
        if (!arrangedPage[i]) {
          hole = i;
        }
      }
      //didnt find left hole, look for right
      if (hole == 6) {
        for (i=5; i>overSlot; i--) {
        if (!arrangedPage[i]) {
            hole = i;
          }
        }
      }
      
      if (hole < overSlot) { //hole is to the left
        for (i=hole; i<overSlot; i++) {
          arrangedPage[i] = arrangedPage[i+1];
        }
      } else {  //hole is to the right
        for (i=hole; i>overSlot; i--) {
          arrangedPage[i] = arrangedPage[i-1];
        }
      }

      arrangedPage[overSlot] = undefined;
    }
    
    //animate all the app icons to move to their correct places
    if (arrangedPage) {
      //now loop over all of the app signatures in the array, and tell each appDisplayFrame (from the cache) 
      //  to animate to left = array slot * appBoxWidth
      var i;
      //NOTE: 7 here is important!  It pushes the rightmost one off the side of the page, so that it is hidden
      for (i=0; i<7; i++) {
      if (arrangedPage[i]) {
          if (gAppItemCache[arrangedPage[i]].position().left != (appBoxWidth * i)) {
            console.log("OWA: moving app: " + i + " on page " + pageIdx);
            gAppItemCache[arrangedPage[i]].stop(true, false);
            gAppItemCache[arrangedPage[i]].animate({left: (appBoxWidth * i)}, 100);
          }
        }
      }
    }

    //return the modified page
    return arrangedPage;
  }
      
  //make sure every app on the page is where it is supposed to be
  function redrawPage(page, animated) {
    for (var i=0; i<6; i++) {
      if (gDashboardState.pages[page][i]){
        if (animated) {
          gAppItemCache[gDashboardState.pages[page][i]].css({left: (appBoxWidth * i)});
        } else {
          gAppItemCache[gDashboardState.pages[page][i]].animate({left: (appBoxWidth * i)}, 100);
        }
      }
    }
  }


  function fixUpPageOverflows(startPage) {
    //loop over all the pages, starting at the first, (or maybe the one we just dropped on?) and
    // check to make sure none of the apps have run off the end of the page.  if so, then shove them onto the next page,
    // and keep going, until we get to the end, or a page that doesn't need to be fixed
    //Then, when we are all done, remove any trailing pages that are empty
    var p, t;
    var numPages = gDashboardState.pages.length;

    for (p=startPage; p<numPages; p++) {
      if (gDashboardState.pages[p][6]) { //overflow
        //push the app into slot 0 of the next page, and then see if that causes a ripple
        if (!gDashboardState.pages[p+1]) gDashboardState.pages[p+1] = [];  //make a new empty page if there isn't one
        //check to see if we have to move things over
        if (gDashboardState.pages[p+1][0]) {
          //must shove them all over 1 to make room
          for (t=6; t>0; t--) {
            gDashboardState.pages[p+1][t] = gDashboardState.pages[p+1][t-1];
          }
        }
        //push the app into the empty slot in the next page
        gAppItemCache[gDashboardState.pages[p][6]].detach();
        $("#page" + (p+1)).append(gAppItemCache[gDashboardState.pages[p][6]]);

        gDashboardState.pages[p+1][0] = gDashboardState.pages[p][6];  
        gDashboardState.pages[p][6] = undefined;
        redrawPage(p+1);
      }
    }

    var emptyish;
    //remove empty trailing pages.  this must be the last code in this function, since we return from the middle of it
    for (p=numPages-1; p>0; p--) {
      emptyish = true;
      if (gDashboardState.pages[p].length) {
        for (var t=0; t<gDashboardState.pages[p].length; t++){
          if (gDashboardState.pages[p][t]) emptyish = false;
        }
      }

      if (emptyish) {
        $("#page" + p).remove();
        gDashboardState.pages.length--;
      }
      else return;
    }
  }



      
  function _onMouseMove(e)
  {
    e.preventDefault();
    clearTimeout(_mouseDownHoldTimer);
    if (_mouseDownTime == 0) { return; }

    var curPage = getCurrentPage();
    var newPage;
    
    if (_draggedApp) {
      //this is the icon dragging code
      //I need to do all the snapping, rearranging the other apps on the page, etc here
      gAppItemCache[_draggedApp].css("left", (_draggedAppOffsetX + e.clientX - _mouseDownX) + 'px');
      
      // figure out which slot we are above
      // if it's empty, do nothing
      var currentSlot = Math.floor((gAppItemCache[_draggedApp].position().left + (appBoxWidth/2)) / appBoxWidth);
      
      //special kludge for switching pages.  I need to abstract this
      if (gAppItemCache[_draggedApp].position().left <= -16) currentSlot = -1;
      if (gAppItemCache[_draggedApp].position().left + (appBoxWidth-16) > pageWidth) currentSlot = 6;
      
      if (currentSlot > 5) {
        currentSlot = 5;
        _draggedAppLastSlot = currentSlot;
        newPage = goToPage(curPage+1, 400, function(page) {
                                                //need to put the page we left back the way it was
                                                if (curPage != page) redrawPage(curPage);
                                                arrangeAppsOnPageToFit(page, currentSlot);
                                              });
      }
      
      else if (currentSlot < 0) {
        currentSlot = 0;
        _draggedAppLastSlot = currentSlot;
        newPage = goToPage(curPage-1, 400, function(page) {
                                                //need to put the page we left back the way it was
                                                if (curPage != page) redrawPage(curPage);
                                                arrangeAppsOnPageToFit(page, currentSlot);
                                              });
      }
      
      else if (currentSlot != _draggedAppLastSlot) {      
        _draggedAppLastSlot = currentSlot;
        //now call the magic function that, given you are holding the lifted app over slot N, 
        // what the arrangement of the other apps in the page should be.
       arrangeAppsOnPageToFit(curPage, _draggedAppLastSlot);
        
      }      
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
  
  //let's actually lift the app up and out of the page, and attach it to the clipper, so
  // we can move it around between pages if necessary
  function _onMouseHold(e) {
    //keep track of the id of the app we are dragging.  this is also used as a flag to tell us we are dragging
    _draggedApp = $(e.target.parentNode).attr("origin32");
    //check to be sure we have one
    if (_draggedApp) {
      _appIcon.removeClass("highlighted");
      _appIcon.addClass("liftedApp");
      
      _draggedAppOffsetX = extractNumber(gAppItemCache[_draggedApp].offset().left);
      _draggedAppOffsetY = extractNumber(gAppItemCache[_draggedApp].offset().top);

      var startSlot = Math.floor(gAppItemCache[_draggedApp].position().left / appBoxWidth);
      
      //remove the app from the page it started on
      gDashboardState.pages[getCurrentPage()][startSlot] = undefined;
      //lift it up
      _draggedAppOrigZ = gAppItemCache[_draggedApp].css('z-index');

      //remove it from the page it was in and attach it to the clipper instead
      gAppItemCache[_draggedApp].css('z-index', 10000);
      gAppItemCache[_draggedApp].detach();
      $("#clipper").append(gAppItemCache[_draggedApp]);

      //temporarily add an extra blank page at the end, in case the user wants to spread things out
      addEmptyPageToDash();
    }
  }


  
  function _onMouseLeave(e) {
    //for now, just treat it as a mouse up
    if (_mouseDownTime == 0) { return; }
    
    if (_draggedApp) {
      _mouseDragoutTimer = setTimeout(_onMouseUp, 410, e);
    } else {
      _onMouseUp(e);
    }
  }
    
  function _onMouseEnter(e) {
    clearTimeout(_mouseDragoutTimer);
  }

  
  
  function _onMouseUp(e)
  {    
    clearTimeout(_mouseDownHoldTimer);
    e.preventDefault();
    var curPage = getCurrentPage();
    console.log("OWA: MOUSE UP!");

    if (_draggedApp) {

      //user dropped the app on some page, not necessarily the one it originated on
      // * we need to fix the originating page, by removing the app from it
      // * we need to insert the app into the new page, (which might be the same page), with fixups
      //    - if page was full before dropping, then all apps afterwards need to be shifted over, possibly changing every page afterward 
      
      //remove the drag highlighting  
      _appIcon.removeClass("liftedApp");
      _appIcon = undefined;
      
      //get the correct arrangement of the current (dropped on) page
      var currentSlot = Math.floor((gAppItemCache[_draggedApp].position().left + (appBoxWidth/2)) / appBoxWidth);
      if (currentSlot > 5) currentSlot = 5;
      if (currentSlot < 0) currentSlot = 0;

      var rearrangedApps = arrangeAppsOnPageToFit(curPage, currentSlot);
      //insert the app into the empty slot it is over, on the current page
      rearrangedApps[currentSlot] = _draggedApp;
      console.log("OWA: DROPPED " + _draggedApp + " IN SLOT " + currentSlot + " ON PAGE " + curPage)
      
      //overwrite the page in the dashboard state with the newly arranged page
      gDashboardState.pages[curPage] = rearrangedApps;
      //redrawPage(curPage, true);
      //DO LOTS OF FIXUP!!

      fixUpPageOverflows(curPage);

      //save the changes
      saveDashboardState(gDashboardState);

      //remove the appDisplayFrame from the clipper
      gAppItemCache[_draggedApp].detach();
      //insert the appDisplayFrame into the current page
      $("#page" + curPage).append(gAppItemCache[_draggedApp]);
      //animate the appdisplayframe to the correct position and z-index
      gAppItemCache[_draggedApp].animate({left: (_draggedAppLastSlot * appBoxWidth)}, 100);
      gAppItemCache[_draggedApp].css('z-index', _draggedAppOrigZ);
      
      //stop dragging 
      _draggedApp = undefined; 
      
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
        console.log("OWA: app launched");
        _appIcon.removeClass("highlighted");
        _appIcon = undefined;
  
        var origin32 = $(e.target.parentNode).attr("origin32");
        if (self && self.port) {
          self.port.emit("launch", Base32.decode(origin32));
        } else {
          navigator.apps.mgmt.launch(Base32.decode(origin32));
        }
      } else if (flick) {
        //we go to the next page in the direction specified by the flick
        console.log("OWA: dashboard flicked");
                  
        //left or right?
        var dir = (_endX - _mouseDownX) > 0;
  
        if (!dir) {
          curPage ++; 
        } else {
          curPage --;
        }
            
        goToPage(curPage, 200);
    
      } else { //drag, which may or may not go to the next page
        console.log("OWA: dashboard dragged");
        
        var snapPage = curPage;
        
        if ($("#dashboard").position().left < 0) {
            var offset = Math.abs($("#dashboard").position().left);
            var remainder = offset - (curPage * screenWidth);
            
            if ( remainder > Math.floor(screenWidth / 2) ) {
              snapPage++;
            }
        }
        goToPage(snapPage, 400);
      }
    }
               
    _mouseDownTime = 0;
  }
  
    
  
  function goToPage(whichPage, animationSpeed, completionCallback) {
    var numPages = gDashboardState.pages.length;
    if (whichPage >= numPages)  whichPage = numPages - 1;
    if (whichPage < 0) whichPage = 0;
    var finalPos = (whichPage * screenWidth * -1);
    
    if ( ($("#dashboard").position().left != finalPos) && (!_pageAnimating) ) {
      console.log("OWA: transitioning to page : " + whichPage);
      _pageAnimating = true;
      $("#dashboard").animate({left: (whichPage * screenWidth * -1) }, animationSpeed, function() {_pageAnimating = false; if (completionCallback) completionCallback(whichPage); } );
    } 
    return whichPage;
  }
  
  
  
  //////////////////////////////////////////////////

function onFocus(event)
{
  if (!self || !self.port) {
  updateDashboard();
  }
}


function saveDashboardState(state) {
  if (self && self.port) {
    self.port.emit("saveState", state);
  } else {
    navigator.apps.mgmt.saveState(gDashboardState, function() {console.log("OWA: dashboard state saved");} );
  }
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


function updateDashboard() {
  if (!self || !self.port) {
    navigator.apps.mgmt.list( function (allApps) {
    redrawDashboard(allApps);
  });
  }
}


function updateState(newState) {
  gDashboardState = newState?newState:{};
  
  if (gDashboardState.pages == undefined) {
    //create the right number of pages to hold everything
    gDashboardState.pages = [];
    
    //put up to 6 apps into each page, or as many as we have
    var a=0;
    for (origin in gApps) {
      if (gDashboardState.pages[Math.floor(a/6)] == undefined) { gDashboardState.pages[Math.floor(a/6)] = []; }
      gDashboardState.pages[Math.floor(a/6)][(a % 6)] = gApps[origin].origin32;
      a++;
    }
    
    //save this as the new state
    saveDashboardState(gDashboardState);
  }
    
  layoutPages();
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
          if (typeof console !== "undefined") console.log("OWA: Error while adding base32 ID to app " + origin + ": " + e);
        }
      }


      if (self && self.port) {
        self.port.emit("loadState");
      } else {
        navigator.apps.mgmt.loadState(updateState);
      }
}

function addEmptyPageToDash() {
  var numPages = gDashboardState.pages.length;

  //add empty page to dash state array
  gDashboardState.pages[numPages] = [];

  //grow the dashboard
  $('#dashboard').css({width: ((numPages+1) * (screenWidth +2)), height: screenHeight});

  //add a new empty page at the end
  var nextPage = $("<div/>").addClass("page").attr("id", "page" + numPages);
  $("#dashboard").append(nextPage);
  nextPage.css({width: screenWidth, height: screenHeight});
}


//create the full app list, and sort them for display
// here is also where I cache the base32 version of the origin into the app
function layoutPages() {
  if (!gApps) return;
  //clear the list
  $('.page').remove();
  
  var numPages = gDashboardState.pages.length;
  $('#dashboard').css({width: (numPages * (screenWidth +2)), height: screenHeight});
  
  //now for each page, build zero or more icon items, and put them into the page
  for (var p = 0; p < numPages; p++) {
    //add the page div
    var nextPage = $("<div/>").addClass("page").attr("id", "page" + p);
    
    $("#dashboard").append(nextPage);
    nextPage.css({width: screenWidth, height: screenHeight});

    //put the apps in, used the cached items if we have them
    for (var a = 0; a < gDashboardState.pages[p].length; a++) {
        
        if (gDashboardState.pages[p][a]) {  //some slots contain undefined
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
  goToPage(curPage - 1, 200);
  }

 function _pageRightClick() { 
  var curPage = getCurrentPage();
  goToPage(curPage + 1, 200);
  } 


//set up the message handler for the widget
if (self && self.port) {
  self.port.on("theList", redrawDashboard);
} else {
  updateDashboard();
}

if (self && self.port) {
  self.port.on("theState", updateState);
}

//set up the mouse handlers for html page loads
 $(document).ready(function() {
  
  $("#clipper").mousedown(_onMouseDown);
  $("#clipper").mouseup(_onMouseUp);
  $("#clipper").mousemove(_onMouseMove);
  $("#clipper").mouseleave(_onMouseLeave);
  $("#clipper").mouseenter(_onMouseEnter);

  $("#pageLeft").click(_pageLeftClick);            
  $("#pageRight").click(_pageRightClick);

    document.addEventListener("contextmenu", function(e) {
      e.preventDefault();
    }, true);

 });


