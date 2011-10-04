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

// layout, which needs to be cleaned up
// contains constants defining the current layout, values computed from them,
// and methods to alter and retrieve them, as well as update the views
function GridLayout(width, height, columns, rows) {
  this.containerWidth = width;
  this.containerHeight = height;
  this.panelWidth = this.containerWidth;
  this.pageindicatorWidth = this.containerWidth;
  //don't make the page indicators too big or too small
  this.pageindicatorHeight = Math.min(Math.max(this.containerHeight * 0.7, 14), 20);

  this.panelHeight = this.containerHeight - this.pageindicatorHeight;

  this.rowCount = rows;
  this.columnCount = columns;

  //computed values for the rest, change if you like
  this.itemBoxWidth = Math.floor(this.panelWidth / this.columnCount);
  this.itemBoxHeight = Math.floor(this.panelHeight / this.rowCount);
};


/****************************************************************************/


function IconGrid(name, hostElement, datasource, layout) {
  
  this.CURRENT_PAGE = 0;
  // used for local storage identification
  this.dashname = name;
  // the jquery object that contains the dash
  this.dashcontainer = hostElement;
  this.dashboard = undefined; //created on initiliaze
  // object that provides all the information necessary to 
  this.datasource = datasource;
  // object containing all the layout parameters
  this.layout = layout;

  // Singleton instance of the dataset object:
  this.gItems = {};
  this.iconAnimationSpeed = 150;

  //the saved state (grid arrangement, mostly) for the dashboard
  this.dashboardState = {};

  //scratch copies of pages used to move the icons around without altering the original config, 
  // allowing 'cancel', which happens when you drag though a page to somewhere else, and we have to reset it
  this.scratchPages = [];
  //where icons are being animated to at this moment
  this.inflightPages = [];

  //caches the constructed grid item panes for speed, and to stop poking the network all the time.
  this.gridItemCache = {};

  /////////////////////////////////////////////////////////
  // mousedown/mouseup click/drag/flick state vars
  // IN GLOBAL COORDINATES
  this._mouseDownX = 0; // mouse starting position
  this._mouseDownY = 0;
  this._mouseDownTime = 0;

  //LOCAL COORDINATES LEFT OFFSET, used to deternmine what page is in view
  this._dashboardScrollOffsetX;

  //var _dashOffsetY;  //currently unused, since we don't support vertically scrolling dashboard at the moment
  this._appIcon;
  this._appRemover;
  this._pageAnimating = false;

  //application dragging/rearranging globals  
  this._mouseDownHoldTimer; //timer that determines whether we are dragging the app or the dashboard
  this._mouseDragoutTimer; //timer that retains the mouse for a brief time after they user drags out of the window
  this._pageScrollTimer; //timer that retains the mouse for a brief time after they user drags out of the window
  this._pageScrollDelay = false; //true if scrolling to new page should wait, false if it can go ahead
  this.lastMouseEvent; //sigh, this is a cached event object, used for triggering multi-page scrolls when the user doesn't actually move the mouse.
  
  // the id of the currently dragged app, or undefined if none
  this._draggedApp;

  // the starting LOCAL coordinates of the dragged app
  this._draggedAppOffsetX;
  this._draggedAppOffsetY;

  // the previous z-height that the dragged app began at
  this._draggedAppOrigZ;
  // the previous slot the currently dragged app was over, used to trigger animations only when the app is moved over
  // a different slot
  this._draggedAppLastSlot;
};

IconGrid.prototype = {
  /////////////////////////////////////////////////////////
  getCurrentPage: function () {
    return this.CURRENT_PAGE;
  },

  /////////////////////////////////////////////////////////
  _onMouseDown: function (e) {
    //console.log("mouse down");
    e.preventDefault();
    var self = this;

    self._mouseDownTime = e.timeStamp;

    // grab the mouse position
    self._mouseDownX = e.clientX;
    self._mouseDownY = e.clientY;
    var iconWrapper = $(e.target.parentNode);

    self._dashboardScrollOffsetX = self.extractNumber(self.dashboard.position().left);

    if (iconWrapper.hasClass("icon")) {
      //start the timer
      self._mouseDownHoldTimer = setTimeout(function (evt) {
      self._onMouseHold(evt);
      }, 1000, e);

      self._appIcon = iconWrapper;
      self._appIcon.children(".iconshader").addClass("highlighted");
      self._appRemover = $(e.target.parentNode.parentNode).children(".remover");
    }
  },

  extractNumber: function (value) {
    var n = parseInt(value, 10);
    return n == null || isNaN(n) ? 0 : n;
  },

  // This code computes the (minimal) changes to the initial arrangement that will leave a hole under the 
  // currently dragged item.  The resultant array is used to move the necessary items around in the page.
  arrangeAppsOnPageToFit: function (pageIdx, overSlot) {
    var self = this;

    if (!self.dashboardState.pages[pageIdx]) {
      //console.log("OWA: ERROR!!  non-existent page index: " + pageIdx);
      return null;
    }
    //use scratch pages to avoid allocation while dragging
    if (!self.scratchPages[pageIdx]) self.scratchPages[pageIdx] = [];
    if (!self.inflightPages[pageIdx]) self.inflightPages[pageIdx] = [];

    var i;
    for (i=0; i<(self.layout.rowCount * self.layout.columnCount); i++ )
      self.scratchPages[pageIdx][i] = self.dashboardState.pages[pageIdx][i];

    var arrangedPage = self.scratchPages[pageIdx];

    //var arrangedPage = self.dashboardState.pages[pageIdx].slice(0);

    //do nothing if the overSlot is empty
    if (arrangedPage[overSlot]) {
      //find a hole in the array, so we can slide things over
      // prefer a hole that is to the left of the dragged item, and as close as possible to it, so as to move only the
      // apps that must be moved, and no others.
      // if we are unable to find a hole to the left, then find the closest one to the right of the dragged item.
      // if there are no holes to be found, then use a virtual hole that is off the end of the array to the right.
      //  we will fix the array up after the drop
      var hole = undefined; //(self.layout.rowCount * self.layout.columnCount);
      var i;

      //find the closest hole
      for (i=0; i< (self.layout.rowCount * self.layout.columnCount); i++) {
        if (!arrangedPage[i]) {
          if ((hole == undefined) || (Math.abs(overSlot - i) < Math.abs(overSlot - hole) )) {
            hole = i;
          }
        }
      }

      //if we didn't find one, then it goes off the end
      if (hole  == undefined) hole = (self.layout.rowCount * self.layout.columnCount);

      if (hole < overSlot) { //hole is to the left
        for (i = hole; i < overSlot; i++) {
          arrangedPage[i] = arrangedPage[i + 1];
        }
      } else { //hole is to the right
        for (i = hole; i > overSlot; i--) {
          arrangedPage[i] = arrangedPage[i - 1];
        }
      }

      arrangedPage[overSlot] = undefined;
    }

    // animate all the app icons to move to their correct places
    if (arrangedPage) {
      // now loop over all of the app signatures in the array, and tell each appDisplayFrame (from the cache) 
      // to animate to left = array slot * self.layout.itemBoxWidth
      var i;
      var changed = false;
      var pos;

      // NOTE: (self.layout.columnCount+1) here is important!  It pushes the rightmost one off the side of the page, so that it is hidden
      for (i = 0; i < (self.layout.rowCount * self.layout.columnCount) + 1; i++) {
        changed = false;
        if (arrangedPage[i] != this.inflightPages[pageIdx][i]) changed = true;

          this.inflightPages[pageIdx][i] = arrangedPage[i];
          if (arrangedPage[i] && changed) {
            pos = self.positionForSlot(i);
            self.gridItemCache[arrangedPage[i]].stop(true, false);
            self.gridItemCache[arrangedPage[i]].animate({
              left: pos.left,
              top: pos.top
            }, self.iconAnimationSpeed);
          }
        //}
      }
    }

    // return the modified page
    return arrangedPage;
  },

  // make sure every appDisplayFrame on the page is where it is supposed to be
  redrawPage: function (page, animated) {
    var self = this;
    //clean out the inflight cache pages, so that the page is back to a clean slate
    self.inflightPages[page] = [];
    for (var i = 0; i < (self.layout.rowCount * self.layout.columnCount); i++) {
      if (self.dashboardState.pages[page][i]) {
        var pos = self.positionForSlot(i);
        if (animated) {
          self.gridItemCache[self.dashboardState.pages[page][i]].css({
            left: pos.left,
            top: pos.top
          }, self.iconAnimationSpeed);
        } else {
          self.gridItemCache[self.dashboardState.pages[page][i]].animate({
            left: pos.left,
            top: pos.top
          });
        }
      }
    }
  },

  fixUpPageOverflows: function (startPage) {
    var self = this;

    // loop over all the pages, starting at the first, (or maybe the one we just dropped on?) and
    // check to make sure none of the apps have run off the end of the page.  if so, then shove them onto the next page,
    // and keep going, until we get to the end, or a page that doesn't need to be fixed
    // Then, when we are all done, remove any trailing pages that are empty
    var p, t;
    var numPages = self.dashboardState.pages.length;

    var pageSize = self.layout.columnCount * self.layout.rowCount;

    for (p = startPage; p < numPages; p++) {
      if (self.dashboardState.pages[p][pageSize]) { //overflow
        //push the app into slot 0 of the next page, and then see if that causes a ripple
        if (!self.dashboardState.pages[p + 1]) self.dashboardState.pages[p + 1] = []; //make a new empty page if there isn't one
        //check to see if we have to move things over
        if (self.dashboardState.pages[p + 1][0]) {
          //must shove them all over 1 to make room
          for (t = pageSize; t > 0; t--) {
            self.dashboardState.pages[p + 1][t] = self.dashboardState.pages[p + 1][t - 1];
          }
        }
        //push the app into the empty slot in the next page
        self.gridItemCache[self.dashboardState.pages[p][pageSize]].detach();
        $("#page" + (p + 1)).append(self.gridItemCache[self.dashboardState.pages[p][pageSize]]);

        self.dashboardState.pages[p + 1][0] = self.dashboardState.pages[p][pageSize];
        self.dashboardState.pages[p][pageSize] = undefined;
        self.redrawPage(p + 1);
      }
    }

    var emptyish;
    //remove empty trailing pages.  this must be the last code in this function, since we return from the middle of it
    for (p = numPages - 1; p > 0; p--) {
      emptyish = true;
      if (self.dashboardState.pages[p].length) {
        for (var t = 0; t < self.dashboardState.pages[p].length; t++) {
          if (self.dashboardState.pages[p][t]) emptyish = false;
        }
      }

      if (emptyish) {
        $("#page" + p).remove();
        self.dashboardState.pages.length--;
      } else return;
    }
  },

  // finds the nearest slot for a given set of LOCAL coordinates
  slotForPosition: function (left, top) {
    var self = this;
    var currentSlot = Math.floor((left + (self.layout.itemBoxWidth / 2)) / self.layout.itemBoxWidth);

    // add on the rows
    currentSlot += self.layout.columnCount * Math.floor((top + (self.layout.itemBoxHeight / 2)) / self.layout.itemBoxHeight);

    if (currentSlot < 0) currentSlot = 0;
    if (currentSlot > (self.layout.columnCount * self.layout.rowCount) - 1) {
      currentSlot = (self.layout.columnCount * self.layout.rowCount) - 1;
    }

    return currentSlot;
  },

  // returns the coordinates for a given slot
  positionForSlot: function (s) {
    var self = this;
    var slotLeft = self.layout.itemBoxWidth * (s % self.layout.columnCount);
    var slotTop = Math.floor(s / self.layout.columnCount) * self.layout.itemBoxHeight;

    return {
      left: slotLeft,
      top: slotTop
    };
  },

  _onMouseMove: function (e) {
    //too noisy
    ////console.log("mouse move");
    var self = this;

    // slightly hokey caching of last mousemove event (the position is what we care about) for the case 
    // when you want to scroll multiple pages, without having to wiggle the mouse
    if (!e) e = self.lastMouseEvent;
    e.preventDefault();

    if (self._mouseDownTime == 0) {
      return;
    }

    // give the user some forgiveness when pressing and holding. if they only move a couple of pixels, we will stillcount it as a hold.
    if (self._mouseDownHoldTimer) {
      if (Math.abs(e.clientX - self._mouseDownX) > 10  || Math.abs(e.clientY - self._mouseDownY) > 10) {
        clearTimeout(self._mouseDownHoldTimer);
        //console.log("cleared hold timer due to large position change");
        self._mouseDownHoldTimer = undefined;
      } else return;
    }

    var curPage = self.getCurrentPage();

    // this is the -app- dragging code, which manages the necessary animations, the underlying data changes, and the possible paging to a different
    // dashboard page while carrying an app
    if (self._draggedApp) {
            
      self._appRemover.removeClass("showremover");

      var theDraggedItem = self.gridItemCache[self._draggedApp];

      // this is the icon dragging code
      // I need to do all the snapping, rearranging the other apps on the page, etc here
      // don't ]et the app be dragged outside the clipping frame
      var dragOutAmount = Math.floor((self.layout.itemBoxWidth - theDraggedItem.children(".icon").width() ) / 2) - 1; //frame padding

      // figure out if they are pushing against the side and want to scroll the page
      var paging = 0;
      if (theDraggedItem.position().left <= -dragOutAmount) paging = -1;
      if ((theDraggedItem.position().left - dragOutAmount + self.layout.itemBoxWidth) >= self.layout.panelWidth) paging = 1;

      // keep the app inside the dash
      var newLeft = Math.min(Math.max((self._draggedAppOffsetX + e.clientX - self._mouseDownX), -dragOutAmount), (self.layout.panelWidth + dragOutAmount - self.layout.itemBoxWidth));
      var newTop = Math.min(Math.max((self._draggedAppOffsetY + e.clientY - self._mouseDownY), 0), (self.layout.panelHeight - self.layout.itemBoxHeight));

      // keep it from going outside the dashboard
      theDraggedItem.css({
        left: newLeft,
        top: newTop
      });

      // figure out which slot we are above
      // if it's empty, do nothing
      var currentSlot = self.slotForPosition(theDraggedItem.position().left, theDraggedItem.position().top);

      // this is the paging code that is triggered when you are carrying an app and then push against the side of the screen.
      // we go to the next page in that direction, if there is one
      if (paging != 0) {
        self._draggedAppLastSlot = undefined;
        if (!self._pageScrollDelay) {
          var resultantPage = self.goToPage(curPage + paging, 400, function (page) {
            // need to put the page we left back the way it was
            if (curPage != page) self.redrawPage(curPage);
            self.arrangeAppsOnPageToFit(page, currentSlot);
            self.updatePageIndicator();
          });
        }
      }
      // otherwise, if they are over a new slot than they were last time, we animate the icons on the page into the proper configuration      
      else if (currentSlot != self._draggedAppLastSlot) {
        self._draggedAppLastSlot = currentSlot;
        // now call the magic function that, given you are holding the lifted app over slot N, 
        // what the arrangement of the other apps in the page should be.
        self.arrangeAppsOnPageToFit(curPage, self._draggedAppLastSlot);

      }
    } else {
      // this is the -dashboard- scrolling code, when the user grabs the dash and pulls it one way or the other
      var newPos = (self._dashboardScrollOffsetX + e.clientX - self._mouseDownX) + 'px';

      self.dashboard.css("left", newPos);

      if (self._appIcon != undefined) {
        //console.log("removed app highlight in dashboard drag code");
        self._appIcon.children(".iconshader").removeClass("highlighted");
        self._appIcon = undefined;
      }
    }
  },

  // let's actually lift the app up and out of the page, and attach it to the dashcontainer, so
  // we can move it around between pages if necessary
  _onMouseHold: function (e) {
    var self = this;

    //console.log("mouse hold");
    //console.log("freed hold timer because it fired");
    self._mouseDownHoldTimer = undefined;

    //keep track of the id of the app we are dragging.  this is also used as a flag to tell us we are dragging
    self._draggedApp = $(e.target.parentNode).attr("guid");
    //check to be sure we have one
    if (self._draggedApp) {
      //console.log("removed app highlight in mouse hold code");
      self._appIcon.children(".iconshader").removeClass("highlighted");
      self._appIcon.addClass("liftedApp");
      self._appRemover.addClass("showremover");

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

      //clear out the dragging temp pages
      self.scratchPages = [];
      self.inflightPages = [];

    }
  },

  _onMouseLeave: function (e) {
    //console.log("mouse leave");
    var self = this;
    // for now, just treat it as a mouse up
    if (self._mouseDownTime == 0) {
      return;
    }
    if (self._draggedApp) {
      self._mouseDragoutTimer = setTimeout(function (evt) {
        self._onMouseUp(evt)
      }, 500, e);
    } else {
      self._onMouseUp(e);
    }
  },

  _onMouseEnter: function (e) {
    //console.log("mouse enter");
    var self = this;
    clearTimeout(self._mouseDragoutTimer);
  },

  _onMouseUp: function (e) {
    //console.log("mouse up");
    e.preventDefault();
    var self = this;

    clearTimeout(self._mouseDownHoldTimer);
    self._mouseDownHoldTimer = undefined;

    var curPage = self.getCurrentPage();
    if (self._draggedApp) {

      // user dropped the app on some page, not necessarily the one it originated on
      // * we need to fix the originating page, by removing the app from it
      // * we need to insert the app into the new page, (which might be the same page), with fixups
      //    - if page was full before dropping, then all apps afterwards need to be shifted over, possibly changing every page afterward 
      // remove the drag highlighting  
      self._appIcon.removeClass("liftedApp");

      // get the correct arrangement of the current (dropped on) page
      var currentSlot = self.slotForPosition(self.gridItemCache[self._draggedApp].position().left, self.gridItemCache[self._draggedApp].position().top);

      var rearrangedApps = self.arrangeAppsOnPageToFit(curPage, currentSlot);
      // insert the app into the empty slot it is over, on the current page
      rearrangedApps[currentSlot] = self._draggedApp;
      // //console.log("OWA: DROPPED " + self._draggedApp + " IN SLOT " + currentSlot + " ON PAGE " + curPage)
      // overwrite the page in the dashboard state with the newly arranged page
      self.dashboardState.pages[curPage] = rearrangedApps;
      // DO LOTS OF FIXUP!!
      self.fixUpPageOverflows(curPage);

      // save the changes
      self.saveIconGridState(self.dashname, self.dashboardState);

      // remove the appDisplayFrame from the dashcontainer
      self.gridItemCache[self._draggedApp].detach();
      // insert the appDisplayFrame into the current page
      $("#page" + curPage).append(self.gridItemCache[self._draggedApp]);

      // animate the appdisplayframe to the correct position and z-index
      var pos = self.positionForSlot(currentSlot);
      self.gridItemCache[self._draggedApp].animate({
        left: pos.left,
        top: pos.top
      }, self.iconAnimationSpeed);
      self.gridItemCache[self._draggedApp].css('z-index', self._draggedAppOrigZ);

      if (self._appRemover.hasClass("showremover")) {
        //they dropped it on the same slot, so check to see if they wanted to delete it
        var guid = $(e.target.parentNode).attr("guid");

        var itemTitle = self.gItems[guid].itemTitle;
        if (!itemTitle && self.datasource.getItemTitle) { 
          itemTitle = self.datasource.getItemTitle(Base32.decode(guid));
        }

        if (confirm("Uninstall " + itemTitle + "?")) {
          self.datasource.userRemovedItem(Base32.decode(guid));
        }
        self._appRemover.removeClass("showremover");
      }

      // stop dragging 
      self._appIcon = undefined;
      self._draggedApp = undefined;
      self._appRemover = undefined;
          
      self.updatePageIndicator();

    } else {
      // dragged the dashboard
      // they dragged or flicked the dash, or launched an app
      var _endX, _endY;

      _endX = e.clientX;
      _endY = e.clientY;

      var quick = (e.timeStamp - self._mouseDownTime < 200);
      var small = Math.abs(_endX - self._mouseDownX) < 10;

      var flick = quick && !small;
      var tap = small;
      var drag = !quick;

      if (tap && (self._appIcon != undefined)) {
        // //console.log("OWA: app launched");
        //console.log("removed app highlight in app launch code");
        self._appIcon.children(".iconshader").removeClass("highlighted");
        self._appIcon = undefined;

        var guid = $(e.target.parentNode).attr("guid");
        self.datasource.openItem(Base32.decode(guid));

      } else if (flick) {
        // we go to the next page in the direction specified by the flick
        // left or right?
        var dir = (_endX - self._mouseDownX) > 0;

        if (!dir) {
          curPage++;
        } else {
          curPage--;
        }

        self.goToPage(curPage, 250, function() { self.updatePageIndicator()});

      } else { // drag, which may or may not go to the next page
        var closestPage = 0;
        if (self.dashboard.position().left < 0) {
          closestPage = Math.floor((Math.abs(self.dashboard.position().left)  + self.layout.panelWidth/2)/ self.layout.panelWidth);
        }
        self.goToPage(closestPage, 350, function() { self.updatePageIndicator()});
      }
    }

    self._mouseDownTime = 0;
  },

  goToPage: function (whichPage, animationSpeed, completionCallback) {
    var self = this;
    var numPages = self.dashboardState.pages.length;
    if (whichPage >= numPages) whichPage = numPages - 1;
    if (whichPage < 0) whichPage = 0;
    var finalPos = (whichPage * self.layout.panelWidth * -1);

    if ((self.dashboard.position().left != finalPos) && (!self._pageAnimating)) {
      self._pageAnimating = true;
      self._pageScrollDelay = true; //used by the auto-scrolling code to prevent rapid scrolling across many pages
      self.dashboard.animate({
        left: (whichPage * self.layout.panelWidth * -1)
      }, animationSpeed, function () {
        self._pageAnimating = false;
        if (completionCallback) completionCallback(whichPage);
        self._pageScrollTimer = setTimeout(function () {
          self._pageScrollDelay = false;
          self._onMouseMove(false);
        }, 400);
      });
    }
    this.CURRENT_PAGE = whichPage;
    return whichPage;
  },

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

  // handle requests for the dashboardstate
  loadIconGridState: function(name) {
    var state = {};
    try {
      state = JSON.parse(localStorage.getItem(name));
    } catch (e) {
      // reset because of error
      localStorage.setItem(name, JSON.stringify(state));
    }
    return state;
  },

  saveIconGridState: function(name, state) {
    localStorage.setItem(name, JSON.stringify(state));
  },

  refresh: function () {
    var self = this;

    // ask the datasource for the freshest grid state
    var newState = self.loadIconGridState(self.dashname);

    // this is the function called by both the navigator.apps callback or the jetpack callback when the dashboard state loads
    // we immediately turn around and load the app list.
    if (newState) self.dashboardState = newState;
    if (!self.dashboardState.pages) self.dashboardState.pages = [];
      
    self.datasource.getItemList(function (theList) {
      self.refreshGrid(theList);
    });
  },

  // the dataset can use whatever it likes for guids, as long as they are really unique.
  // I encode them so they are usable as dom IDs
  refreshGrid: function (dataset) {
    var self = this;
    // I can't be sure that the guids provided are suitable for dom IDs, so I'll base32 encode them
    var newSet = {};
    for (id in dataset) newSet[Base32.encode(id)] = dataset[id];
    dataset = newSet;

    // first delete items that have been removed from the dataset
    var p, s;
    self.gItems = {};

    if (!self.dashboardState.pages) self.dashboardState.pages = [];

    // record the ones we had last time
    for (p = 0; p < self.dashboardState.pages.length; p++) {
      for (s = 0; s < self.layout.rowCount * self.layout.columnCount; s++) {
        var guid = self.dashboardState.pages[p][s];
        if (guid) {
          self.gItems[guid] = {
            slot: [p, s]
          }; //remember where we found it
          ////console.log("found old app at: " + p + " " + s);
        }
      }
    }

    //overlay the ones we have now
    for (guid in dataset) {
      self.gItems[guid] = dataset[guid];
      ////console.log("found new app: " + guid);
    }

    //remove the ones that are still marked with their former positions
    for (guid in self.gItems) {
      //check to see if it was deleted
      var slot = self.gItems[guid].slot;
      if (slot) {
        ////console.log("found deleted app: " + guid + " " + self.gItems[guid].slot);
        //remove it from everywhere
        delete self.gItems[guid];
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
    for (p = 0; p < self.dashboardState.pages.length; p++) {

      if ($("#page" + p).length == 0) { //results are an array, so zero length means non existence
        var nextPage = $("<div/>").addClass("page").attr("id", "page" + p);
        self.dashboard.append(nextPage);
        nextPage.css({
          width: self.layout.panelWidth,
          height: self.layout.panelHeight
        });
      }

      for (s = 0; s < self.layout.rowCount * self.layout.columnCount; s++) {
        var guid = self.dashboardState.pages[p][s];

        if (guid && !self.gridItemCache[guid]) {
          self.gridItemCache[guid] = self.createGridItem(guid);
          var pos = self.positionForSlot(s);
          self.gridItemCache[guid].css({
            left: pos.left,
            top: pos.top
          });
          $('#page' + p).append(self.gridItemCache[guid]);
        }
      }
      self.dashboard.css({
        width: (self.dashboardState.pages.length * (self.layout.panelWidth + 2)),
        height: self.layout.panelHeight
      });
    }

    //now add in  all the ones that are missing
    // and create the DisplayCache items for them, and find a place in a page for them to live
    for (guid in self.gItems) {
      if (!self.gridItemCache[guid]) {
        self.gridItemCache[guid] = self.createGridItem(guid);
        self.insertNewItemIntoDash(guid);
      }
    }

    self.saveIconGridState(self.dashname, self.dashboardState);
    self.updatePageIndicator();
  },


  //sigh.  too many similar code paths
  addItemToGrid: function(guid, newItem) {
    var self = this;
    guid = Base32.encode(guid);
    //put it in the local object list
    self.gItems[guid] = newItem;
    //create the visual representation
    self.gridItemCache[guid] = self.createGridItem(guid);
    //insert the guid into the dashboard state and the dom object into the page
    self.insertNewItemIntoDash(guid);
  },


  removeItemFromGrid: function(guid) {
    var self = this;
    guid = Base32.encode(guid);
    //remove it from the dashboard state, and the cache, and the dashboard itself
    delete self.gItems[guid];
    //need to find it in the dashboardstate and erase it
    var p, s;
    for (p=0; p<self.dashboardState.pages.length; p++) {
      for (s=0; s<self.dashboardState.pages[p].length; s++) {
        if (self.dashboardState.pages[p][s] == guid) self.dashboardState.pages[p][s] = undefined;
      }
    }

    if (self.gridItemCache[guid]) {
      //remove the objects from the dom
      self.gridItemCache[guid].remove();
      //remove the slot from the cache
      delete self.gridItemCache[guid];
    }
  },

  insertNewItemIntoDash: function (guid) {
    var self = this;
    //iterate through the pages, looking for the first empty slot.  create new pages if necessary
    p = 0;
    s = 0;
    var complete = false;

    while (!complete) {
      if (!self.dashboardState.pages[p]) self.addEmptyPageToDash();

      for (s = 0; s < (self.layout.columnCount * self.layout.rowCount); s++) {
        if (!self.dashboardState.pages[p][s]) {
          self.dashboardState.pages[p][s] = guid;
          var pos = self.positionForSlot(s);
          self.gridItemCache[guid].css({
            left: pos.left,
            top: pos.top
          });
          $('#page' + p).append(self.gridItemCache[guid]);
          complete = true;
          break;
        }
      }
      p++;
    }
  },

  addEmptyPageToDash: function () {
    var self = this;
    var numPages = self.dashboardState.pages.length;

    //add empty page to dash state array
    self.dashboardState.pages[numPages] = [];

    //grow the dashboard
    self.dashboard.css({
      width: ((numPages + 1) * (self.layout.panelWidth + 2)),
      height: self.layout.panelHeight
    });

    //add a new empty page at the end
    var nextPage = $("<div/>").addClass("page").attr("id", "page" + numPages);
    self.dashboard.append(nextPage);
    nextPage.css({
      width: self.layout.panelWidth,
      height: self.layout.panelHeight
    });
    self.updatePageIndicator();
  },

  updatePageIndicator: function () {
    var p;
    var self = this;

    function makeGoToPageFunc(page) {
      return function() {
        self.goToPage(page, 350, function() {self.updatePageIndicator();});
      }
    }

    var currentPage = self.getCurrentPage();
    $(".pagemark").remove();

    for (p=0; p<self.dashboardState.pages.length; p++) {
      var mark = $("<span>").addClass("pagemark").attr("id", "marker" + p);
      mark.css({
        height: self.layout.pageindicatorHeight,
        width: Math.floor(self.layout.pageindicatorHeight * 1.1) 
      });
         
      
      var indi = $("<img width='" + Math.floor(self.layout.pageindicatorHeight * 0.8) + "' height='" + Math.floor(self.layout.pageindicatorHeight * 0.8) + "'/>");
      if (p ==currentPage) {
        indi.attr('src', "icongrid/page_cur.png");
      } else {
        indi.attr('src', "icongrid/page.png");
      }

      //FIX FIX!! Support touch events on page indicators.
      mark.append(indi);
      mark.click(makeGoToPageFunc(p));
      self.pageindicator.append(mark);
    }
  },

  createGridItem: function (guid) {
    var self = this;
    //look it up
    var theItem = self.gItems[guid];

    var appDisplayFrame = $("<div/>").addClass("appDisplayFrame");
    appDisplayFrame.css({
      width: self.layout.itemBoxWidth,
      height: self.layout.itemBoxHeight
    });

    var clickyIcon = $("<div/>").addClass("icon");
    clickyIcon.attr("guid", guid);


    clickyIcon.css({

    });

    //first see if the item itself has an 'imgURL'
    var imgURL = theItem.itemImgURL;
    //if it doesn't, ask the datasource for it
    if (!imgURL && self.datasource.getItemImgURL) {
      imgURL = self.datasource.getItemImgURL(Base32.decode(guid));
    }
    //if we still don't have one, use a generic gray icon as a placeholder
    if (!imgURL) {
      imgURL = "data:image/png;base64,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";
    }

    var appIcon = $("<img>").css({width: "100%", height: "100%"});
    appIcon.attr('src', imgURL);

    clickyIcon.append(appIcon);
    var darken = $("<div/>").addClass("iconshader").css({position: "absolute", top: "0px", left: "0px", width: "100%", height: "100%"})
    clickyIcon.append(darken);

    appDisplayFrame.append(clickyIcon);

    var remover = $("<div>").addClass("remover").css({width: "32px", height: "32px", position: "absolute", top: "10px", left: "10px"});
    var removerImg = $("<img>").css({width: "100%", height: "100%"});
    removerImg.attr('src', "icongrid/remover.png");
    remover.append(removerImg);
    appDisplayFrame.append(remover);

    //add the shader for selection

    var appName = $("<div/>").addClass("appLabel");

    var itemTitle = theItem.itemTitle;
    if (!itemTitle && self.datasource.getItemTitle) { 
      itemTitle = self.datasource.getItemTitle(Base32.decode(guid));
    }
    if (!itemTitle) itemTitle = "";

    appName.text(itemTitle);
    appDisplayFrame.append(appName);


    return appDisplayFrame;
  },






///////////////////////////////////////////////////////////////////////////////////////////
  initialize: function () {
    var self = this;

    //tell the datasource how to notify us of updates
    self.datasource.setRemovalCallback(function(guid) { self.removeItemFromGrid(guid)});

    self.datasource.setAdditionCallback(function(guid, item) {self.addItemToGrid(guid, item)});

    self.dashboard = $("<div/>").addClass("dashboard");
    self.dashboard.css({
      width: self.layout.panelWidth,
      height: self.layout.panelHeight
    });


    self.pageindicator = $("<div>").addClass("pageindicator");
    self.pageindicator.css({
      top: self.layout.panelHeight, 
      width: self.layout.pageindicatorWidth, 
      height: self.layout.pageindicatorHeight
    });

    self.dashcontainer.css({
      clip: "rect( 0px, " + self.layout.containerWidth + "px, " + self.layout.containerHeight + "px, 0px)"
    });
    self.dashcontainer.append(self.dashboard);
    self.dashcontainer.append(self.pageindicator);



    self.dashcontainer.mousedown(function (evt) {
      self.lastMouseEvent = evt;
      self._onMouseDown(evt);
    });
    self.dashcontainer.mousemove(function (evt) {
      self.lastMouseEvent = evt;
      self._onMouseMove(evt);
    });
    self.dashcontainer.mouseup(function (evt) {
      self._onMouseUp(evt);
    });

    self.dashcontainer.mouseleave(function (evt) {
      self._onMouseLeave(evt);
    });
    self.dashcontainer.mouseenter(function (evt) {
      self._onMouseEnter(evt);
    });


    var dashDomObj = self.dashcontainer.get(0);

    // //prevent context menus
    dashDomObj.addEventListener("contextmenu", function (e) {
      //console.log("context menu blocked");
      e.preventDefault();
      e.stopPropagation();
    }, false);


    dashDomObj.addEventListener("touchstart", function(e) {
      if (e.touches && e.touches.length) {
        e.clientX = e.touches[0].clientX;
        e.clientY = e.touches[0].clientY;
      }
      self.lastMouseEvent = e;
      self._onMouseDown(e);

    }, false);

    dashDomObj.addEventListener("touchmove", function(e) {
      if (e.touches && e.touches.length) {
        e.clientX = e.touches[0].clientX;
        e.clientY = e.touches[0].clientY;
      }
      self.lastMouseEvent = e;
      self._onMouseMove(e);
    }, false);

    dashDomObj.addEventListener("touchend", function(e) {
      //cached last touch or move event
      self._onMouseUp(self.lastMouseEvent);
    }, false);

  }

};

