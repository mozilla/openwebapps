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

function AboutApps(win)
{
  this._window = win;
  
}

AboutApps.prototype = {
  _elem: function this._elem(type, clazz) {
    var e = this._window.contentDocument.createElement(type);
    if (clazz) e.setAttribute("class", clazz);
    return e;
  },
  
  _render: function render()
  {
    var repo = FFRepoImplService;
    var appDict;
    repo.list(function(aDict) {
      appDict = aDict;
      render();
    });

    var idx = this._window.location.href.indexOf("?");
    if (idx > 0) {
      var argstr = this._window.location.href.substring(idx+1);
      var args = argstr.split("&");
      var params = {}
      for each (var a in args) {
        var sp = a.split("=", 2)
        params[sp[0]] = sp[1];
      }

      if (params["appid"]) {
        var theApp = appDict[params["appid"]];

        this._window.contentDocument.getElementById("viewcontrols").style.display = "block";

        if (params["viewsrc"]) {
          var container = this._window.contentDocument.getElementById("viewsrc");
          this._window.contentDocument.title = "Source of application: " + params["appid"];
          var box = this._elem("div", "viewsrc");
          container.appendChild(box);
          
          function renderValue(parent, key, val, aBox) {
            if (parent == "icons") {
              aBox.setAttribute("style", "margin:4px;width:" + key + "px;height:" + key+ "px;background-image:url(\"" + theApp.origin + val + "\")");

            } else if (key == "installTime") {
              aBox.appendChild(this._window.contentDocument.createTextNode("" + new Date(val) + " - " + val));
            } else {
              aBox.appendChild(this._window.contentDocument.createTextNode(val));
            }
          }
          
          function renderObj(parentKey, obj, aContainer) {
            for (var key in obj) {
              if (typeof obj[key] == "object") {
                var row = this._elem("div", "row");
                var label = this._elem("div", "label");
                label.appendChild(this._window.contentDocument.createTextNode(key));
                row.appendChild(label);
                aContainer.appendChild(row);

                var subobj = this._elem("div", "subobj");
                aContainer.appendChild(subobj);
                renderObj(key, obj[key], subobj);
              } else {
                var row = this._elem("div", "row");
                var label = this._elem("div", "label");
                var value = this._elem("div", "value");
                
                label.appendChild(this._window.contentDocument.createTextNode(key));
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
          var container = this._window.contentDocument.getElementById("viewraw");
          var pre = this._elem("div", "raw");
          container.appendChild(pre);
          pre.appendChild(this._window.contentDocument.createTextNode(JSON.stringify(theApp)));
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
        else if (then.getMonth() != now.getMonth() || then.getDate() != now.getDate())
        {
           var dayDelta = (new Date().getTime() - then.getTime() ) / 1000 / 60 / 60 / 24 // hours
           if (dayDelta < 2) str = "yesterday";
           else if (dayDelta < 7) str = Math.floor(dayDelta) + " days ago";
           else if (dayDelta < 14) str = "last week";
           else if (dayDelta < 30) str = Math.floor(dayDelta) + " days ago";
           else str = Math.floor(dayDelta /30) + " month" + ((dayDelta/30>2)?"s":"") + " ago";
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

      var appListContainer = this._window.contentDocument.getElementById("applist");
      appListContainer.innerHTML = "";
      
      var empty = true;
      for (let appID in appDict)
      {
        empty = false;
        function makeLaunchFn(appID) {
          return function() {
            repo.launch(appID);
          }
        }
        function makeDeleteFn(appID, container) {
          return function() {
            repo.uninstall(appID, function() {});
            container.style.minHeight = "0px";
            container.style.height = container.clientHeight + "px";
            this._window.setTimeout(function() {
              container.style.height = "0px";
              container.style.paddingTop = 0;
              container.style.paddingBottom = 0;
              container.style.marginBottom = 0;
            }, 0);
            this._window.setTimeout(function() {appListContainer.removeChild(container)}, 500);
            return false;
          }
        }
        
        var appRow = this._elem("div", "app");
        var appCfg = this._elem("div", "configure");
        var appIcon = this._elem("div", "icon");
        var appDetail = this._elem("div", "detail");

        var appTextBox = this._elem("div", "textbox");
        var appName = this._elem("div", "name");
        var appReceipt = this._elem("div", "receipt");
        
        appRow.appendChild(appCfg);
        appRow.appendChild(appDetail);
        appDetail.appendChild(appIcon);

        appDetail.appendChild(appTextBox);

        appTextBox.appendChild(appName);
        appTextBox.appendChild(appReceipt);

        // Config
        var theApp = appDict[appID];
        var viewSrcLink = this._elem("a");
        viewSrcLink.href = "about:apps?viewsrc=1&appid=" + appID;
        viewSrcLink.appendChild(this._window.contentDocument.createTextNode("View Manifest"));
        appCfg.appendChild(viewSrcLink);
        var deleteLink = this._elem("a");
        deleteLink.href = "#";
        deleteLink.onclick = makeDeleteFn(appID, appRow);
        deleteLink.appendChild(this._window.contentDocument.createTextNode("Delete"));
        appCfg.appendChild(deleteLink);

       
        // Detail
        var iconUrl = theApp.origin + getBiggestIcon(theApp.manifest);
        appIcon.setAttribute("style", "background-image:url(\"" + iconUrl + "\")");
        appIcon.onclick = makeLaunchFn(appID);
        
        appName.appendChild(this._window.contentDocument.createTextNode(theApp.manifest.name));
        appReceipt.appendChild(this._window.contentDocument.createTextNode("Installed " + formatDate(theApp.install_time) + ", "));

        if (theApp.install_origin == "chrome://openwebapps") {
          appReceipt.appendChild(this._window.contentDocument.createTextNode("directly from the site"));
        } else{
          var domainLink = this._elem("a");
          domainLink.href = theApp.install_origin;
          domainLink.target = "_blank";
          domainLink.appendChild(this._window.contentDocument.createTextNode(theApp.install_origin));
          appReceipt.appendChild(this._window.contentDocument.createTextNode("from "));
          appReceipt.appendChild(domainLink);
        }
        appListContainer.appendChild(appRow);
      }
      if (empty) {
        var emptyObj = this._elem("div", "empty");
        emptyObj.appendChild(this._window.contentDocument.createTextNode("No web applications are installed."));
        appListContainer.appendChild(emptyObj);
      }
    }
  }
};
var EXPORTED_SYMBOLS = ["AboutApps"];
