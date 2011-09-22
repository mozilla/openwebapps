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
  
  if (screenWidth > screenHeight)  {
    appBoxWidth = Math.floor(pageWidth / 5);
    appBoxHeight = Math.floor(screenHeight / 4);
  } else {
    appBoxWidth = Math.floor(pageWidth / 4);
    appBoxHeight = Math.floor(screenHeight / 5);
  }
  
  appIconSize = Math.floor(Math.min(appBoxWidth, appBoxHeight) / 2.5);
  appBorderSize = Math.floor(appIconSize/8);
  appNameSize = Math.floor(appBoxWidth * 0.8);
  appNameFontSize = Math.max(Math.ceil(appIconSize/6), 10);
  /*
  console.log("screenWidth: " + screenWidth);
  console.log("screenHeight: " + screenHeight);
  console.log("pageWidth: " + pageWidth);
  console.log("appBoxWidth: " + appBoxWidth);
  console.log("appBoxHeight: " + appBoxHeight);
  console.log("appIconSize: " + appIconSize);
  console.log("appNameSize: " + appNameSize);
  console.log("appNameSize: " + appNameFontSize);
  */
}

//call it right away to prime the pump
computeLayoutVars();

//************** document.ready()

$(document).ready(function() {

  var downX = 0;
  var downY = 0;
  var appHit;
  
   /*
   var lastX = 0; lastY = 0;
   window.addEventListener("MozOrientation", function(e) {
     if (Math.abs(e.x - lastX) > 0.7 || Math.abs(e.y - lastY) > 0.7) {
       console.log("ROTATION EVENT " + e.x + "::" + e.y);
       lastX = e.x; lastY = e.y;
       window.location.reload();
     }
   }, true);
   */

  // Initial orientation
  var gOrientation;
  if (window.innerHeight > window.innerWidth) gOrientation = 0;
  else gOrientation = 1;
  window.addEventListener("resize", function(e) {
    if (window.innerHeight > window.innerWidth && gOrientation != 0) {
      gOrientation = 0; updateDashboard();
    }
    if (window.innerHeight < window.innerWidth && gOrientation != 1) {
      gOrientation = 1; updateDashboard();
    }
  }, false);
//   document.addEventListener("scroll", function(e) {
//     console.log("SCROLLED");
//   }, false);

  document.addEventListener("contextmenu", function(e) {
    e.preventDefault();
  }, true);

  document.addEventListener("touchstart", function(e) {
    if (e.touches && e.touches.length) {
      downX = e.touches[0].clientX;
      downY = e.touches[0].clientY;
      
      //now check to see if it hits on an icon, and if so, then highlight it
      // i know this is a bit fragile and ugly
      var theDiv = $(e.target.parentNode.parentNode);
      if (theDiv.hasClass("iconWrapper")) {
            appHit = theDiv;
            appHit.addClass("highlighted");
                  console.log("highlighted");

      }
    } else {
      downX = 0;
      downY = 0;
    } 
  }, false);

  document.addEventListener("touchmove", function(e) {
    if (appHit == undefined) return;
    
    if (e.touches && e.touches.length && downX != 0) {
      if ( Math.abs(e.touches[0].clientX - downX) > 10 || Math.abs(e.touches[0].clientY - downY) > 10) {
        //un-highlight the tapped app
        if (appHit != undefined) {
          appHit.removeClass("highlighted");
          appHit = undefined;
                            console.log("UNhighlighted");

        }
      }
    }
  }, false);


  document.addEventListener("touchend", function(e) {
  
    if (appHit != undefined) {
      appHit.removeClass("highlighted");
      appHit = undefined;
                                  console.log("UNhighlighted");

    }
    
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
  }, true);
  
  
  
//////////////////////////////////////////////////////////////////  
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
  navigator.mozApps.mgmt.saveState(gDashboardState, callback);
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
function updateDashboard( completionCallback ) {
    //both the app list and dashboard data functions are asynchronous, so we need to do everything in the callback
    
      //calculate various sizes of elements based on the window size, and set the background
      computeLayoutVars();
      $(".background").css({width: screenWidth, height: screenHeight});
      
      navigator.mozApps.mgmt.list( function (listOfInstalledApps) {
          
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
          navigator.mozApps.mgmt.loadState( function (dashState) 
          {
              gDashboardState = checkSavedData(dashState);
              
              //if we get an empty dashboard state here, then we will just stuff everything into pages as we find them
              if (gDashboardState.pages == undefined) {
              
                //create the right number of pages to hold everything
                gDashboardState.pages = [[],[],[]];
                
                var online = {
                  "NYT Web":"", "NYTimes":"", "Zeit Online":"",
                  "Google Search":"", "YouTube":"", "Music":""
                };
                var utilities = {
                  "Manifest Checker":"", "Rainbooth":"", "Sound Recorder":"",
                  "Camera":"", "Contacts":"", "Browser":"", "Fennec":"",
                  "Calendar":"", "Email":"", "Talk":"", "Clock":"",
                  "Settings":"", "Market":"", "Gmail":""
                };
                
                var oc = 0, uc = 0, gc = 0;
                for (origin in gApps) {
                  var name = gApps[origin].manifest.name;
                  gApps[origin].origin32 = Base32.encode(origin);
                  if (name in online) {
                    gDashboardState.pages[0][oc] = gApps[origin].origin32; oc++;
                  } else if (name in utilities) {
                    gDashboardState.pages[1][uc] = gApps[origin].origin32; uc++;
                  } else {
                    gDashboardState.pages[2][gc] = gApps[origin].origin32; gc++;
                  }
                }
                
                //save this ias the new state
                saveDashboardState();
              }
              
              numPages = gDashboardState.pages.length;
//               console.log("numPages: " + numPages);

              layoutPages();
  
              //and call the dream within a dream within a dream callback.  if it exists.
              if (completionCallback) { completionCallback(); };
           });                      
      });
}



//create the full app list, and sort them for display
// here is also where I cache the base32 version of the origin into the app
function layoutPages() {
  if (!gApps) return;
  //clear the list
  $('.page').remove();
  
  $('.dashboard').css({width: (gDashboardState.pages.length * screenWidth), height: screenHeight});
    
  //now for each page, build zero to 20 app icon items, and put them into the page
  for (var p = 0; p < gDashboardState.pages.length; p++) {
    //add the page div
    var nextPage = $("<div/>").addClass("page").attr("id", "page" + p);
    
    $(".dashboard").append(nextPage);
    nextPage.css({width: screenWidth, height: screenHeight});

    
    
    //put the apps in
    for (var a = 0; a < gDashboardState.pages[p].length; a++) {
        nextPage.append(createAppItem( findInstallForOrigin32(gDashboardState.pages[p][a]) ));
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
                                                              
                                                              "-moz-border-radius": (wrapperSize/6) + "px",
                                                              "-webkit-border-radius": (wrapperSize/6) + "px",
                                                              "border-radius": (wrapperSize/6) + "px"
                                                              
                                                              
                                                              });
  
  var clickyIcon = $("<div/>").addClass("icon");
  clickyIcon.attr("origin32", install.origin32);

  clickyIcon.css({width: appIconSize, 
                  height: appIconSize, 
                  margin: appBorderSize,
                  
//                   marginTop: ((appBoxHeight - appIconSize)/2) + "px", 
//                   marginBottom: ((appBoxHeight - appIconSize)/8) + "px",
//                   marginLeft: ((appBoxWidth - appIconSize)/2) + "px",
//                   marginRight: ((appBoxWidth - appIconSize)/2) + "px", 
                  
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
    navigator.mozApps.mgmt.launch(install.origin);
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




/////////////// screen paging code for dashboard

// this is simply a shortcut for the eyes and fingers


// var downX = 0;			// mouse starting position
// var downY = 0;
// 
// var elementLeft = 0;			// current element offset
// 
// var _dragElement;
// var dragStartTime = 0;
// 
// 
// 
// function OnMouseDown(e)
// {    
//   e.preventDefault();
//   dragStartTime = e.timeStamp;
//   
//   if (_dragElement == undefined) _dragElement = $(".dashboard");
// 
//   // grab the mouse position
//   if (e.touches && e.touches.length) {
//     downX = e.touches[0].clientX;
//     downY = e.touches[0].clientY;
//   } else {
//     downX = e.clientX;
//     downY = e.clientY;
//   }
// 		
//   // grab the clicked element's offset to begin with
//   elementLeft = ExtractNumber(_dragElement.offset().left);
// 				
// }
// 
// function ExtractNumber(value)
// {
// 	var n = parseInt(value);
// 	
// 	return n == null || isNaN(n) ? 0 : n;
// }
// 
// function OnMouseMove(e)
// {
//   if (dragStartTime == 0) { console.log("ignored move"); return; }
//     
//   e.preventDefault();
//   
// 
//   var curPos;
//   if (e.touches && e.touches.length) {
//     curPos = e.touches[0].clientX;
//   } else {
//     curPos = e.clientX;
//   }
// 
// 	// this is the actual "drag code"
// 	var newPos = (elementLeft + curPos - downX) + 'px';
// 	_dragElement.css("left", newPos);
// 
// }
// 
// 
// function OnMouseUp(e)
// {    
//   e.preventDefault();
// 
//   var _endX, _endY;
//   
//   if (e.changedTouches && e.changedTouches.length) {
//     _endX = e.changedTouches[0].clientX;
//     _endY = e.changedTouches[0].clientY;
//   } else {
//     _endX = e.clientX;
//     _endY = e.clientY;
//   }
// 
//   var quick = (e.timeStamp - dragStartTime < 200);
//   var small = Math.abs(_endX - downX) < 10;
//   
//   var flick = quick && !small;
//   var tap =  small;
//   var drag = !quick;
//     
//   if (tap && (e.target.parentNode.className == "icon")) {
//     //NEED TO CHECK Y OFFSET!  THEY MAY HAVE MOVED OFF ICON
//     console.log("app tapped");
//     var origin32 = $(e.target.parentNode).attr("origin32");
//     navigator.mozApps.mgmt.launch(Base32.decode(origin32));
//   } else if (flick) {
//     //we go to the next page in the direction specified by the flick
//     console.log("was flicked");
// 
//     //left or right?
//     var dir = (_endX - downX) > 0;
//     
//     var newPos = elementLeft;
//     if (dir) {
//       newPos += screenWidth; 
//       if (newPos > 0) newPos = 0;
//     } else {
//       newPos -= pageWidth;
//       if (newPos < ((numPages - 1) * screenWidth * -1)) newPos = ((numPages - 1) * screenWidth * -1);
//     }
//         
//     _dragElement.animate({left: newPos}, 250);
// 
//   } else { //drag, which may or may not go to the next page
//     console.log("was dragged");
//     e.preventDefault();
//     var snapPage = 0;
//     
//     if (_dragElement.position().left < 0) {
//         var offset = Math.abs(_dragElement.position().left);
//         var snapPage = Math.floor(offset / screenWidth);
//         var remainder = offset - (snapPage * screenWidth);
//         
//         if ( remainder > Math.floor(screenWidth / 2) ) {
//           snapPage++;
//         }
//         
//     }
//     
//     if (snapPage >= numPages) snapPage = numPages - 1;
//     
//     _dragElement.animate({left: (snapPage * screenWidth * -1) }, 250);
//   }
//   
//   //_dragElement = null;
//   dragStartTime = 0;
// }
// 
// 
// ////////////////
// 
// 
// function onFocus(event)
// {
// //  updateDashboard( ) ;
// //   $("#filter").focus();
// }
// 
// function updateLoginStatus() {
//   navigator.mozApps.mgmt.loginStatus(function (userInfo, loginInfo) {
//     if (! userInfo) {
//       $('#login-link a').attr('href', loginInfo.loginLink);
//       $('#login-link').show();
//     } else {
//       $('#username').text(userInfo.email);
//       $('#signed-in a').attr('href', loginInfo.logoutLink);
//       $('#signed-in').show();
//     }
//   });
// }
// 
// 
// if (window.addEventListener) {
//     window.addEventListener('message', onMessage, false);
// } else if(window.attachEvent) {
//     window.attachEvent('onmessage', onMessage);
// }
// 
// if (window.addEventListener) {
//     window.addEventListener('focus', onFocus, false);
// } else if(window.attachEvent) {
//     window.attachEvent('onfocus', onFocus);
// }
// 
