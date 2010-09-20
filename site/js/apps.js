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

// Depends on js/Manifest.js

function Apps(storage) {
  this.installs = [];
  this.conduits = [];
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
  }
  this.makeConduits();

  this.installs.sort(function (a,b) {
      return a.app.name.localeCompare(b.app.name);
    }
  );
}

Apps.prototype.install = function(manifest)
{
  Manifest.validate(manifest);
  var key = manifest.app.launch.web_url;

  // Create installation data structure
  var installation = {
    app: manifest,
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

Apps.prototype.remove = function(key)
{
  this.storage.removeItem(key);
  this.reload();
}

Apps.prototype.saveAuthorizationSecret = function(url, secret)
{
  var theInstall = this.getInstall(url);
  if (theInstall) {
    theInstall.authorization_secret = secret;
    this.storage.setItem(url, JSON.stringify(theInstall));
  }
}

Apps.prototype.saveAuthorizationToken = function(url, token)
{
  var theInstall = this.getInstall(url);
  if (theInstall) {
    theInstall.authorization_token = token;
    this.storage.setItem(url, JSON.stringify(theInstall));
  }
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

// Returns the install whose launch/web_url matches the given url.
Apps.prototype.getInstall = function(url)
{
  for (var i=0;i<this.installs.length;i++)
  {
    if (this.installs[i].app.app.launch.web_url == url)
      return this.installs[i]; // TODO go ahead and make the in-memory lookup table?
  }
  return null;
}

Apps.prototype.makeConduits = function()
{
  if (this.conduits) {
    for (var i=0;i<this.conduits.length;i++) {
      this.conduits[i].destroy();
      // also need to clear out the references in the installs; we'll do that next
    }
  }
  this.conduits = [];
  for (var i=0;i<this.installs.length;i++)
  {
    var install = this.installs[i];
    install.conduit = null;
    if (install.app.conduit)
    {
      var key = install.app.app.launch.web_url;
      var conduit = new AppConduit(key, install.app.conduit);
      install.conduit = conduit;
      this.conduits.push(conduit);
    }
  }
}

Apps.prototype.refreshNotifications = function(callback)
{
  function makeCallback(install, callback) {
    return function(result) {
      callback(install, result);
    }
  }
  for (var i=0;i<this.installs.length;i++)
  {
    var install = this.installs[i];
    if (install.conduit && install.app.supportedAPIs.indexOf("notification") >= 0)
    {
      install.conduit.notifications(makeCallback(install, callback));
    }
  }
}

Apps.prototype.applicationsForURL = function(url)
{
  var result = [];
  for (var i =0;i<storage.length;i++)
  {
    var key = localStorage.key(i);
    var item = localStorage.getItem(key);
    if (Manifest.applicationMatchesURL(install.app, url)) {
      result.push(install.app);
    }
  }
  return result;
}

Apps.prototype.getIcon = function(app, size)
{
  if (app.icons) {
    if (app.icons[size]) return app.icons[size];
    
    var last;
    for (var size in app.icons) 
    {
      try {
        var num = Math.floor(size);
        last = num;
        if (num >= size) return app.icons[size];
      } catch (e) {}
    }
    return app.icons[last];
  }
  return null;
}