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


function getWindowHeight() {
  /*if(window.innerHeight) return window.innerHeight;
  if (document.body.clientHeight) */ return document.body.clientHeight;
}

function getWindowWidth() {
  /*if(window.innerWidth) return window.innerWidth;
  if (document.body.clientWidth)*/ return document.body.clientWidth;
}


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

var currentOffset = 0;

//I'm assuming 4 x 5 or 5 x 4 apps per page
function computeLayoutVars() {
  screenWidth = getWindowWidth();
  pageWidth = screenWidth;//-4;
  screenHeight = getWindowHeight();
  
 //  if (screenWidth > screenHeight)  {
//     appBoxWidth = Math.floor(pageWidth / 6);
//     appBoxHeight = Math.floor(screenHeight / 2);
//   } else {
//     appBoxWidth = Math.floor(pageWidth / 2);
//     appBoxHeight = Math.floor(screenHeight / 6);
//   }
  appBoxWidth = 100;
  appBoxHeight = 100;
  appIconSize = 64; //Math.floor(Math.min(appBoxWidth, appBoxHeight) / 2.5);
  appBorderSize = Math.floor(appIconSize/8);
  appNameSize = Math.floor(appBoxWidth * 0.8);
  appNameFontSize = Math.max(Math.ceil(appIconSize/6), 10);
  
  console.log("screenWidth: " + screenWidth);
  console.log("screenHeight: " + screenHeight);
  console.log("pageWidth: " + pageWidth);
  console.log("appBoxWidth: " + appBoxWidth);
  console.log("appBoxHeight: " + appBoxHeight);
  console.log("appIconSize: " + appIconSize);
  console.log("appNameSize: " + appNameSize);
  console.log("appNameSize: " + appNameFontSize);

}

//call it right away to prime the pump
// computeLayoutVars();

//************** document.ready()

// $(document).ready(function() {
// 
//   var downX = 0;
//   var downY = 0;
//   var appHit;
  
//       }, true);

//   document.addEventListener("scroll", function(e) {
//     console.log("SCROLLED");
//   }, false);

//   document.addEventListener("contextmenu", function(e) {
//     e.preventDefault();
//   }, true);
// 
//   document.addEventListener("touchstart", function(e) {
//     if (e.touches && e.touches.length) {
//       downX = e.touches[0].clientX;
//       downY = e.touches[0].clientY;
//       
//       //now check to see if it hits on an icon, and if so, then highlight it
//       // i know this is a bit fragile and ugly
//       var theDiv = $(e.target.parentNode.parentNode);
//       if (theDiv.hasClass("iconWrapper")) {
//             appHit = theDiv;
//             appHit.addClass("highlighted");
//                   console.log("highlighted");
// 
//       }
//     } else {
//       downX = 0;
//       downY = 0;
//     } 
//   }, false);
// 
//   document.addEventListener("touchmove", function(e) {
//     if (appHit == undefined) return;
//     
//     if (e.touches && e.touches.length && downX != 0) {
//       if ( Math.abs(e.touches[0].clientX - downX) > 10 || Math.abs(e.touches[0].clientY - downY) > 10) {
//         //un-highlight the tapped app
//         if (appHit != undefined) {
//           appHit.removeClass("highlighted");
//           appHit = undefined;
//                             console.log("UNhighlighted");
// 
//         }
//       }
//     }
//   }, false);


//   document.addEventListener("touchend", function(e) {
//   
//     if (appHit != undefined) {
//       appHit.removeClass("highlighted");
//       appHit = undefined;
//                                   console.log("UNhighlighted");
// 
//     }
//     
//     var currentOffset = window.scrollX;
//     var snapPage = 0;
//     
//     if (currentOffset > 0) {
//         var snapPage = Math.floor(currentOffset / screenWidth);
//         var remainder = currentOffset - (snapPage * screenWidth);
//         
//         if ( remainder > Math.floor(screenWidth / 2) ) {
//           snapPage++;
//         }
//         
//     }
//     
//     if (snapPage >= numPages) snapPage = numPages - 1;
//     window.scrollTo(snapPage * screenWidth);
//   }, true);
  
  
//  });




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

// window.onresize = function() {
//     updateDashboard();
// }




//this is the primary UI function.  It loads the latest app list from disk, the latest dashboard state from disk,
// and then proceeds to bring the visual depiction into synchrony with the data, with the least visual interruption.
function updateDashboard( listOfInstalledApps ) {
    //both the app list and dashboard data functions are asynchronous, so we need to do everything in the callback
    
    console.log("UPDATING dashboard");
    
      //calculate various sizes of elements based on the window size, and set the background
      computeLayoutVars();
      $(".dashboard").css({width: screenWidth - 20, height: screenHeight - 20});
      
          
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

          $('#page0').empty();
          for (origin in gApps) {
            console.log("appending: " + gApps[origin].origin);
              $('#page0').append(createAppItem(gApps[origin]));
            }
                 
            $('#page0').css({width: "100%", height: "100%"});


          //now, in the list callback, load the dashboard state
//           navigator.apps.mgmt.loadState( function (dashState) 
//           {
//               gDashboardState = checkSavedData(dashState);
//               
//               //if we get an empty dashboard state here, then we will just stuff everything into pages as we find them
//               if (gDashboardState.pages == undefined) {
//               
//                 //create the right number of pages to hold everything
//                gDashboardState.pages = [];
                
                //put 20 apps into each page, or as many as we have
//                 var a=0;
//                 for (origin in gApps) {
//                   gApps[origin].origin32 = Base32.encode(origin);
//                   if (gDashboardState.pages[Math.floor(a/8)] == undefined) { gDashboardState.pages[Math.floor(a/8)] = []; }
//                   gDashboardState.pages[Math.floor(a/8)][(a % 8)] = gApps[origin].origin32;
//                   a++;
//                 }
//                 //save this ias the new state
//                 saveDashboardState();
//               }
//               
//              numPages = 1; //gDashboardState.pages.length;
//               console.log("numPages: " + numPages);

//              layoutPages();
//   
//               //and call the dream within a dream within a dream callback.  if it exists.
//               if (completionCallback) { completionCallback(); };
//            });                      

}



//create the full app list, and sort them for display
// here is also where I cache the base32 version of the origin into the app
// function layoutPages() {
//   if (!gApps) return;
//   //clear the list
//   $('.page').remove();
//   
//   $('.dashboard').css({width: (numPages * screenWidth), height: screenHeight});
//     
//   //now for each page, build zero to 20 app icon items, and put them into the page
//   for (var p = 0; p < numPages; p++) {
//     //add the page div
//     var nextPage = $("<div/>").addClass("page").attr("id", "page" + p);
//     
//     $(".dashboard").append(nextPage);
//     nextPage.css({width: screenWidth, height: screenHeight});
// 
//     
//     
//     //put the apps in
//     for (var a = 0; a < gDashboardState.pages[p].length; a++) {
//         nextPage.append(createAppItem( findInstallForOrigin32(gDashboardState.pages[p][a]) ));
//     }
//     
//   }
// }







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
                                                              
                                                              "-moz-border-radius": (wrapperSize/6) + "px",
                                                              "-webkit-border-radius": (wrapperSize/6) + "px",
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
 
  clickyIcon.click(function() {
    self.port.emit("launch", install.origin);
  });
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


//set up the message handlers
self.port.on("theList", updateDashboard);




