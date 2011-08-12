

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

var appAnimationSpeed = 150;

//the saved state (app icon arrangement, mostly) for the dashboard
var gDashboardState = {};

//caches the constructed app icon panes for speed, and to stop poking the network all the time.
var gAppItemCache = {};

//contains constants defining the current layout, values computed from them, and methods to alter and retrieve them, as well as update the views
var gLayout = { //some plausible default values
                panelWidth: 100,
                panelHeight: 100,
                rowCount: 1,
                columnCount: 1,
                appBoxWidth: 100,
                appBoxHeight: 100,
                appIconSize: 50,
                appBorderSize: 5,
                appNameSize: 80,
                appNameFontSize: 12,
                setPanelSize: function(width, height) { if (width) this.panelWidth = width; if (height) this.panelHeight = height; this.recomputeLayout(); },
                setAppRowsAndColumns: function(rows, columns) { if (rows) this.rowCount = rows; if (columns) this.columnCount = columns; this.recomputeLayout();},
                recomputeLayout: function() {
                                                $("#clipper").css({width: this.panelWidth, height: this.panelHeight, clip: "rect(0px, " + this.panelWidth + "px, " + this.panelHeight + "px, 0px)"});
                                                $("#dashboard").css({width: this.panelWidth, height: this.panelHeight});
                                                //compute all the other params based on the panel size and rows/cols
                                                console.log("computing layout");
                                                this.appBoxWidth = Math.floor(this.panelWidth/this.columnCount);
                                                this.appBoxHeight = Math.floor(this.panelHeight/this.rowCount);
                                                this.appIconSize = Math.floor(Math.min(this.appBoxWidth, this.appBoxHeight) / 2);
                                                this.appBorderSize = Math.max(Math.ceil(this.appIconSize/12), 2);
                                                this.appNameSize = Math.floor(this.appBoxWidth * 0.8);
                                                this.appNameFontSize = Math.max(Math.ceil(this.appIconSize/6), 10);
                                             },

              };

gLayout.setPanelSize(750, 220);
gLayout.setAppRowsAndColumns(2, 6);


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
  
  var _pageScrollTimer;           //timer that retains the mouse for a brief time after they user drags out of the window
  var _pageScrollDelay = false;   //true if scrolling to new page should wait, false if it can go ahead
  var _pageScrollEventObject;     //sigh, this is a cached event object, used for triggering multi-page scrolls when the user doesn't actually move the mouse.

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


//////////////////////
function getCurrentPage() {
  return Math.floor( (Math.abs($("#dashboard").position().left)) / gLayout.panelWidth);
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
    console.log(_mouseDownX + " " + _mouseDownY);
                
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
  
    if (!gDashboardState.pages[pageIdx]) { console.log("OWA: ERROR!!  non-existent page index: " + pageIdx); return null;} 
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
      var hole = (gLayout.rowCount * gLayout.columnCount);
      var i;
      //try to find a left hole
      for (i=0; i<overSlot; i++) {
        if (!arrangedPage[i]) {
          hole = i;
        }
      }
      //didnt find left hole, look for right
      if (hole == (gLayout.rowCount * gLayout.columnCount)) {
        for (i=(gLayout.rowCount * gLayout.columnCount)-1; i>overSlot; i--) {
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
      //  to animate to left = array slot * gLayout.appBoxWidth
      var i;
      //NOTE: (gLayout.columnCount+1) here is important!  It pushes the rightmost one off the side of the page, so that it is hidden
      for (i=0; i< (gLayout.rowCount * gLayout.columnCount)+1; i++) {
      if (arrangedPage[i]) {

          var pos = positionForSlot(i);

          if ((gAppItemCache[arrangedPage[i]].position().left != pos.left) || (gAppItemCache[arrangedPage[i]].position().top != pos.top)) {
            gAppItemCache[arrangedPage[i]].stop(true, false);
            gAppItemCache[arrangedPage[i]].animate({left: pos.left, top: pos.top}, appAnimationSpeed);
          }
        }
      }
    }

    //return the modified page
    return arrangedPage;
  }
      
  //make sure every appDisplayFrame on the page is where it is supposed to be
  function redrawPage(page, animated) {
    for (var i=0; i<(gLayout.rowCount * gLayout.columnCount); i++) {
      if (gDashboardState.pages[page][i]){
        var pos = positionForSlot(i);
        if (animated) {
          gAppItemCache[gDashboardState.pages[page][i]].css({left: pos.left, top: pos.top}, appAnimationSpeed);
        } else {
          gAppItemCache[gDashboardState.pages[page][i]].animate({left: pos.left, top: pos.top});
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

    var pageSize = gLayout.columnCount * gLayout.rowCount;

    for (p=startPage; p<numPages; p++) {
      if (gDashboardState.pages[p][pageSize]) { //overflow
        //push the app into slot 0 of the next page, and then see if that causes a ripple
        if (!gDashboardState.pages[p+1]) gDashboardState.pages[p+1] = [];  //make a new empty page if there isn't one
        //check to see if we have to move things over
        if (gDashboardState.pages[p+1][0]) {
          //must shove them all over 1 to make room
          for (t=pageSize; t>0; t--) {
            gDashboardState.pages[p+1][t] = gDashboardState.pages[p+1][t-1];
          }
        }
        //push the app into the empty slot in the next page
        gAppItemCache[gDashboardState.pages[p][pageSize]].detach();
        $("#page" + (p+1)).append(gAppItemCache[gDashboardState.pages[p][pageSize]]);

        gDashboardState.pages[p+1][0] = gDashboardState.pages[p][pageSize];  
        gDashboardState.pages[p][pageSize] = undefined;
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


  //finds the nearest slot for a given set of coordinates
  function slotForPosition(left, top) {
      var currentSlot = Math.floor((left + (gLayout.appBoxWidth/2)) / gLayout.appBoxWidth);
      //add on the rows
      currentSlot += gLayout.columnCount * Math.floor((top + (gLayout.appBoxHeight/2)) / gLayout.appBoxHeight);

      if (currentSlot < 0) currentSlot = 0;
      if (currentSlot > (gLayout.columnCount * gLayout.rowCount)-1 ) { currentSlot = (gLayout.columnCount * gLayout.rowCount)-1; }

      console.log("over slot: " + currentSlot)
      return currentSlot;
  }

  //returns the coordinates for a given slot
  function positionForSlot(s) {
    var slotLeft = gLayout.appBoxWidth * (s % gLayout.columnCount);
    var slotTop = Math.floor(s/gLayout.columnCount) * gLayout.appBoxHeight;

    return {left: slotLeft, top: slotTop};
  }


  //TODO: add hold-forgiveness, whereby we don't stop the holddown timer if the stay within 2 pixels of where they are holding
      
  function _onMouseMove(e)
  {
    //slightly hokey caching of last mousemove event (the position is what we care about) for the case 
    // when you want to scroll multiple pages, without having to wiggle the mouse
    if (e) {
      _pageScrollEventObject = e;
    } else {
      console.log("OWA: using cached mousemoveevent");
      e = _pageScrollEventObject;
    }

    e.preventDefault();
    if (_mouseDownTime == 0) { return; }

    //give the user some forgiveness when pressing and holding. if they only move a couple of pixels, we will stillcount it as a hold.
    if (_mouseDownHoldTimer) {
      if (Math.abs(e.clientX - _mouseDownX) > 3 || Math.abs(e.clientY - _mouseDownY) > 3) {
        clearTimeout(_mouseDownHoldTimer);
        _mouseDownHoldTimer = undefined;
      }
      else return;
    }

    var curPage = getCurrentPage();
    
    //this is the -app- dragging code, which manages the necessary animations, the underlying data changes, and the possible paging to a different
    // dashboard page while carrying an app
    if (_draggedApp) {
      //we are moving the appDisplayFrame from one coordinate system to another, so we need to computer an offset, so it doesn't jump away from the cursor
      var containerOffsetLeft = $("#clipper").offset().left;
      var containerOffsetTop = $("#clipper").offset().top;

      //this is the icon dragging code
      //I need to do all the snapping, rearranging the other apps on the page, etc here

      //don't ]et the app be dragged outside the clipping frame
      var dragOutAmount = Math.floor((gLayout.appBoxWidth - ((gLayout.appBorderSize * 2) + gLayout.appIconSize))/2) - 1; //frame padding

      //figure out if they are pushing against the side and want to scroll the page
      var paging = 0;
      if (gAppItemCache[_draggedApp].position().left <= -dragOutAmount) paging = -1;
      if ((gAppItemCache[_draggedApp].position().left - dragOutAmount + gLayout.appBoxWidth) >= gLayout.panelWidth) paging = 1;

      //keep the app inside the dash
      var newLeft = Math.min( Math.max( (_draggedAppOffsetX + e.clientX - (_mouseDownX + containerOffsetLeft)), -dragOutAmount), (gLayout.panelWidth + dragOutAmount - gLayout.appBoxWidth));  
      var newTop = Math.min( Math.max( (_draggedAppOffsetY + e.clientY - (_mouseDownY + containerOffsetTop)), 0), (gLayout.panelHeight - gLayout.appBoxHeight));

      //keep it from going outside the dashboard
      gAppItemCache[_draggedApp].css({left: newLeft, top: newTop});
      
      // figure out which slot we are above
      // if it's empty, do nothing
      var currentSlot = slotForPosition(gAppItemCache[_draggedApp].position().left, gAppItemCache[_draggedApp].position().top);

      //this is the paging code that is triggered when you are carrying an app and then push against the side of the screen.
      // we go to the next page in that direction, if there is one
      if (paging != 0) {
        console.log("paging to the " + paging==1?"right":"left");

        _draggedAppLastSlot = undefined;
        if (!_pageScrollDelay) {
                var resultantPage = goToPage(curPage+paging, 400, function(page) {
                                                //need to put the page we left back the way it was
                                                if (curPage != page) redrawPage(curPage);
                                                arrangeAppsOnPageToFit(page, currentSlot);
                                              });
        }
      }
      //otherwise, if they are over a new slot than they were last time, we animate the icons on the page into the proper configuration      
      else if (currentSlot != _draggedAppLastSlot) {      
        _draggedAppLastSlot = currentSlot;
        //now call the magic function that, given you are holding the lifted app over slot N, 
        // what the arrangement of the other apps in the page should be.
       arrangeAppsOnPageToFit(curPage, _draggedAppLastSlot);
        
      }      
    } else {
      // this is the -dashboard- scrolling code, when the user grabs the dash and pulls it one way or the other
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

      var startSlot = slotForPosition(_draggedAppOffsetX, _draggedAppOffsetY)
      
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
    _mouseDownHoldTimer = undefined;

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
      var currentSlot = slotForPosition(gAppItemCache[_draggedApp].position().left, gAppItemCache[_draggedApp].position().top);

      var rearrangedApps = arrangeAppsOnPageToFit(curPage, currentSlot);
      //insert the app into the empty slot it is over, on the current page
      rearrangedApps[currentSlot] = _draggedApp;
      console.log("OWA: DROPPED " + _draggedApp + " IN SLOT " + currentSlot + " ON PAGE " + curPage)
      
      //overwrite the page in the dashboard state with the newly arranged page
      gDashboardState.pages[curPage] = rearrangedApps;
      //DO LOTS OF FIXUP!!

      fixUpPageOverflows(curPage);
      //redrawPage(curPage, true);

      //save the changes
      saveDashboardState(gDashboardState);

      //remove the appDisplayFrame from the clipper
      gAppItemCache[_draggedApp].detach();
      //insert the appDisplayFrame into the current page
      $("#page" + curPage).append(gAppItemCache[_draggedApp]);
      
      //animate the appdisplayframe to the correct position and z-index
      var pos = positionForSlot(currentSlot);
      gAppItemCache[_draggedApp].animate({left: pos.left, top: pos.top}, appAnimationSpeed);
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
            
        goToPage(curPage, 250);
    
      } else { //drag, which may or may not go to the next page
        console.log("OWA: dashboard dragged");
        
        var snapPage = curPage;
        
        if ($("#dashboard").position().left < 0) {
            var offset = Math.abs($("#dashboard").position().left);
            var remainder = offset - (curPage * gLayout.panelWidth);
            
            if ( remainder > Math.floor(gLayout.panelWidth / 2) ) {
              snapPage++;
            }
        }
        goToPage(snapPage, 350);
      }
    }
               
    _mouseDownTime = 0;
  }
  
    
  
  function goToPage(whichPage, animationSpeed, completionCallback) {
    var numPages = gDashboardState.pages.length;
    if (whichPage >= numPages)  whichPage = numPages - 1;
    if (whichPage < 0) whichPage = 0;
    var finalPos = (whichPage * gLayout.panelWidth * -1);
    
    if ( ($("#dashboard").position().left != finalPos) && (!_pageAnimating) ) {
      console.log("OWA: transitioning to page : " + whichPage);
      _pageAnimating = true;
      _pageScrollDelay = true;  //used by the auto-scrolling code to prevent rapid scrolling across many pages
      $("#dashboard").animate({left: (whichPage * gLayout.panelWidth * -1) }, animationSpeed, function() {
                                                                                                    _pageAnimating = false; 
                                                                                                    if (completionCallback) completionCallback(whichPage); 
                                                                                                    _pageScrollTimer = setTimeout(function() { _pageScrollDelay = false; _onMouseMove(false); }, 400);
                                                                                                  } );
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
    
    //put up to gLayout.columnCount apps into each page, or as many as we have
    var a=0;
    var maxAppsInPage = gLayout.columnCount * gLayout.rowCount;
    for (origin in gApps) {
      if (gDashboardState.pages[Math.floor(a/maxAppsInPage)] == undefined) { gDashboardState.pages[Math.floor(a/maxAppsInPage)] = []; }
      gDashboardState.pages[Math.floor(a/maxAppsInPage)][(a % maxAppsInPage)] = gApps[origin].origin32;
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
      gLayout.recomputeLayout();      
          
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
  $('#dashboard').css({width: ((numPages+1) * (gLayout.panelWidth +2)), height: gLayout.panelHeight});

  //add a new empty page at the end
  var nextPage = $("<div/>").addClass("page").attr("id", "page" + numPages);
  $("#dashboard").append(nextPage);
  nextPage.css({width: gLayout.panelWidth, height: gLayout.panelHeight});
}


//create the full app list, and sort them for display
// here is also where I cache the base32 version of the origin into the app
function layoutPages() {
  if (!gApps) return;
  //clear the list
  $('.page').remove();
  
  var numPages = gDashboardState.pages.length;
  $('#dashboard').css({width: (numPages * (gLayout.panelWidth +2)), height: gLayout.panelHeight});
  
  //now for each page, build zero or more icon items, and put them into the page
  for (var p = 0; p < numPages; p++) {
    //add the page div
    var nextPage = $("<div/>").addClass("page").attr("id", "page" + p);
    
    $("#dashboard").append(nextPage);
    nextPage.css({width: gLayout.panelWidth, height: gLayout.panelHeight});

    //put the apps in, used the cached items if we have them
    for (var a = 0; a < gDashboardState.pages[p].length; a++) {
        
        if (gDashboardState.pages[p][a]) {  //some slots contain undefined
          if (gAppItemCache[gDashboardState.pages[p][a]] == undefined)
          {
            gAppItemCache[gDashboardState.pages[p][a]] = createAppItem( findInstallForOrigin32(gDashboardState.pages[p][a]) );
          }
          
          var thisApp = gAppItemCache[gDashboardState.pages[p][a]];
          nextPage.append(thisApp);
          var pos = positionForSlot(a);
          thisApp.css({left: pos.left, top: pos.top});
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
  appDisplayFrame.css({width: gLayout.appBoxWidth, height: gLayout.appBoxHeight});
  
  //helpers
  var borders = gLayout.appBorderSize * 2;
  var wrapperSize = gLayout.appIconSize + borders;
  var heightRem = gLayout.appBoxHeight - (wrapperSize + gLayout.appNameFontSize);
  var widthRem = gLayout.appBoxWidth - wrapperSize;
  
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

  clickyIcon.css({width: gLayout.appIconSize, 
                  height: gLayout.appIconSize, 
                  margin: gLayout.appBorderSize,
                                    
                  "-moz-border-radius": (gLayout.appIconSize/6) + "px",
	                "-webkit-border-radius": (gLayout.appIconSize/6) + "px",
	                "border-radius": (gLayout.appIconSize/6) + "px"

                  });

  var iconImg = getBigIcon(install.manifest);
  
  var appIcon = $("<img width='" + gLayout.appIconSize + "' height='" + gLayout.appIconSize + "'/>");
  
  if (iconImg.indexOf('/') === 0) {
    appIcon.attr('src', install.origin + iconImg);  
  } else {
    appIcon.attr('src', iconImg);  
  }
 
  clickyIcon.append(appIcon);
  
  iconWrapper.append(clickyIcon);
  appDisplayFrame.append(iconWrapper);

  var appName = $("<div/>").addClass("appLabel");
  appName.css({width: gLayout.appNameSize, 
              "font-size":  gLayout.appNameFontSize});

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

  document.addEventListener("touchstart", function(e) {
    if (e.touches && e.touches.length) {
      e.clientX = e.touches[0].clientX;
      e.clientY = e.touches[0].clientY;
      _onMouseDown(e);
    }
  });

  document.addEventListener("touchmove", function(e) {
    if (e.touches && e.touches.length) {
      e.clientX = e.touches[0].clientX;
      e.clientY = e.touches[0].clientY;
      _onMouseMove(e);
    }
  });

  document.addEventListener("touchend", function(e) {
      _onMouseUp(_pageScrollEventObject); //cached last move event

  });


 });


