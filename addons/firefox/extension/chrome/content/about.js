/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
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
 * The Original Code is Open Web Apps.
 *
 * The Initial Developer of the Original Code is
 * Mozilla, Inc.
 *
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * */

Components.utils.import("resource://openwebapps/modules/api.js");

var repo = FFRepoImplService;
var appDict = repo.list(); // note that this is using the internal, non-async API

function elem(type, clazz) {
  var e = document.createElement(type);
  if (clazz) e.setAttribute("class", clazz);
  return e;
}


var idx = window.location.href.indexOf("?");
if (idx > 0) {
  var argstr = window.location.href.substring(idx+1);
  var args = argstr.split("&");
  var params = {}
  for each (var a in args) {
    var sp = a.split("=", 2)
    params[sp[0]] = sp[1];
  }

  if (params["appid"]) {
    var theApp = appDict[params["appid"]];

    document.getElementById("viewcontrols").style.display = "block";

    if (params["viewsrc"]) {
      var container = document.getElementById("viewsrc");
      document.title = "Source of application: " + params["appid"];
      var box = elem("div", "viewsrc");
      container.appendChild(box);
      
      function renderValue(parent, key, val, aBox) {
        if (parent == "icons") {
          dump("key is " + key + "\n");
          aBox.setAttribute("style", "margin:4px;width:" + key + "px;height:" + key+ "px;background-image:url(\"" + val + "\")");
          dump("margin:4px;width:" + key + "px;height:" + key+ "px;background-image:url(\"" + val + "\")\n");

        } else if (key == "installTime") {
          aBox.appendChild(document.createTextNode("" + new Date(val) + " - " + val));
        } else {
          aBox.appendChild(document.createTextNode(val));
        }
      }
      
      function renderObj(parentKey, obj, aContainer) {
        for (var key in obj) {
          if (typeof obj[key] == "object") {
            var row = elem("div", "row");
            var label = elem("div", "label");
            label.appendChild(document.createTextNode(key));
            row.appendChild(label);
            aContainer.appendChild(row);

            var subobj = elem("div", "subobj");
            aContainer.appendChild(subobj);
            renderObj(key, obj[key], subobj);
          } else {
            var row = elem("div", "row");
            var label = elem("div", "label");
            var value = elem("div", "value");
            
            label.appendChild(document.createTextNode(key));
            renderValue(parentKey, key, obj[key], value);
            row.appendChild(label);
            row.appendChild(value);
            aContainer.appendChild(row);
          }
        }
      }
      renderObj("", theApp, box);
      
    }
    else if (params["viewraw"]) {
      var container = document.getElementById("viewraw");
      var pre = elem("div", "raw");
      container.appendChild(pre);
      pre.appendChild(document.createTextNode(JSON.stringify(theApp)));
    }
  }
}
else
{
  function getBiggestIcon(minifest) {
    //see if the minifest has any icons, and if so, return the largest one
    if (minifest.icons) {
      var biggest = 0;
      for (z in minifest.icons) {
        var size = parseInt(z, 10);
        if (size > biggest) biggest = size;
      }
      if (biggest !== 0) return minifest.icons[biggest];
    }
    return null;
  }

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

  var appListContainer = document.getElementById("applist");
  
  for (var appID in appDict)
  {
    var appRow = elem("div", "app");
    var appCfg = elem("div", "configure");
    var appIcon = elem("div", "icon");
    var appDetail = elem("div", "detail");

    var appTextBox = elem("div", "textbox");
    var appName = elem("div", "name");
    var appReceipt = elem("div", "receipt");
    
    appRow.appendChild(appCfg);
    appRow.appendChild(appDetail);
    appDetail.appendChild(appIcon);

    appDetail.appendChild(appTextBox);

    appTextBox.appendChild(appName);
    appTextBox.appendChild(appReceipt);

    // Config
    var theApp = appDict[appID];
    var viewSrcLink = elem("a");
    viewSrcLink.href = "about:apps?viewsrc=1&appid=" + appID;
    viewSrcLink.appendChild(document.createTextNode("View Source"));
    appCfg.appendChild(viewSrcLink);
   
    // Detail
    appIcon.setAttribute("style", "background-image:url(\"" + getBiggestIcon(theApp.manifest) + "\")");
    appName.appendChild(document.createTextNode(theApp.manifest.name));
    
    var installationDomain;
    if (theApp.install_origin == "chrome://openwebapps") {
      installationDomain = "directly from the site";
    } else{
      installationDomain = "from " + theApp.install_origin;
    }
    
    appReceipt.appendChild(document.createTextNode("Installed " + formatDate(theApp.install_time) + ", "+ installationDomain));
    appListContainer.appendChild(appRow);
  }
}