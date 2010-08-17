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

// TODO: It would make sense to make the dashboard and the inbox
// use the same cached local message store.

var storage;
var servers = {}; // map of server URLs
var serverAppLookup = {}; // maps from server+appID to ticket
var gMessageInboxMap = {};
var gMessageArray; // sorted according to current criteria

function generateSortedArray()
{
  gMessageArray = [];
  for each (let inbox in gMessageInboxMap)
  {
    gMessageArray.concat(inbox);
  }
  
  function dateSort(a,b) {
    return b-a;
  }
  function appSort(a,b) {
  
  }
  gMessageArray.sort(dateSort);
}

function getMessageAppName(msg)
{
  var ticket = serverAppLookup[msg.server + msg.app];
  return ticket.name;
}

function render() {
  var box = document.getElementById("inbox");
  box.innerHTML = "";
  generateSortedArray();

  for (let i=0;i<gMessageArray.length;i++)
  {
    let msg = gMessageArray[i];
    var div = elem("div", "msg");
    var app = elem("div", "app");
    app.appendChild(document.createTextNode(getMessageAppName(msg)));
    var text = elem("div", "text");
    app.appendChild(document.createTextNode(msg.text));
    var date = elem("div", "date");
    date.appendChild(document.createTextNode(formatDate(msg.date)));
    div.appendChild(app);
    div.appendChild(text);
    div.appendChild(date);
    box.appendChild(div);
  }
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
          let result = JSON.parse(xhr.responseText);
          gMessageInboxMap[server] = result;
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
}


function reloadInstalled() {
  try { 
    var Cc = Components.classes;
    var Ci = Components.interfaces;
    
    var d = document.getElementById("content");  
    var wallet = document.getElementById("wallet");  

    var storageManagerService = Cc["@mozilla.org/dom/storagemanager;1"].
                                getService(Ci.nsIDOMStorageManager);
    var principal = wallet.contentWindow.document.nodePrincipal;
    storage = storageManagerService.getLocalStorageForPrincipal(principal, {});

    serverAppLookup = {};
    for (var i =0;i<storage.length;i++)
    {
      var key = storage.key(i);
      var item = storage.getItem(key);
      var array = JSON.parse(item);
      
      for (var j=0;j<array.length;j++)
      {
        var install = array[j];
        serverAppLookup[install.ticket.server + install.ticket.app] = install.ticket;
        if (!servers[install.ticket.server]) servers[install.ticket.server] = install.ticket.server;
      }
    }
    startMessageQueueCheck();
    render();
  } catch (e) {
    alert(e);
  }
}
function walletReady() {
reloadInstalled();
}
/*$(window).ready(reloadInstalled);*/