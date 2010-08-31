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
 
let EXPORTED_SYMBOLS = ["Apps"];

function Apps(storage) {
  this.installs = [];
  if (!storage) this.storage = window.localStorage;
  else this.storage = storage;
  this.reload();
}

Apps.prototype.logError = function(message) {
  if(window.console && window.console.log) {
    window.console.log("Error: " + message);
  }
}

Apps.prototype.reload = function() {
  this.installs = [];

  for (var i =0 ; i < this.storage.length; i++)
  {
    var key = this.storage.key(i);
    if (key == "appclient_unit_test") continue;

    var item = this.storage.getItem(key);
    var install = JSON.parse(item);
    this.installs.push(install);
    
    dump(item + "\n");
  }
  this.installs.sort(function (a,b) { 
      return a.app.name.localeCompare(b.app.name); 
    } 
  );
}

Apps.prototype.install = function(manf) {
  if (manf.expiration) {
    var numericValue = Number(manf.expiration); // Cast to numeric timestamp
    var dateCheck = new Date(numericValue);
    if(dateCheck < new Date()) { // If you pass garbage into the date, this will be false
      this.logError('Invalid manifest: malformed expiration');
      return false;
    }
    manf.expiration = numericValue;
  }
  if (!manf.name) {
    this.logError('Invalid manifest: missing application name');
    return false;
  }
  if (!manf.app) {
    this.logError('Invalid manifest: missing "app" property');
    return false;
  }
  if (!manf.app.urls) {
    this.logError('Invalid manifest: missing "urls" property of "app"');
    return false;
  }
  if (!manf.app.launch) {
    this.logError('Invalid request: missing "launch" property of "app"');
    return false;
  }
  if (!manf.app.launch.web_url) {
    this.logError('Invalid request: missing "web_url" property of "app.launch"');
    return false;
  }
  // Launch URL must be part of the set of app.urls
  // TODO perform check
  
  var key = manf.app.launch.web_url;

  // Create installation data structure
  var installation = {
    app: manf,
    installTime: new Date().getTime(),
    installURL: window.location
  }
  // Save - blow away any existing value
  this.storage.setItem(key, JSON.stringify(installation));
  this.reload();
  return true;
}

Apps.prototype.removeAll = function() {
  for (var i = this.storage.length - 1 ; i >= 0; i--)
  {
    var key = this.storage.key(i);
    if (key == "appclient_unit_test") continue;
    this.storage.removeItem(key);
  }
}

Apps.prototype.remove = function(install) {

  // Cautious technique here: don't want to have to worry about
  // corruption of this.installs or anything like that.
  var compareValue = JSON.stringify(install);
  for (var i = this.storage.length-1 ; i >= 0; i--)
  {
    var key = this.storage.key(i);
    if (key == "appclient_unit_test") continue;

    var item = this.storage.getItem(key);
    if (item == compareValue) {
      this.storage.removeItem(key);
      // keep looking; shouldn't ever happen, but weird things happen sometimes.
    }
  }
  this.reload();
}


Apps.prototype.searchApps = function(term) {
  var lcterm = term.toLowerCase();
  var result = [];
  for (var i=0;i<this.installs.length;i++)
  {
    if (this.installs[i].app.name.toLowerCase().indexOf(lcterm) >= 0) {
      result.push(this.installs[i]);
    }
  }
  return result;
}

Apps.prototype.refreshNotifications = function(callback) 
{
  for (var i=0;i<this.installs.length;i++)
  {
    if (this.installs[i].app.notification)
    {
      this.initiateNotificationRefresh(this.installs[i].app, callback);
    }
  }
}

Apps.prototype.initiateNotificationRefresh = function(app, callback) 
{
  var xhr = new XMLHttpRequest();
  
  // TODO perhaps send a "updatedSince" argument along with this?
  xhr.open("GET", app.notification, true);
  xhr.onreadystatechange = function(aEvt) {
    if (xhr.readyState == 4) {
      if (xhr.status == 200) {
        try {
          var result = JSON.parse(xhr.responseText);
          // okay... now... are any of these new?
          // if so... put it somewhere?
          // and let somebody know?
        } catch (e) {

        }
      }
    }
  }
  xhr.send(null);
}

Apps.prototype.applicationMatchesURL = function(app, url)
{
  // TODO look into optimizing this so we are not constructing
  // regexps over and over again, but make sure it works in IE
  for (var i=0;i<application.app.urls.length;i++)
  {
    var testURL = application.app.urls[i];
    var re = RegExp("^" + testURL.replace("*", ".*"));// no trailing $
    if (re.exec(url) != null) return true;
  }
  return false;
}


Apps.prototype.applicationsForURL = function(url)
{
  var result = [];
  for (var i =0;i<storage.length;i++)
  {
    var key = localStorage.key(i);
    var item = localStorage.getItem(key);
    if (applicationMatchesURL(install.app, url)) {      
      result.push(install.app);
    }
  }
  return result;
}
