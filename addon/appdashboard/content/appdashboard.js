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
 * The Original Code is App Dashboard
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Michael Hanson <mhanson@mozilla.com>
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

/* this is gBrowser 
   if (aTab.pinned)
    return;

  this.moveTabTo(aTab, this._numPinnedTabs);
  aTab.setAttribute("pinned", "true");
  this.tabContainer._positionPinnedTabs();
*/

/*
inbox icons from http://kateengland.bigcartel.com/product/workflow-desktop-icons
 we do not yet have license - redo, or negotiate with her!
*/

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

AppsLibrary = {};
Cu.import("resource://appdashboard/content/apps.js", AppsLibrary);
var gApps = null;

function init() {
  try { 
    // We need to get a nodePrincipal to access the storage manager for
    // the myapps.org domain.  Right now, the only way to do that
    // is to construct an iframe that points to it, so we do that with
    // a hidden frame, and wait for it to be constructed, and then
    // call this function.
    
    var d = document.getElementById("content");  
    var wallet = document.getElementById("wallet");  
    var principal = wallet.contentWindow.document.nodePrincipal;

    var storageManagerService = Cc["@mozilla.org/dom/storagemanager;1"].
                                getService(Ci.nsIDOMStorageManager);
    storage = storageManagerService.getLocalStorageForPrincipal(principal, {});
    gApps = new AppsLibrary.Apps(storage);
    gApps.removeAll();

    render();
  } catch (e) {
    alert(e);
  }
}


var installsByName = [];
var servers = {};
var storage;
var manageMode = false;
var serverAppLookup = {}; // maps from server+appID to ticket
var gIconSize = 96;// get from pref

// Global message inbox
var gMessageInboxMap = {};

// pseudoticket for the global inbox
var messageInboxTicket = {icon96:"chrome://appdashboard/content/inbox_96.png", homeURL:"chrome://appdashboard/content/inbox.html"};

function elem(type, clazz) {
	var e = document.createElement(type);
  if (clazz) e.setAttribute("class", clazz);
  return e;
}

function findAppTabForURL(url)
{
  // Scan all the applications
  
}

function makeOpenAppTabFn(targetURL)
{
  return function(evt) { 
    try {
      var mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                             .getInterface(Components.interfaces.nsIWebNavigation)
                             .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                             .rootTreeItem
                             .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                             .getInterface(Components.interfaces.nsIDOMWindow);

      // Should check whether the app is already running

      var tab = mainWindow.gBrowser.addTab(targetURL);
      var idx = mainWindow.gBrowser._numPinnedTabs;
      mainWindow.gBrowser.moveTabTo(tab, idx);
      tab.setAttribute("pinned", "true");
      mainWindow.gBrowser.tabContainer._positionPinnedTabs();
      mainWindow.gBrowser.selectTabAtIndex(idx);// check for control
    } catch (e) {
      alert(e);
    }
    return false;
  }
}


function render() {
  var box = document.getElementById("apps");
  box.innerHTML = "";
 
  if (true) { /*(showInbox) {*/
    var div = elem("div", "ticket");
    div.style.cursor = "pointer";
    div.onclick = makeOpenAppTabFn(messageInboxTicket.homeURL);
    
    let total = 0;
    for each (let inbox in gMessageInboxMap) {
      total += inbox.length;
    }
    messageInboxTicket.notificationCount = total;
    var inboxImg = createAppCanvas(messageInboxTicket);
    var label = elem("div", "ticket_name");
    label.appendChild(document.createTextNode("Messages"));
    div.appendChild(inboxImg);
    div.appendChild(label);
    box.appendChild(div);
  }
  
  for (let i=0;i<apps.installs.length;i++)
  {
    let install = apps.installs[i];
    var div = elem("div", "ticket");
    div.style.cursor = "pointer";
    div.onclick = makeOpenAppTabFn(install.app.launch.web_url);
    if (manageMode) {
      var close = elem("div", "closebox");
      div.appendChild(close);
      
      close.onclick = function() {
        app.remove(install);
        render();
      }
    }
    img = createAppCanvas(install.app);
    var label = elem("div", "ticket_name");
    label.appendChild(document.createTextNode(install.app.name));
    div.appendChild(img);
    div.appendChild(label);
    box.appendChild(div);
  }
  
  var serverDiv = document.getElementById("servers");
  serverDiv.innerHTML = "";
  for (var server in servers)
  {
    var div = elem("div", "server");
    var a = elem("a");
    a.setAttribute("href", server);
    a.appendChild(document.createTextNode(server));
    div.appendChild(a)
    serverDiv.appendChild(div);
  }
}


function  roundRect(ctx, x, y, width, height, radius, fill, stroke) 
{
  stroke = stroke === undefined ? true : false;
  radius = radius === undefined ? 5 : radius;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) {
    ctx.fill();
  }       
  if (stroke) {
    ctx.stroke();
  }
}

function createAppCanvas(manifest)
{
  var cvs = elem("canvas");
  cvs.manifest = manifest;
  cvs.width = gIconSize + 12;
  cvs.height = gIconSize + 12;
  ctx = cvs.getContext("2d");
  ctx.fillStyle = "rgb(255,255,255)";
  
  var img = new Image();
  // TODO: be clever about which icon to use
  img.src = manifest.icons["96"];//icon96;
  ctx.drawImage(img, 0, 0, 96, 96, 0, 6, gIconSize, gIconSize);
  
  if (manifest.notificationCount) {
    ctx.fillStyle = "rgba(0,0,0,200)";
    ctx.beginPath();
    ctx.moveTo(gIconSize+7, 12);
    ctx.arc(gIconSize - 2, 12, 10, 0, 2 * 3.14,false);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgb(255,0,0)";
    ctx.strokeStyle = "rgba(0,0,0,0)";
    ctx.beginPath();
    ctx.moveTo(gIconSize+6, 11);
    ctx.arc(gIconSize - 3, 11, 10, 0, 2 * 3.14,false);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "rgb(255,255,255)";
    ctx.strokeStyle = "rgb(255,255,255)";
    ctx.font = "12px sans serif";
    ctx.fillText("" + ticket.notificationCount, gIconSize - 6, 14);
    ctx.strokeText("" + ticket.notificationCount, gIconSize - 6, 14);
    
  }
  return cvs;
}

function setIconSize(size)
{
  gIconSize = size;
  var theRules;
  if (document.styleSheets[0].cssRules) {
		theRules = document.styleSheets[0].cssRules;
	} else if (document.styleSheets[0].rules) {
		theRules = document.styleSheets[0].rules;
	}

  // I'm not sure putting the icons into the DOM 
  // is really the right approach.  But this is
  // necessary for spacing them out, for now.
  for each (var r in theRules)
  {
    if (r.selectorText == ".ticket")
    {
      r.style.width = size + 24 + "px";
      r.style.height = size + 24 + "px";
    }
  }
  render();
} 

function startMessageQueueCheck()
{
  for (let server in servers)
  {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", server + "/messages", true);
    xhr.onreadystatechange = function(aEvt) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          // clear out notification counts for this server...
          // TODO this doesn't work
          for (let i=0;i<installsByName.length;i++) {
            let install = installsByName[i];
            if (install.server == server) {
              alert("Setting ticket to 0");
              install.ticket.notificationCount = 0;
            }
          }
          var result = JSON.parse(xhr.responseText);
          var msgs = document.getElementById("messages");

          gMessageInboxMap[server] = result;
          for each (var r in result)
          {
            let key = server + r.app;
            let ticket = serverAppLookup[key];
            if (!ticket.notificationCount) ticket.notificationCount = 0;
            ticket.notificationCount += 1;
          }
          render();
        }
      }
    }
    xhr.send(null);
  }
}

function formatDate(dateStr)
{
  if (!dateStr) return "null";
  
  var now = new Date();
  var then = new Date(dateStr);

  if (then.getDate() != now.getDate())
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
      str = hr + ":" + (mins < 10 ? "0" : "") + Math.floor(mins) + " " + (hrs >= 12 ? "P.M." : "A.M.");
  }
  return str;
}/*$(window).ready(reloadInstalled);*/