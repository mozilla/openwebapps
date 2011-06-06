/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License
 * Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is aboutHome.xhtml.
 *
 * The Initial Developer of the Original Code is the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Marco Bonardo <mak77@bonardo.net> (original author)
 *   Mihai Sucan <mihai.sucan@gmail.com>
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

// If a definition requires additional params, check that the final search url
// is handled correctly by the engine.
const SEARCH_ENGINES = {
  "Google": {
    image: "data:image/png;base64," +
           "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"
  , params: "source=hp&channel=np"
  }

, "Ð¯Ð½Ð´ÐµÐºÑ":
  {
    image: "data:image/png;base64," +
           "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"
  }
};

// The process of adding a new default snippet involves:
//   * add a new entity to aboutHome.dtd
//   * add a <span/> for it in aboutHome.xhtml
//   * add an entry here in the proper ordering (based on spans)
// The <a/> part of the snippet will be linked to the corresponding url.
const DEFAULT_SNIPPETS_URLS = [
  "http://www.mozilla.com/firefox/4.0/features"
, "https://addons.mozilla.org/firefox/?src=snippet"
];

const SNIPPETS_UPDATE_INTERVAL_MS = 86400000; // 1 Day.

let gSearchEngine;

// XX TODO figure out how to default this right
if (localStorage["search-engine"] == undefined) localStorage["search-engine"] = "\"Google\"";

function onLoad(event)
{
  setupSearchEngine();
  document.getElementById("searchText").focus();

//  loadSnippets();
  
  loadApps();
}


function onSearchSubmit(aEvent)
{
  let searchTerms = document.getElementById("searchText").value;
  if (gSearchEngine && searchTerms.length > 0) {
    const SEARCH_TOKENS = {
      "_searchTerms_": encodeURIComponent(searchTerms)
    }
    let url = gSearchEngine.searchUrl;
    for (let key in SEARCH_TOKENS) {
      url = url.replace(key, SEARCH_TOKENS[key]);
    }
    window.location.href = url;
  }

  aEvent.preventDefault();
}


function setupSearchEngine()
{
  gSearchEngine = JSON.parse(localStorage["search-engine"]);

  // Look for extended information, like logo and links.
  let searchEngineInfo = SEARCH_ENGINES[gSearchEngine.name];
  if (searchEngineInfo) {
    for (let prop in searchEngineInfo)
      gSearchEngine[prop] = searchEngineInfo[prop];
  }

  // Enqueue additional params if required by the engine definition.
  if (gSearchEngine.params)
    gSearchEngine.searchUrl += "&" + gSearchEngine.params;

  // Add search engine logo.
  if (gSearchEngine.image) {
    let logoElt = document.getElementById("searchEngineLogo");
    logoElt.src = gSearchEngine.image;
    logoElt.alt = gSearchEngine.name;
  }

}

function loadSnippets()
{
  return;
    
  // Check last snippets update.
  let lastUpdate = localStorage["snippets-last-update"];
  let updateURL = localStorage["snippets-update-url"];
  if (updateURL && (!lastUpdate ||
                    Date.now() - lastUpdate > SNIPPETS_UPDATE_INTERVAL_MS)) {
    // Even if fetching should fail we don't want to spam the server, thus
    // set the last update time regardless its results.  Will retry tomorrow.
    localStorage["snippets-last-update"] = Date.now();

    // Try to update from network.
    let xhr = new XMLHttpRequest();
    xhr.open('GET', updateURL, true);
    xhr.onerror = function (event) {
      showSnippets();
    };
    xhr.onload = function (event)
    {
      if (xhr.status == 200) {
        localStorage["snippets"] = xhr.responseText;
      }
      showSnippets();
    };
    xhr.send(null);
  } else {
    showSnippets();
  }
}

function showSnippets()
{
  let snippetsElt = document.getElementById("snippets");
  let snippets = localStorage["snippets"];
  // If there are remotely fetched snippets, try to to show them.
  if (snippets) {
    // Injecting snippets can throw if they're invalid XML.
    try {
      snippetsElt.innerHTML = snippets;
      // Scripts injected by innerHTML are inactive, so we have to relocate them
      // through DOM manipulation to activate their contents.
      Array.forEach(snippetsElt.getElementsByTagName("script"), function(elt) {
        let relocatedScript = document.createElement("script");
        relocatedScript.type = "text/javascript;version=1.8";
        relocatedScript.text = elt.text;
        elt.parentNode.replaceChild(relocatedScript, elt);
      });
      return;
    } catch (ex) {
      // Bad content, continue to show default snippets.
    }
  }
    
  // Show default snippets otherwise.
  let defaultSnippetsElt = document.getElementById("defaultSnippets");
  let entries = defaultSnippetsElt.querySelectorAll("span");
  // Choose a random snippet.  Assume there is always at least one.
  let randIndex = Math.round(Math.random() * (entries.length - 1));
  let entry = entries[randIndex];
  // Inject url in the eventual link.
  if (DEFAULT_SNIPPETS_URLS[randIndex]) {
    let links = entry.getElementsByTagName("a");
    // Default snippets can have only one link, otherwise something is messed
    // up in the translation.
    if (links.length == 1) {
      links[0].href = DEFAULT_SNIPPETS_URLS[randIndex];
      activateSnippetsButtonClick(entry);
    }
  }
  // Move the default snippet to the snippets element.
  snippetsElt.appendChild(entry);
}

/**
 * Searches a single link element in aElt and binds its href to the click
 * action of the snippets button.
 *
 * @param aElt
 *        Element to search the link into.
 */
function activateSnippetsButtonClick(aElt) {
  let links = aElt.getElementsByTagName("a");
  if (links.length == 1) {
    document.getElementById("snippets")
            .addEventListener("click", function(aEvent) {
      if (aEvent.target.nodeName != "a")
        window.location = links[0].href;
    }, false);
  }
}

// ---- begin apps
function loadApps()
{
    updateDashboard();

}
// Singleton instance of the Apps object:
var gApps = {};

//the list filter string
var gFilterString = "";

var gDashboardState = {};
gDashboardState.appsInDock = [];
gDashboardState.widgetPositions = {};

//prevent wiggling an app more than once
var gLastInstalledApp = "";

var gOverDock = false;

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


//all these hardcoded number suck.  I haven't found an easier way yet.
function resizeDashboard() {
  
  var visibleHeight = getWindowHeight() - 32;
  var visibleWidth = getWindowWidth() - 40;
  
  //check to see if we went too small for some element of the dashboard, and adjust accordingly
  var minWidgetSpace = getMinWidgetSpaceSize();
  var minDockWidth = getMinDockWidth();
  var minListHeight = getMinListHeight();
  
  var dashWidth = Math.max(visibleWidth, minWidgetSpace.width, minDockWidth);
  var dashHeight = Math.max(visibleHeight, minWidgetSpace.height, minListHeight);
  
  $("#topContainer").height(dashHeight);
  $("#topContainer").width(dashWidth);

  $("#applist").height(dashHeight - 220);
  $("#widgets").height(dashHeight - 168);
  $("#widgets").width(dashWidth - 320);         //$("#widgets").attr("margin-left"));

  $("#dock").width(dashWidth - 4);
  $(".horiz-divider").width(dashWidth);

}

function getMinDockWidth() {
  return (72 * $("#dock").children().length) + 12;
}


function getMinWidgetSpaceSize() {
  //iterate over the widgets and find the farthest right point of all of them
  var maxW = 0;
  var maxH = 0
  
  $.each( gDashboardState.widgetPositions, function(n, v) {
          if (v.disabled) return true;
          maxW = Math.max(maxW, (v.left + v.width));
          maxH = Math.max(maxH, (v.top + v.height));
          });
  
  maxW += 340;  //left margin
  maxH += 188;  //top margin
  return {"width": maxW , "height": maxH};
  
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


window.onload = function() {
    resizeDashboard();
}

window.onresize = function() {
    resizeDashboard();
}


function filterAppList(event) {
    // if only one is visible and the user presses return, launch it
    var launch = (event.keyCode == 13);

    //get the current contents of the text field, and only show the ones in the list that match
    gFilterString = $("#filter").val().toLowerCase();
    renderList(launch);
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
        var dockIcons = $("#dock").children();

        //shortcut
        if (slot >= dockIcons.length) {
          $("#dock").append($("<div/>").addClass("appInDockDrop glowy-blue-outline"));
          return;
        }

        for (var i=0; i<dockIcons.length; i++)
        {
          var currApp = dockIcons[i];
          $(currApp).detach();
          if (i == slot) { $("#dock").append($("<div/>").addClass("appInDockDrop glowy-blue-outline")) };
          if ($(dockIcons[i]).hasClass("appInDock")) { $("#dock").append(dockIcons[i]) };
        }
        resizeDashboard();
}

function removePlaceholder( ) {
    $("#dock > .appInDockDrop").remove();
}



function dragOver(event, ui) { gOverDock = true; };


function dragOut(event, ui) { gOverDock = false;
                              removePlaceholder();
                              resizeDashboard();
                              };



function insertAppInDock(newApp, event) {
    var newAppSlot = computeSlot(event);
    gDashboardState.appsInDock.splice(newAppSlot, 0, newApp.attr("origin32"));
    saveDashboardState();
    updateDock();
    resizeDashboard();
};


//called when an app is deleted, so we don't build up cruft in the dock list
function removeAppFromDock(removedOrigin32) {
    var newDockList = [];
    var curApp;
    for ( var i = 0; i < gDashboardState.appsInDock.length; i++ ) {
          curApp = gDashboardState.appsInDock[i];
          
          //clean out this app, and also any other cruft we find
          if ( (removedOrigin32 != curApp)  && (findInstallForOrigin32(curApp) ) ) {
             newDockList.push(curApp);          
           };
    };
      
      if (typeof console !== "undefined") console.log("new dock list: " + newDockList);

    gDashboardState.appsInDock = newDockList;
};



function infoHot() {
  $(this).addClass("infohot");
}

function infoCold() {
  $(this).removeClass("infohot");
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

/*
$(document).ready(function() {
  $("#filter").focus(function () {
      //hide placeholder item
    }).blur(function () {
    if (this.value == '') {
      //show placeholder item
    }
  });
  $("#dock").droppable({ accept: ".dockItem", over: dragOver, out: dragOut,  
    drop: function(event, ui) {
      gOverDock = false;
      removePlaceholder();
      var newAppInDock = createDockItem(ui.draggable.attr("origin32"), ui.helper);
      insertAppInDock(newAppInDock, event);
    }
  });
 
  $("#clearButton").click( function() { gFilterString = ""; $("#filter").attr("value", gFilterString); renderList(); });
  $("#clearButton").mouseenter(function() { $("#clearButton").addClass("clearButtonHot") }).mouseleave(function() {$("#clearButton").removeClass("clearButtonHot") });

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

*/
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
              
              //now, in the loadState callback, update everything.
              //I'm rebuilding the entire app list and dock list for now, since it is likely not the bottleneck. they can be updated later, if they become a performance problem
              // I -am- carefully adding/removing widgets only where necessary, as it is quite expensive, since they contain iframes.
              renderList();
              updateDock();
              updateWidgets();
  
              var justInstalled = paramValue("emphasize");
              if (justInstalled.length) {
                wiggleApp(Base32.encode(unescape(justInstalled)));
              }
              resizeDashboard();
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
         if ($(this).hasClass("ui-draggable-dragged")) {
             $(this).removeClass("ui-draggable-dragged");
             return false;
         }
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
            
      if (gFilterString.length == 0 ||  gApps[origin].manifest.name.toLowerCase().score(gFilterString) > 0) {
        results.push(gApps[origin]);
      }
    } catch (e) {
      if (typeof console !== "undefined") console.log("Error while creating list icon for app " + origin + ": " + e);
    }
  }
  
  results.sort(function(a,b) {return (a.manifest.name > b.manifest.name) });
  
  for ( var i = 0; i < results.length; i++ ) {
    try {
        $("#applist").append(createAppListItem(results[i]));
    } catch (e) {
      if (typeof console !== "undefined") console.log("Error while inserting list icon for app " + results[i].origin + ": " + e);
    }
  }
  if (results.length == 1 && andLaunch)
  {
    navigator.apps.mgmt.launch(results[0].origin);
  }
}



//reloading the widgets is very expensive, so we only want to fix up the widgets, not reload them all
function updateWidgets( )  {
      
        //if we have no apps, bail out
        if (!gApps) return;

        var widgetSpace = $("#widgets");
        
        //first, walk the list of apps, adding/removing any widgets that should be displayed, but aren't currently (enabled button was toggled, app was added, etc.)
        for (app in gApps) {
            try {
              //does the app specify a widget?  if so, check to see if we already have one
              if (gApps[app].manifest && gApps[app].manifest.widget) {      
                  var existingWidget = $(".widgetFrame[origin32=" + gApps[app].origin32 + "]");
                  
                  if (existingWidget[0]) {
                      //if we already have a widget, but its enabled flag is set to 'NO', then delete it, and continue to next install
                      if (gDashboardState.widgetPositions[gApps[app].origin32].disabled) {
                        $(" .widgetFrame[origin32=" + gApps[app].origin32 + "]").remove();
                      }
                  } else {
                      //if we don't have a widget, and its enable flag is set to 'YES' (or no dashboard state), then create it, create the dashboard state for it, and continue to next install
                      
                      //if it has no dashboard state, give it a default one
                        if (!gDashboardState.widgetPositions[gApps[app].origin32])  {
                            //make a new one, and put it in the save state.  NOTE: we add some padding for the frame, but only when we create and save
                            // the widget the first time.  from then on, we use the outer frame as the thing to measure the size of
                            var wH = ((gApps[app].manifest.widget.height ? gApps[app].manifest.widget.height : 120) + 16);
                            var wW = ((gApps[app].manifest.widget.width ? gApps[app].manifest.widget.width : 200) + 16);
                            //I'm enforcing a max starting size of 200x200 for now.  
                            if (wH > 200) wH = 200;
                            if (wW > 200) wW = 200;

                            gDashboardState.widgetPositions[gApps[app].origin32] = {"top": 0,
                                                                            "left": 0, 
                                                                            "height": wH,
                                                                            "width": wW,
                                                                            "zIndex" : 0
                                                                             };
                            //save state, since we added something
                            saveDashboardState();
                      }
                      
                      if (gDashboardState.widgetPositions[gApps[app].origin32].disabled) { return; }


                      //NOTE: this takes the size of the outer widget frame, so pad it the first time if you want some specific content size
                       var widgetPos = gDashboardState.widgetPositions[gApps[app].origin32];
                       var widget = createWidget(gApps[app], widgetPos.top, widgetPos.left, widgetPos.height, widgetPos.width, widgetPos.zIndex);  
                       widgetSpace.append(widget);

                  }

              }
              
          } catch (e) {
              if (typeof console !== "undefined") console.log("Error while creating widget for app : " + e);
          }
        };
          
      //then, walk the list of widgets, and remove any that belong to apps that have been deleted
      
      $(".widgetFrame").each( function() {
          var app = findInstallForOrigin32($(this).attr("origin32")); 

          if (!app) {
              //delete the widget
              $(" .widgetFrame[origin32=" + $(this).attr("origin32") + "]").remove();
          } else {
              //update the widget position
              var wPos = gDashboardState.widgetPositions[$(this).attr("origin32")];
               $(this).css({"zIndex": wPos.zIndex});  //can'tbe animated
               $(this).animate( {"top": wPos.top + "px",
                                  "left": wPos.left + "px", 
                                  "height": wPos.height + 16 + "px", 
                                  "width": wPos.width + 16 + "px"
                                  } );
                          
              var selectorString = ".clientframe[origin32=" + $(this).attr("origin32") + "], .framehider[origin32=" + $(this).attr("origin32") + "]"; 
              $(this).children(selectorString).animate({"height": wPos.height, "width": wPos.width});
          };
      
      });
      
      resizeDashboard();
}




function updateDock()
{
  if (!gApps) return;

  $('.appInDock').remove();
  var newDockList = [];
  
  for ( var i = 0; i < gDashboardState.appsInDock.length; i++ ) {
    try {
        var origin32 = gDashboardState.appsInDock[i];
        var dockItem = createDockItem(origin32);
        
        if ( ! dockItem ) { 
            //cruft left in array.  should have been cleaned up
            if (typeof console !== "undefined") console.log("no app found for dock item with origin:  " + Base32.decode(origin32));
            continue; 
        };
        
        $("#dock").append(dockItem);
    } catch (e) {
      if (typeof console !== "undefined") console.log("Error while creating dock icon for app " + i + ": " + e);
    }
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


function showAppInfo(origin32) {
  //gray out the screen, put up a modal dialog with the application info.
  //  items in the dialog:
  //  * app info, with links to origin, etc.
  //  * delete button
  //  * widget enable button
  //  * thingie to dismiss the dialog
  
  $("#appinfo").append(createAppInfoPane(origin32));
  revealModal("modalPage");
}

function createAppListItem(install)
{
  var appContainer = $("<div/>").addClass("app dockItem");
  appContainer.attr("origin32", install.origin32);
  
  //the info button
/*  var infoButton = $("<img/>").addClass("infoButton");
  infoButton.attr("src", "img/appinfo.png");
  infoButton.attr("origin32", install.origin32);
  appContainer.append(infoButton);
  
  infoButton.click( function() {showAppInfo(install.origin32); });
  infoButton.mouseenter(function() { infoButton.addClass("infoButtonHot") }).mouseleave(function() {infoButton.removeClass("infoButtonHot") });

*/
  var displayBox = $("<div/>").addClass("appClickBox");
  appContainer.append(displayBox);

  var clickyIcon = $("<div/>").addClass("icon");
  var iconImg = getSmallIcon(install.manifest);
  
  var iconUrl;
  if (iconImg.indexOf("data:") == 0) {
    iconUrl = iconImg;
  } else {
    iconUrl = install.origin + iconImg;
  }
  clickyIcon.append($('<img class="iconimg"/>').attr('src', iconUrl));  
  
  displayBox.append(clickyIcon);

  
  //TODO: size text to fit
  var appName = $("<div/>").addClass("listLabel glowy-blue-text");
  appName.text(install.manifest.name);  
//  appName.disableSelection();
  displayBox.click(makeOpenAppTabFn(install.origin32));

  displayBox.append(appName);
  
/*  appContainer.draggable({revert : "invalid", 
                          cursorAt: {top: 32, left: 32},
                          zIndex: 1000,
                          helper : function() {return createDockItem(install.origin32)}, 
                          opacity: "0.5",
                          stop: function(event, ui) {
                            appContainer.addClass("ui-draggable-dragged");
                          },
                          
                          drag: function(event) { 
                                                  displayPlaceholder(event); 
                                                }

                          });
                        
*/
  return appContainer;
}


function createDockItem(origin32, existingDiv)  //if you pass in an existing div, it will fill it instead of making a new one
{
  var installRecord = findInstallForOrigin32(origin32);
  if (!installRecord) return null;
  
  var dockContainer = existingDiv ? existingDiv : $("<div/>");
  dockContainer.removeClass("app");
  dockContainer.removeClass("ui-draggable");
  dockContainer.addClass("appInDock dockItem");
  dockContainer.attr("origin32", origin32);
  
  var clickyIcon = $("<div/>").addClass("dockIcon");
  var iconImg = getBigIcon(installRecord.manifest);
  
  clickyIcon.append($('<img width="64" height="64"/>').attr('src', installRecord.origin + iconImg));

  dockContainer.click(makeOpenAppTabFn(origin32));
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
           gDashboardState.widgetPositions[$(widget).attr("origin32")].zIndex = highest+1;
}



//create the optional iframe to hold the widget version of the app
function createWidget(install, top, left, height, width, zIndex) {

    var widgetSpace = $("#widgets");
    
    var widgetFrame = $("<div/>").addClass("widgetFrame glowy-blue-outline");
    widgetFrame.attr("origin32", install.origin32);
    widgetFrame.attr("id", "WIDGET" + install.origin32);  //draggable and resizable things need a unique id.  we don't use it though.

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
    var hider = $("<div />").addClass("framehider").css({
                          "top" : "8px",
                          "left":"8px",
                          "width" : (width) + "px",
                          "height" : (height) + "px",
                          "zIndex" : "-1000",
                          "position" : "absolute",
                          });
    hider.attr("origin32", install.origin32);
    
    widgetFrame.append(hider);
    
    var clientFrame = $("<iframe/>").addClass("clientframe");
    clientFrame.attr("origin32", install.origin32);

    clientFrame.attr("src", install.origin + (install.manifest.widget.path?install.manifest.widget.path:''));
    clientFrame.attr("scrolling", "no");
    
    clientFrame.css({
      "width" : width + "px",
      "height" : height + "px",
    }); 
  
    widgetFrame.append(clientFrame);
    
//TO DO: this didn't work.  I wanted a neon green triangle at the bottom right corner as the resize element.  I got it to
// draw there, but it didn't work for resizing
//     var resizeHandle = $("<img/>");
//     resizeHandle.attr("src", "img/resize_handle.png");
//     resizeHandle.attr("id", install.origin32 + "resize");
//     resizeHandle.css({"position" : "absolute", "left": (width + 4) + "px", "top" : (height + 4) + "px"});
//   
//     widgetFrame.append(resizeHandle);

    
    widgetFrame.draggable({containment: widgetSpace,  zIndex: 1000, stack : ".widgetFrame", 
                //unfortunately, iframes steal, or at least borrow, mouse drag events, and so we need to create defensive shields
                // to cover all our iframes when we are doing any mouse dragging.  we hide it behind the view we care about when 
                // we don't need it, and then bring it forward, as you see below, during drags
                 start: function(event, ui) {
                        $(".framehider").css({"zIndex" : 1000});
                   },

                stop: function(event, ui) {
                    //store the new position in the dashboard meta-data
                    gDashboardState.widgetPositions[install.origin32] = {"top": ui.helper.position().top,  "left": ui.helper.position().left,  "height": ui.helper.height() -16, "width": ui.helper.width() -16, "zIndex" : ui.helper.zIndex() };
                    //hide the defensive shield
                    $(".framehider").css({"zIndex" : -1000});
                    saveDashboardState();
                    resizeDashboard();
                  }
          });
                  
     var selectorString = ".clientframe[origin32=" + install.origin32 + "], .framehider[origin32=" + install.origin32 + "]"; 
     
     //I'm currently enforcing an 800x800 max widget size.  this is far beyond what I would consider a widget, but whatever
     widgetFrame.resizable({containment: widgetSpace, handles:'se', alsoResize: selectorString, minHeight:  64, minWidth: 64, maxHeight: 800, maxWidth: 800,
     
                //unfortunately, iframes steal, or at least borrow, mouse drag events, and so we need to create defensive shields
                // to cover all our iframes when we are doing any mouse dragging.  we hide it behind the view we care about when 
                // we don't need it, and then bring it forward, as you see below, during drags
                 start: function(event, ui) {
                        restackWidgets(this);
                        saveDashboardState();
                        $(".framehider").css({"zIndex" : 1000});
                   },

                stop: function(event, ui) {
                      //store the new position in the dashboard meta-data
                      gDashboardState.widgetPositions[install.origin32] = {"left": ui.helper.position().left, "top": ui.helper.position().top, "height": ui.helper.height() -16 , "width": ui.helper.width() -16, "zIndex" : ui.helper.zIndex() };
                      //hide the defensive shield
                      $(".framehider").css({"zIndex" : -1000});
                      saveDashboardState();                
                  }
                   
          });

      //resizable changes it to position:relative, so we override it again, or our coordinates are all screwed up
      widgetFrame.css("position", "absolute");

    return widgetFrame;
}

function removeWidget(origin32) {
      //remove the widget and position info for this dead app, and any other cruft we find
      delete gDashboardState.widgetPositions[origin32];
      $(".widgetFrame[origin32=" + origin32 + "]").remove();
};

function isWidgetVisible(origin32) {
  if (!gDashboardState.widgetPositions[origin32] || gDashboardState.widgetPositions[origin32].disabled) return false;
  return true;
  }
  

function toggleWidgetVisibility(origin32) {
  var isOn = false;
  if (!gDashboardState.widgetPositions[origin32]) return isOn;
  if (gDashboardState.widgetPositions[origin32].disabled) {
    delete gDashboardState.widgetPositions[origin32].disabled;
    isOn = true;
  } else {
    gDashboardState.widgetPositions[origin32].disabled = "YES";
    isOn = false
  }
  saveDashboardState();
  return isOn;
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
  $("#filter").focus();
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


function createAppInfoPane(origin32) {
      var infoBox = $("<div/>").addClass("appinfobox");
      var install = findInstallForOrigin32(origin32);

      var appIcon = $('<div width="64" height="64"/>').addClass("dockIcon");
      var iconImg = getBigIcon(install.manifest);        
      appIcon.append($('<img width="64" height="64"/>').attr('src', install.origin + iconImg));
      infoBox.append(appIcon);
      
      
      var labelBox = $("<div class='labelBox glowy-blue-text'/>");
      
      var appName = $("<div/>").addClass("infoLabel ");
      appName.text(install.manifest.name);  
      appName.disableSelection();
      labelBox.append(appName);

      if (install.manifest.developer && install.manifest.developer.name) {
        var devName = $("<div/>").addClass("infoLabelSmall");
        devName.text(install.manifest.developer.name);  
        devName.disableSelection();
        labelBox.append(devName);
      }
      
      if (install.manifest.developer && install.manifest.developer.url) {
        var devLink = $("<a/>").addClass("infoLabelSmall glowy-blue-text");
        devLink.attr("href", install.manifest.developer.url);
        devLink.attr("target" , "_blank");
        devLink.text(install.manifest.developer.url);
        labelBox.append(devLink);
      }
      infoBox.append(labelBox);

      var descBox = $("<div/>").addClass("descriptionBox glowy-blue-text");
      descBox.text(install.manifest.description);
      infoBox.append(descBox);

      var delButton = $("<div/>").addClass("deleteAppButton glowy-red-text");
      delButton.text("DELETE");
      delButton.disableSelection();
      delButton.mouseenter(function() {delButton.animate({ "font-size": 20 + "px", "padding-top": "6px", "padding-bottom": "2px"}, 50) });
      delButton.mouseleave(function() {delButton.text("DELETE"); delButton.animate({ "font-size": 14 + "px", "padding-top": "8px", "padding-bottom":"0px"}, 50) });


      //this really needs to be moved out into a function
      delButton.click( function() { if (delButton.text() == "DELETE") {
                                          delButton.text("DELETE ?");
                                        } else {
      
                                          navigator.apps.mgmt.uninstall( install.origin, function() { 
                                                                                            removeAppFromDock(install.origin32);
                                                                                            removeWidget(install.origin32);
                                                                                            saveDashboardState( function () {updateDashboard();} );
                                                                                            hideModal('modalPage')
                                                                                        }  
                                                                        ) }});
      infoBox.append(delButton);
      
      if (install.manifest.widget) {
        var widgetButton = $("<div/>").addClass("widgetToggleButton glowy-red-text");
        widgetButton.text("WIDGET");
        widgetButton.disableSelection();
        if (isWidgetVisible(origin32)) {
          widgetButton.addClass("glowy-green-text");
        }
        widgetButton.click( function() { if (toggleWidgetVisibility(install.origin32)) {
                                            widgetButton.addClass("glowy-green-text");
                                          } else {
                                            widgetButton.removeClass("glowy-green-text");
                                          }; 
                                         updateWidgets(); });
                                         
        widgetButton.mouseenter(function() {widgetButton.animate({ "font-size": 20 + "px", "padding-top": "6px", "padding-bottom": "2px"}, 50) });
        widgetButton.mouseleave(function() {widgetButton.animate({ "font-size": 14 + "px", "padding-top": "8px", "padding-bottom": "0px"}, 50) });
        infoBox.append(widgetButton);
      }

      return infoBox;
}
