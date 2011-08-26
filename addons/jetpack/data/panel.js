

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

//layout, which needs to be cleaned up
//contains constants defining the current layout, values computed from them, and methods to alter and retrieve them, as well as update the views
function GridLayout (width, height, columns, rows) { 
                this.panelWidth = width;
                this.panelHeight = height;
                this.rowCount = rows;
                this.columnCount = columns;

                //computed values for the rest, change if you like
                this.itemBoxWidth = Math.floor(this.panelWidth/this.columnCount);
                this.itemBoxHeight = Math.floor(this.panelHeight/this.rowCount);
                this.itemIconSize = Math.floor(Math.min(this.itemBoxWidth, this.itemBoxHeight) * 0.6);
                this.itemBorderSize = Math.max(Math.ceil(this.itemIconSize/12), 2);
                this.itemLabelWidth = Math.floor(this.itemBoxWidth * 0.8);
                this.itemLabelFontSize = Math.max(Math.ceil(this.itemIconSize/6), 10);
              };



/****************************************************************************/



 function IconGrid (name, hostElement, datasource, layout) {
    //used for local storage identification
    this.dashname = name;
    //the jquery object that contains the dash
    this.dashcontainer = hostElement;
    this.dashboard = undefined;  //created on initiliaze
    //object that provides all the information necessary to 
    this.datasource = datasource;
    //object containing all the layout parameters
    this.layout = layout;


    // Singleton instance of the dataset object:
    this.gItems = {};

    this.iconAnimationSpeed = 150;

    //the saved state (grid arrangement, mostly) for the dashboard
    this.dashboardState = {};

    //caches the constructed grid item panes for speed, and to stop poking the network all the time.
    this.gridItemCache = {};


/////////////////////////////////////////////////////////
// mousedown/mouseup click/drag/flick state vars
    //IN GLOBAL COORDINATES
    this._mouseDownX = 0;			// mouse starting position
    this._mouseDownY = 0;
    this._mouseDownTime = 0;

    //LOCAL COORDINATES LEFT OFFSET, used to deternmine what page is in view
    this._dashboardScrollOffsetX;			
    //var _dashOffsetY;  //currently unused, since we don't support vertically scrolling dashboard at the moment
  
    this._appIcon;
    this._pageAnimating = false;
      
    //application dragging/rearranging globals  
    this._mouseDownHoldTimer;  //timer that determines whether we are dragging the app or the dashboard
    this._mouseDragoutTimer;   //timer that retains the mouse for a brief time after they user drags out of the window
    
    this._pageScrollTimer;           //timer that retains the mouse for a brief time after they user drags out of the window
    this._pageScrollDelay = false;   //true if scrolling to new page should wait, false if it can go ahead
    this._pageScrollEventObject;     //sigh, this is a cached event object, used for triggering multi-page scrolls when the user doesn't actually move the mouse.

    //the id of the currently dragged app, or undefined if none
    this._draggedApp;

    //the starting LOCAL coordinates of the dragged app
    this._draggedAppOffsetX;
    this._draggedAppOffsetY;

    //the previous z-height that the dragged app began at
    this._draggedAppOrigZ;
    //the previous slot the currently dragged app was over, used to trigger animations only when the app is moved over
    // a different slot
    this._draggedAppLastSlot;


//////////////////////
this.getCurrentPage = function() {
  var self = this;
  return Math.floor( ( (Math.abs(self.dashboard.position().left))  + (self.layout.panelWidth/2) ) / self.layout.panelWidth);
}

/////////////////////////////////////////////////////////
  this._onMouseDown = function(e)
  {    
    var self = this;
    e.preventDefault();
    self._mouseDownTime = e.timeStamp;
    self._mouseDownHoldTimer = setTimeout(function(evt) {self._onMouseHold(evt);}, 1000, e);
    
    // grab the mouse position
    self._mouseDownX = e.clientX;
    self._mouseDownY = e.clientY;
    //console.log("mousedown: " + e.clientX + " " + e.clientY);
                
    var iconWrapper = $(e.target.parentNode.parentNode);
    
    self._dashboardScrollOffsetX = self.extractNumber(self.dashboard.position().left);
    //_dashOffsetY = self.extractNumber(self.dashboard.position().top);

    if (iconWrapper.hasClass("iconWrapper")) {
            self._appIcon = iconWrapper;
            self._appIcon.addClass("highlighted");
    } 
  }
  
  

  this.extractNumber = function(value)
  {
    var n = parseInt(value, 10);
    return n == null || isNaN(n) ? 0 : n;
  }
  


  //This code computes the (minimal) changes to the initial arrangement that will leave a hole under the 
  // currently dragged item.  The resultant array is used to move the necessary items around in the page.
  this.arrangeAppsOnPageToFit = function(pageIdx, overSlot) {   
    var self = this;
    if (!self.dashboardState.pages[pageIdx]) { console.log("OWA: ERROR!!  non-existent page index: " + pageIdx); return null;} 
    //get a copy of the page in question
    var arrangedPage = self.dashboardState.pages[pageIdx].slice(0);

    //do nothing if the overSlot is empty
    if (arrangedPage[overSlot])
    {  
      //find a hole in the array, so we can slide things over
      // prefer a hole that is to the left of the dragged item, and as close as possible to it, so as to move only the
      // apps that must be moved, and no others.
      // if we are unable to find a hole to the left, then find the closest one to the right of the dragged item.
      // if there are no holes to be found, then use a virtual hole that is off the end of the array to the right.
      //  we will fix the array up after the drop
      var hole = (self.layout.rowCount * self.layout.columnCount);
      var i;
      //try to find a left hole
      for (i=0; i<overSlot; i++) {
        if (!arrangedPage[i]) {
          hole = i;
        }
      }
      //didnt find left hole, look for right
      if (hole == (self.layout.rowCount * self.layout.columnCount)) {
        for (i=(self.layout.rowCount * self.layout.columnCount)-1; i>overSlot; i--) {
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
      //  to animate to left = array slot * self.layout.itemBoxWidth
      var i;
      //NOTE: (self.layout.columnCount+1) here is important!  It pushes the rightmost one off the side of the page, so that it is hidden
      for (i=0; i< (self.layout.rowCount * self.layout.columnCount)+1; i++) {
      if (arrangedPage[i]) {

          var pos = self.positionForSlot(i);

          if ((self.gridItemCache[arrangedPage[i]].position().left != pos.left) || (self.gridItemCache[arrangedPage[i]].position().top != pos.top)) {
            self.gridItemCache[arrangedPage[i]].stop(true, false);
            self.gridItemCache[arrangedPage[i]].animate({left: pos.left, top: pos.top}, self.iconAnimationSpeed);
          }
        }
      }
    }

    //return the modified page
    return arrangedPage;
  }
      
  //make sure every appDisplayFrame on the page is where it is supposed to be
  this.redrawPage = function(page, animated) {
    var self = this;
    for (var i=0; i<(self.layout.rowCount * self.layout.columnCount); i++) {
      if (self.dashboardState.pages[page][i]){
        var pos = self.positionForSlot(i);
        if (animated) {
          self.gridItemCache[self.dashboardState.pages[page][i]].css({left: pos.left, top: pos.top}, self.iconAnimationSpeed);
        } else {
          self.gridItemCache[self.dashboardState.pages[page][i]].animate({left: pos.left, top: pos.top});
        }
      }
    }
  }



  this.fixUpPageOverflows = function(startPage) {
    var self = this;
    //loop over all the pages, starting at the first, (or maybe the one we just dropped on?) and
    // check to make sure none of the apps have run off the end of the page.  if so, then shove them onto the next page,
    // and keep going, until we get to the end, or a page that doesn't need to be fixed
    //Then, when we are all done, remove any trailing pages that are empty
    var p, t;
    var numPages = self.dashboardState.pages.length;

    var pageSize = self.layout.columnCount * self.layout.rowCount;

    for (p=startPage; p<numPages; p++) {
      if (self.dashboardState.pages[p][pageSize]) { //overflow
        //push the app into slot 0 of the next page, and then see if that causes a ripple
        if (!self.dashboardState.pages[p+1]) self.dashboardState.pages[p+1] = [];  //make a new empty page if there isn't one
        //check to see if we have to move things over
        if (self.dashboardState.pages[p+1][0]) {
          //must shove them all over 1 to make room
          for (t=pageSize; t>0; t--) {
            self.dashboardState.pages[p+1][t] = self.dashboardState.pages[p+1][t-1];
          }
        }
        //push the app into the empty slot in the next page
        self.gridItemCache[self.dashboardState.pages[p][pageSize]].detach();
        $("#page" + (p+1)).append(self.gridItemCache[self.dashboardState.pages[p][pageSize]]);

        self.dashboardState.pages[p+1][0] = self.dashboardState.pages[p][pageSize];  
        self.dashboardState.pages[p][pageSize] = undefined;
        self.redrawPage(p+1);
      }
    }

    var emptyish;
    //remove empty trailing pages.  this must be the last code in this function, since we return from the middle of it
    for (p=numPages-1; p>0; p--) {
      emptyish = true;
      if (self.dashboardState.pages[p].length) {
        for (var t=0; t<self.dashboardState.pages[p].length; t++){
          if (self.dashboardState.pages[p][t]) emptyish = false;
        }
      }

      if (emptyish) {
        $("#page" + p).remove();
        self.dashboardState.pages.length--;
      }
      else return;
    }
  }


  //finds the nearest slot for a given set of LOCAL coordinates
  this.slotForPosition = function(left, top) {
      var self = this;
      var currentSlot = Math.floor((left + (self.layout.itemBoxWidth/2)) / self.layout.itemBoxWidth);
      //add on the rows
      currentSlot += self.layout.columnCount * Math.floor((top + (self.layout.itemBoxHeight/2)) / self.layout.itemBoxHeight);

      if (currentSlot < 0) currentSlot = 0;
      if (currentSlot > (self.layout.columnCount * self.layout.rowCount)-1 ) { currentSlot = (self.layout.columnCount * self.layout.rowCount)-1; }

      return currentSlot;
  }


  //returns the coordinates for a given slot
  this.positionForSlot = function(s) {
    var self = this;
    var slotLeft = self.layout.itemBoxWidth * (s % self.layout.columnCount);
    var slotTop = Math.floor(s/self.layout.columnCount) * self.layout.itemBoxHeight;

    return {left: slotLeft, top: slotTop};
  }

      
  this._onMouseMove = function(e)
  {
    var self = this;
    //slightly hokey caching of last mousemove event (the position is what we care about) for the case 
    // when you want to scroll multiple pages, without having to wiggle the mouse
    if (e) {
      self._pageScrollEventObject = e;
    } else {
      e = self._pageScrollEventObject;
    }

    e.preventDefault();
    if (self._mouseDownTime == 0) { return; }

    //give the user some forgiveness when pressing and holding. if they only move a couple of pixels, we will stillcount it as a hold.
    if (self._mouseDownHoldTimer) {
      if (Math.abs(e.clientX - self._mouseDownX) > 4 || Math.abs(e.clientY - self._mouseDownY) > 4) {
        clearTimeout(self._mouseDownHoldTimer);
        self._mouseDownHoldTimer = undefined;
      }
      else return;
    }

    var curPage = self.getCurrentPage();
    
    //this is the -app- dragging code, which manages the necessary animations, the underlying data changes, and the possible paging to a different
    // dashboard page while carrying an app
    if (self._draggedApp) {
      //we are moving the appDisplayFrame from one coordinate system to another, so we need to computer an offset, so it doesn't jump away from the cursor
      var containerOffsetLeft = self.dashcontainer.offset().left;
      var containerOffsetTop = self.dashcontainer.offset().top;

      //this is the icon dragging code
      //I need to do all the snapping, rearranging the other apps on the page, etc here

      //don't ]et the app be dragged outside the clipping frame
      var dragOutAmount = Math.floor((self.layout.itemBoxWidth - ((self.layout.itemBorderSize * 2) + self.layout.itemIconSize))/2) - 1; //frame padding

      //figure out if they are pushing against the side and want to scroll the page
      var paging = 0;
      if (self.gridItemCache[self._draggedApp].position().left <= -dragOutAmount) paging = -1;
      if ((self.gridItemCache[self._draggedApp].position().left - dragOutAmount + self.layout.itemBoxWidth) >= self.layout.panelWidth) paging = 1;

      //keep the app inside the dash
      var newLeft = Math.min( Math.max( (self._draggedAppOffsetX + e.clientX - self._mouseDownX), -dragOutAmount), (self.layout.panelWidth + dragOutAmount - self.layout.itemBoxWidth));  
      var newTop = Math.min( Math.max( (self._draggedAppOffsetY + e.clientY - self._mouseDownY), 0), (self.layout.panelHeight - self.layout.itemBoxHeight));

      //keep it from going outside the dashboard
      self.gridItemCache[self._draggedApp].css({left: newLeft, top: newTop});
      //console.log("OWA app coords: " + newLeft + " " + newTop);

      // figure out which slot we are above
      // if it's empty, do nothing
      var currentSlot = self.slotForPosition(self.gridItemCache[self._draggedApp].position().left, self.gridItemCache[self._draggedApp].position().top);

      //this is the paging code that is triggered when you are carrying an app and then push against the side of the screen.
      // we go to the next page in that direction, if there is one
      if (paging != 0) {
        //console.log("paging to the " + paging==1?"right":"left");

        self._draggedAppLastSlot = undefined;
        if (!self._pageScrollDelay) {
                var resultantPage = self.goToPage(curPage+paging, 400, function(page) {
                                                //need to put the page we left back the way it was
                                                if (curPage != page) self.redrawPage(curPage);
                                                self.arrangeAppsOnPageToFit(page, currentSlot);
                                              });
        }
      }
      //otherwise, if they are over a new slot than they were last time, we animate the icons on the page into the proper configuration      
      else if (currentSlot != self._draggedAppLastSlot) {      
        self._draggedAppLastSlot = currentSlot;
        //now call the magic function that, given you are holding the lifted app over slot N, 
        // what the arrangement of the other apps in the page should be.
       self.arrangeAppsOnPageToFit(curPage, self._draggedAppLastSlot);
        
      }      
    } else {
      // this is the -dashboard- scrolling code, when the user grabs the dash and pulls it one way or the other
      var newPos = (self._dashboardScrollOffsetX + e.clientX - self._mouseDownX) + 'px';
  
      self.dashboard.css("left", newPos);
      
      if (self._appIcon != undefined) {
        self._appIcon.removeClass("highlighted");
        self._appIcon = undefined;
      }
    }
  }
  
  //let's actually lift the app up and out of the page, and attach it to the dashcontainer, so
  // we can move it around between pages if necessary
  this._onMouseHold = function(e) {
    var self = this;
    //keep track of the id of the app we are dragging.  this is also used as a flag to tell us we are dragging
    self._draggedApp = $(e.target.parentNode).attr("guid");
    //check to be sure we have one
    if (self._draggedApp) {
      self._appIcon.removeClass("highlighted");
      self._appIcon.addClass("liftedApp");
      
      self._draggedAppOffsetX = self.extractNumber(self.gridItemCache[self._draggedApp].position().left);
      self._draggedAppOffsetY = self.extractNumber(self.gridItemCache[self._draggedApp].position().top);

      var startSlot = self.slotForPosition(self._draggedAppOffsetX, self._draggedAppOffsetY)
      
      //remove the app from the page it started on
      self.dashboardState.pages[self.getCurrentPage()][startSlot] = undefined;
      //lift it up
      self._draggedAppOrigZ = self.gridItemCache[self._draggedApp].css('z-index');

      //remove it from the page it was in and attach it to the dashcontainer instead
      self.gridItemCache[self._draggedApp].css('z-index', 10000);
      self.gridItemCache[self._draggedApp].detach();
      self.dashcontainer.append(self.gridItemCache[self._draggedApp]);

      //temporarily add an extra blank page at the end, in case the user wants to spread things out
      self.addEmptyPageToDash();
    }
  }


  
  this._onMouseLeave = function(e) {
    var self = this;
    //for now, just treat it as a mouse up
    if (self._mouseDownTime == 0) { return; }
    if (self._draggedApp) {
      self._mouseDragoutTimer = setTimeout(function(evt) {self._onMouseUp(evt)}, 410, e);
    } else {
      self._onMouseUp(e);
    }
  }
    

  this._onMouseEnter = function(e) {
    var self = this;
    clearTimeout(self._mouseDragoutTimer);
  }

  
  
  this._onMouseUp = function(e)
  {    
    var self = this;
    clearTimeout(self._mouseDownHoldTimer);
    self._mouseDownHoldTimer = undefined;

    e.preventDefault();
    var curPage = self.getCurrentPage();
    //console.log("OWA: MOUSE UP!");

    if (self._draggedApp) {

      //user dropped the app on some page, not necessarily the one it originated on
      // * we need to fix the originating page, by removing the app from it
      // * we need to insert the app into the new page, (which might be the same page), with fixups
      //    - if page was full before dropping, then all apps afterwards need to be shifted over, possibly changing every page afterward 
      
      //remove the drag highlighting  
      self._appIcon.removeClass("liftedApp");
      self._appIcon = undefined;
      
      //get the correct arrangement of the current (dropped on) page
      var currentSlot = self.slotForPosition(self.gridItemCache[self._draggedApp].position().left, self.gridItemCache[self._draggedApp].position().top);

      var rearrangedApps = self.arrangeAppsOnPageToFit(curPage, currentSlot);
      //insert the app into the empty slot it is over, on the current page
      rearrangedApps[currentSlot] = self._draggedApp;
      //console.log("OWA: DROPPED " + self._draggedApp + " IN SLOT " + currentSlot + " ON PAGE " + curPage)
      
      //overwrite the page in the dashboard state with the newly arranged page
      self.dashboardState.pages[curPage] = rearrangedApps;
      //DO LOTS OF FIXUP!!

      self.fixUpPageOverflows(curPage);

      //save the changes
      self.saveIconGridState(self.dashboardState);

      //remove the appDisplayFrame from the dashcontainer
      self.gridItemCache[self._draggedApp].detach();
      //insert the appDisplayFrame into the current page
      $("#page" + curPage).append(self.gridItemCache[self._draggedApp]);
      
      //animate the appdisplayframe to the correct position and z-index
      var pos = self.positionForSlot(currentSlot);
      self.gridItemCache[self._draggedApp].animate({left: pos.left, top: pos.top}, self.iconAnimationSpeed);
      self.gridItemCache[self._draggedApp].css('z-index', self._draggedAppOrigZ);
      
      //stop dragging 
      self._draggedApp = undefined; 
      
    } else {
      //dragged the dashboard
  
      //they dragged or flicked the dash, or launched an app
      var _endX, _endY;
      
      _endX = e.clientX;
      _endY = e.clientY;
    
      var quick = (e.timeStamp - self._mouseDownTime < 200);
      var small = Math.abs(_endX - self._mouseDownX) < 10;
      
      var flick = quick && !small;
      var tap =  small;
      var drag = !quick;
        
      if (tap && (self._appIcon != undefined)) {
        //console.log("OWA: app launched");
        self._appIcon.removeClass("highlighted");
        self._appIcon = undefined;
  
        var guid = $(e.target.parentNode).attr("guid");
        datasource.openItem(Base32.decode(guid));

      } else if (flick) {
        //we go to the next page in the direction specified by the flick
                  
        //left or right?
        var dir = (_endX - self._mouseDownX) > 0;
  
        if (!dir) {
          curPage ++; 
        } else {
          curPage --;
        }
            
        self.goToPage(curPage, 250);
    
      } else { //drag, which may or may not go to the next page
        //console.log("OWA: dashboard dragged");
        
        var snapPage = curPage;
        
        if (self.dashboard.position().left < 0) {
            var offset = Math.abs(self.dashboard.position().left);
            var remainder = offset - (curPage * self.layout.panelWidth);
            
            if ( remainder > Math.floor(self.layout.panelWidth / 2) ) {
              snapPage++;
            }
        }
        self.goToPage(snapPage, 350);
      }
    }
               
    self._mouseDownTime = 0;
  }
  
    
  
  this.goToPage = function(whichPage, animationSpeed, completionCallback) {
    var self = this;
    var numPages = self.dashboardState.pages.length;
    if (whichPage >= numPages)  whichPage = numPages - 1;
    if (whichPage < 0) whichPage = 0;
    var finalPos = (whichPage * self.layout.panelWidth * -1);
    
    if ( (self.dashboard.position().left != finalPos) && (!self._pageAnimating) ) {
      self._pageAnimating = true;
      self._pageScrollDelay = true;  //used by the auto-scrolling code to prevent rapid scrolling across many pages
      self.dashboard.animate({left: (whichPage * self.layout.panelWidth * -1) }, animationSpeed, function() {
                                                                                                    self._pageAnimating = false; 
                                                                                                    if (completionCallback) completionCallback(whichPage); 
                                                                                                    self._pageScrollTimer = setTimeout(function() { self._pageScrollDelay = false; self._onMouseMove(false); }, 400);
                                                                                                  } );
    } 
    return whichPage;
  }
  
  
  




///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// DATA MANAGEMENT AND UPDATE CODE

/*
  There are three moving parts to worry about:  The Dataset (list of currently installed apps), The DashboardState (a two-dimensional arrangement of references to items in the Dataset),
  and the DisplayCache (a keyed object containing visual representations of every item in the DashboardState)

  1) Poll or get notified that the dataset may have changed
  2) For every item in the DashboardState, if it does not appear in the Dataset, remove it from the DashboardState.  
      Also remove the corresponding item from the DisplayCache, and from the Page it was displayed on.
  3) For every item in the Dataset, if it does not appear in the DashboardState, then add it into the DashboardState, in the first empty slot.  
      Also generate the DisplayCache item, store it, and add it to the corresponding Page.
  4) Recompute the this.layout parameters. 
  5) (Done?)

*/



  this.refresh = function() {
    var self = this;
    //ask the datasource for the freshest grid state, and provide a callback to call when it is ready
    self.datasource.loadIconGridState( function(state) { self.receivedIconGridState(state); }   );
  }

  //this is the function called by both the navigator.apps callback or the jetpack callback when the dashboard state loads
  // we immediately turn around and load the app list.
  this.receivedIconGridState = function(newState) {
    var self = this;
    if (newState) self.dashboardState = newState;
    if (!self.dashboardState.pages) self.dashboardState.pages = [];
    self.datasource.getItemList( function(theList) { self.refreshGrid(theList); } );
  }


  //the dataset can use whatever it likes for guids, as long as they are really unique.
  // I encode them so they are usable as dom IDs
  this.refreshGrid = function(dataset) {
    var self = this;
    //I cant be sure that the guids provided are suitable for dom IDs, so I'll base32 encode them
    var newSet = {};
    for (id in dataset) newSet[Base32.encode(id)] = dataset[id];
    dataset = newSet;



    //first delete items that have been removed from the dataset
    var p,s;
    self.gItems = {};

    if (!self.dashboardState.pages) self.dashboardState.pages = [];

    //record the ones we had last time
    for (p=0; p<self.dashboardState.pages.length; p++) {
      for (s=0; s<self.layout.rowCount * self.layout.columnCount; s++) {
        var guid = self.dashboardState.pages[p][s];
        if (guid) {
          self.gItems[guid] = {slot: [p, s]};  //remember where we found it
          //console.log("found old app at: " + p + " " + s);
        }
      }
    }

    //overlay the ones we have now
    for (guid in dataset) {
      self.gItems[guid] = dataset[guid]; 
      //console.log("found new app: " + guid);
    }

    //remove the ones that are still marked with their former positions
    for (guid in self.gItems) {
      //check to see if it was deleted
      var slot = self.gItems[guid].slot;
      if (slot) {
        //console.log("found deleted app: " + guid + " " + self.gItems[guid].slot);
        //remove it from everywhere
        self.gItems[guid] = undefined;
        self.dashboardState.pages[slot[0]][slot[1]] = undefined;
        if (self.gridItemCache[guid]) {
          //remove the objects from the dom
          self.gridItemCache[guid].remove();
          //remove the slot from the cache
          delete self.gridItemCache[guid];
        }
      }
    }

    //fill in the stuff for existing ones
    for (p=0; p<self.dashboardState.pages.length; p++) {

      if ($("#page" + p).length == 0) { //results are an array, so zero length means non existence
        var nextPage = $("<div/>").addClass("page").attr("id", "page" + p);
        self.dashboard.append(nextPage);
        nextPage.css({width: self.layout.panelWidth, height: self.layout.panelHeight});
      }

      for (s=0; s<self.layout.rowCount * self.layout.columnCount; s++) {
        var guid = self.dashboardState.pages[p][s];

        if (guid && !self.gridItemCache[guid]) {
          self.gridItemCache[guid] = self.createGridItem(guid);
          var pos = self.positionForSlot(s);
          self.gridItemCache[guid].css({left: pos.left, top: pos.top});
          $('#page' + p).append(self.gridItemCache[guid]);
        }
      }
      self.dashboard.css({width: (self.dashboardState.pages.length * (self.layout.panelWidth +2)), height: self.layout.panelHeight});
    }

    //now add in  all the ones that are missing
    // and create the DisplayCache items for them, and find a place in a page for them to live
    for (guid in self.gItems) {
      if (!self.gridItemCache[guid]) {
        self.gridItemCache[guid] = self.createGridItem(guid);
        self.insertNewItemIntoDash(guid);
      }
    }
      
    self.saveIconGridState(self.dashboardState);
  }


  this.insertNewItemIntoDash = function(guid) {
    var self = this;
    //iterate through the pages, looking for the first empty slot.  create new pages if necessary
    p = 0;
    s = 0;
    var complete = false;

    while (!complete) {
      if (!self.dashboardState.pages[p]) self.addEmptyPageToDash();

      for (s=0; s< (self.layout.columnCount * self.layout.rowCount); s++) {
        if (!self.dashboardState.pages[p][s]) {
          self.dashboardState.pages[p][s] = guid;
          var pos = self.positionForSlot(s);
          self.gridItemCache[guid].css({left: pos.left, top: pos.top});
          $('#page' + p).append(self.gridItemCache[guid]);
          complete = true;
          break;
        }
      }
      p++;
    }
  }


  this.addEmptyPageToDash = function() {
    var self = this;
    var numPages = self.dashboardState.pages.length;

    //add empty page to dash state array
    self.dashboardState.pages[numPages] = [];

    //grow the dashboard
    self.dashboard.css({width: ((numPages+1) * (self.layout.panelWidth +2)), height: self.layout.panelHeight});

    //add a new empty page at the end
    var nextPage = $("<div/>").addClass("page").attr("id", "page" + numPages);
    self.dashboard.append(nextPage);
    nextPage.css({width: self.layout.panelWidth, height: self.layout.panelHeight});
  }


  this.saveIconGridState = function(state) {
    var self = this;
    self.datasource.saveIconGridState(state);
  }


  this.createGridItem = function(guid)
  {
    var self = this;
    //look it up
    var theItem = self.gItems[guid];

    var appDisplayFrame = $("<div/>").addClass("appDisplayFrame");
    appDisplayFrame.css({width: self.layout.itemBoxWidth, height: self.layout.itemBoxHeight});
    
    //helpers
    var borders = self.layout.itemBorderSize * 2;
    var wrapperSize = self.layout.itemIconSize + borders;
    var heightRem = self.layout.itemBoxHeight - (wrapperSize + self.layout.itemLabelFontSize);
    var widthRem = self.layout.itemBoxWidth - wrapperSize;
    
    var iconWrapper = $("<div/>").addClass("iconWrapper").css({width: wrapperSize, 
                                                                height: wrapperSize,
                                                                marginTop: (heightRem/2) + "px", 
                                                                marginBottom: "0px",
                                                                marginLeft: (widthRem/2) + "px",
                                                                marginRight: (widthRem/2) + "px", 
                                                                "border-radius": (wrapperSize/6) + "px"
                                                                });
    
    var clickyIcon = $("<div/>").addClass("icon");
    clickyIcon.attr("guid", guid);

    clickyIcon.css({width: self.layout.itemIconSize, 
                    height: self.layout.itemIconSize, 
                    margin: self.layout.itemBorderSize,
                                      
                    "-moz-border-radius": (self.layout.itemIconSize/6) + "px",
                    "-webkit-border-radius": (self.layout.itemIconSize/6) + "px",
                    "border-radius": (self.layout.itemIconSize/6) + "px"

                    });

    //first see if the item itself has an 'imgURL'
    var imgURL = theItem.itemImgURL;
    //if it doesn't, ask the datasource for it
    if (!imgURL && datasource.getItemImgURL) {
      imgURL = datasource.getItemImgURL(Base32.decode(guid));
    }
    //if we still don't have one, use a generic gray icon as a placeholder
    if (!imgURL) {
      imgURL = "data:image/png;base64,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";

    } 
       
    var appIcon = $("<img width='" + self.layout.itemIconSize + "' height='" + self.layout.itemIconSize + "'/>");
    appIcon.attr('src', imgURL);  
   
    clickyIcon.append(appIcon);
    
    iconWrapper.append(clickyIcon);
    appDisplayFrame.append(iconWrapper);

    var appName = $("<div/>").addClass("appLabel");
    appName.css({width: self.layout.itemLabelWidth, 
                "font-size":  self.layout.itemLabelFontSize});

    var itemTitle = theItem.itemTitle;
    if (!itemTitle && datasource.getItemTitle) {
      itemTitle = datasource.getItemTitle(Base32.decode(guid));
    }
    if (!itemTitle) itemTitle = "";

    appName.text(itemTitle);  
    appDisplayFrame.append(appName);
                            

    return appDisplayFrame;
  }





  this.initialize = function() {
    var self = this;
    self.dashboard = $("<div/>").addClass("dashboard");
    self.dashboard.css({width: self.layout.panelWidth, height: self.layout.panelHeight});

    self.dashcontainer.css({clip: "rect( 0px, " + self.layout.panelWidth + "px, " + self.layout.panelHeight + "px, 0px)"});
    self.dashcontainer.append(self.dashboard);

    self.dashcontainer.mousedown(function(evt) { self._onMouseDown(evt); });
    self.dashcontainer.mouseup(function(evt) { self._onMouseUp(evt); });
    self.dashcontainer.mousemove(function(evt) { self._onMouseMove(evt); });
    self.dashcontainer.mouseleave(function(evt) { self._onMouseLeave(evt); });
    self.dashcontainer.mouseenter(function(evt) { self._onMouseEnter(evt); });

    document.addEventListener("contextmenu", function(e) {
      e.preventDefault();
    }, true);

    document.addEventListener("touchstart", function(e) {
      if (e.touches && e.touches.length) {
        e.clientX = e.touches[0].clientX;
        e.clientY = e.touches[0].clientY;
        function(e) { self._onMouseDown(e); }
      }
    }, false);

    document.addEventListener("touchmove", function(e) {
      if (e.touches && e.touches.length) {
        e.clientX = e.touches[0].clientX;
        e.clientY = e.touches[0].clientY;
        function(e) { self._onMouseMove(e); }
      }
    }, false);

    document.addEventListener("touchend", function(e) {
      //cached last move event
      function(e) { self._onMouseUp(self._pageScrollEventObject); }
    }, false);


  }

}



///////////////////////////////////////////////////////////////////////////////////////

var html_datasource;
var myLayout;
var myDash;

function onfocus(event)
{
  myDash.refresh();
}

$(document).ready(function() {
   html_datasource = {

    gridCallback: undefined,

    //handle requests for the dashboardstate
    loadIconGridState: function(callback) {
      navigator.apps.mgmt.loadState(callback);
    },

    saveIconGridState: function(state) {
      navigator.apps.mgmt.saveState(state);
    },

    annotateAppList: function(appList) {
      var id;
      for (id in appList) {
        var item = appList[id];
        this.annotateApp(item);
      };
      //add in special one
      appList["about:apps"] = {};
      this.gridCallback(appList);
    },

    getItemList: function(callback) {
      var self = this;
      self.gridCallback = callback;
      navigator.apps.mgmt.list( function(theApps) { self.annotateAppList(theApps)});
    },

    openItem: function(itemID) {
      if (itemID == "about:apps") {  //I'm not allowed to open about:apps.  so sad.
         window.open("http://www.valdosta.edu/~mkstrickland/sad_face.jpg");
      } else {
        navigator.apps.mgmt.launch(itemID);
      }
    },

    annotateApp: function(anApp) {
      anApp.itemTitle = anApp.manifest.name;

      var imgURL;
      var z, size, bigSize = 0;

      //return biggest icon for now
      if (anApp.manifest.icons) {    
        for (z in anApp.manifest.icons) {
          size = parseInt(z, 10);
          if (size > bigSize) bigSize = size;
        }
        if (bigSize !== 0) imgURL = anApp.manifest.icons[bigSize];
      }

      if (imgURL && imgURL.indexOf('/') === 0) { imgURL = anApp.origin + imgURL;}

      anApp.itemImgURL = imgURL;

    },

    //if all your items have 'imgURL' and 'itemTitle' properties, then you don't need to implement these.  These get called when an item doesn't have the right properties.
     getItemImgURL: function(itemID) {if (itemID == "about:apps") return "data:image/png;base64,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" },
     getItemTitle: function(itemID) { return "App Settings"; },

  };


  var hostElement = $("#clipper");
  myLayout = new GridLayout(hostElement.width(), hostElement.height(), 4, 4);
  myDash = new IconGrid("mydash", hostElement, html_datasource, myLayout);

  myDash.initialize();
  myDash.refresh();

});








//panel related port code

//launch
        // if (self && self.port) {
        //   self.port.emit("launch", Base32.decode(guid));
        // } else {
        //   navigator.apps.mgmt.launch(Base32.decode(guid));
        // }


//save dash state
  // if (self && self.port) {
  //   self.port.emit("saveState", state);
  // } else {
  //   navigator.apps.mgmt.saveState(self.dashboardState, function() {console.log("OWA: dashboard state saved");} );
  // }

//get dashstate

// //this callback is installed only if we are in a jetpack, and is called from this.dashboardRefresh above
// if (self && self.port) {
//   self.port.on("theState", receivedNewDashboardState);
// }




  //First get the dashboard state, if there is one.  
  // this code works for regular window and jetpack panel
  // if (self && self.port) {
  //   self.port.emit("loadState");
  // } else {
  //   navigator.apps.mgmt.loadState(receivedNewDashboardState);
  // }




//refresh list callbacks
  // if (self && self.port) {
  //   self.port.emit("getList");
  // } else {
  //   navigator.apps.mgmt.list( function (allApps) { interimRekeyDataset(allApps) });
  // }


// //this callback is installed only if we are in a jetpack, and is called from receivedNewDashboardState above
// if (self && self.port) {
//   self.port.on("theList", interimRekeyDataset);
// }

