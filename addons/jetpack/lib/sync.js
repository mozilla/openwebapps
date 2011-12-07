/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
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
 * The Original Code is trusted.js; substantial portions derived
 * from XAuth code originally produced by Meebo, Inc., and provided
 * under the Apache License, Version 2.0; see http://github.com/xauth/xauth
 *
 * Contributor(s):
 *     Michael Hanson <mhanson@mozilla.com>
 *     Dan Walkowski <dwalkowski@mozilla.com>
 *     Anant Narayanan <anant@kix.in>
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

/* About sync.js:

There are three main objects defined in this module:

SyncServer: handles the actual interaction with the server.  This
  handles the login process and stores the credentials, but otherwise
  has no state.

SyncService: handles actual synchronization, and keeps state about the
  sync progress.  This interacts with the server and the repo
  (including some private methods, not just navigator.mozApps APIs)

SyncScheduler: handles scheduling of calls to SyncService.  It should
  also respond to events from the server (like a Retry-After) and


All functions here use Node-style error handling, where the functions
take a callback with the signature callback(error, result), where
error is null or undefined in case of success (result itself is
optional depending on the function).

*/


/* This block only applies to Jetpack, to get an active window for use
   with setTimeout/clearTimeout: */
var win;
if (typeof exports !== "undefined") {
  var chrome = require("chrome");
  var Cc = chrome.Cc;
  var Ci = chrome.Ci;
  var Cu = chrome.Cu;
  var Cr = chrome.Cr;
  var components = chrome.components;
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
    .getService(Ci.nsIWindowMediator);
  win = wm.getMostRecentWindow("navigator:browser");
} else {
  win = window;
}

// FIXME: change args to positional arguments
var SyncService = function (args) {
  var self = this;
  this.pollTime = args.pollTime;
  if (this.pollTime === undefined) {
    this.pollTime = null;
  }
  if (this.pollTime !== null && typeof this.pollTime !== 'number') {
    throw 'Invalid pollTime argument (should be null or a number): ' + this.pollTime;
  }
  this.server = args.server;
  this.repo = args.repo;
  // FIXME: remove the TypedStorage default; this should always be passed in
  this.storage = args.storage || new TypedStorage().open('sync');
  this.storage.get('lastSyncTime', function (value) {
    if (value) {
      self._lastSyncTime = parseFloat(value);
    } else {
      self._lastSyncTime = null;
    }
  });
  this.storage.get('lastSyncPut', function (value) {
    if (value) {
      self._lastSyncPut = parseFloat(value);
    } else {
      self._lastSyncPut = null;
    }
  });
  this._lastSyncUUID = null;
  this.storage.get('lastSyncUUID', function (value) {
    self._lastSyncUUID = value || null;
  });
  this._appTracking = null;
  this.storage.get('appTracking', function (value) {
    if (value === null || value === undefined) {
      value = {};
    }
    self._appTracking = value;
  });
  // This will get set if the server tells us to back off on polling:
  this._backoffTime = null;
  this.onlogin = null;
  this.onlogout = null;
  this.onstatus = null;
  // FIXME: we need to catch any Retry-After values, and call this:
  this.onretryafter = null;
};

SyncService.prototype.toString = function () {
  return '[SyncService pollTime: ' + this.pollTime + ' server: ' + this.server + ']';
};

/* Resets all state for the service; returns the service back to the state
   as if it has never interacted with any server */
SyncService.prototype.reset = function (callback) {
  var steps = 0;
  var allSet = false;
  var self = this;
  function done() {
    steps--;
    if (steps === 0 && allSet) {
      self.sendStatus({status: 'reset'});
      if (callback) {
        callback();
      }
    }
  };
  steps++; this.storage.put('lastSyncTime', null, done);
  steps++; this.storage.put('lastSyncPut', null, done);
  steps++; this.storage.put('appTracking', null, done);
  this._lastSyncTime = null;
  this._lastSyncPut = null;
  this._appTracking = {};
  if (steps === 0) {
    self.sendStatus({status: 'reset'});
    if (callback) {
      callback();
    }
  } else {
    allSet = true;
  }
};

/* Sends a status message to any listener */
SyncService.prototype.sendStatus = function (message) {
  if (! this.onstatus) {
    return;
  }
  message.timestamp = new Date().getTime();
  this.onstatus(message);
};

/* Confirms that the uuid received from the server matches the uuid we
   expect; if it does not then it resets state and returns false.  Any
   syncing in process should be abandoned in this case, and the sync
   started over from the beginning. */
SyncService.prototype.confirmUUID = function (uuid) {
  var self = this;
  if (uuid === undefined) {
    log('Undefined UUID');
    return true;
  }
  log('confirming UUID', uuid || 'no remote', this._lastSyncUUID || 'no local');
  if ((! this._lastSyncUUID) && uuid) {
    this._lastSyncUUID = uuid;
    this.storage.put('lastSyncUUID', uuid);
    return true;
  } else if (this._lastSyncUUID == uuid) {
    return true;
  } else {
    log('Reseting from UUID');
    this.reset(function () {
      log('Finished reset from UUID');
      self._lastSyncUUID = uuid;
      self.storage.put('lastSyncUUID', uuid);
    });
    return false;
  }
};

/* Logs into the server given assertionData, which should be
   {assertion: string, audience: origin} as returned by a
   navigator.id.getVerifiedEmail call */
SyncService.prototype.login = function (assertionData, callback) {
  var self = this;
  this.server.login(assertionData, function (error, result) {
    if (error) {
      if (callback) {
        callback(error);
      }
      return;
    }
    self.confirmUUID(result.uuid);
    if (self.onlogin) {
      self.onlogin(result);
    }
    self.sendStatus({login: true, account: result});
    if (callback) {
      callback(error, result);
    }
  });
};

/* After a login has occurred, you can call this to get data that can
   be used to avoid logging in later */
SyncService.prototype.getAuthData = function () {
  return this.server.authData;
};

/* Having gotten authData, you can shortcut the login process by
   calling setAuthData */
SyncService.prototype.setAuthData = function (data, callback) {
  var self = this;
  this.server._processLogin(data, function (error, result) {
    if (! error) {
      if (self.onlogin) {
        self.onlogin(result);
      }
      self.sendStatus({login: true, account: result});
    }
    if (callback) {
      callback(error, data);
    }
  });
};

SyncService.prototype.loggedIn = function () {
  return this.server.loggedIn();
};

SyncService.prototype.logout = function (callback) {
  var self = this;
  this.server.logout(function (error, result) {
    if (error) {
      if (callback) {
        callback(error);
      }
      return;
    }
    self.invalidateLogin();
    callback(error, result);
  });
};

// FIXME: this also should get called anytime the server doesn't like
// our login, like any failed get or put request
SyncService.prototype.invalidateLogin = function () {
  if (this.onlogout) {
    this.onlogout();
  }
  this.sendStatus({login: false});
};

// Getter
SyncService.prototype.lastSyncTime = function () {
  if (this._lastSyncTime) {
    return this._lastSyncTime;
  } else {
    return 0;
  }
};

SyncService.prototype._setLastSyncTime = function (timestamp) {
  if (typeof timestamp != 'number') {
    throw 'Must _setLastSyncTime to number (not ' + timestamp + ')';
  }
  this._lastSyncTime = timestamp;
  // Note that we're just storing this for later, so we don't need to know
  // when it gets really saved:
  this.storage.put('lastSyncTime', this._lastSyncTime);
};

SyncService.prototype._setLastSyncPut = function (timestamp) {
  if (typeof timestamp != 'number') {
    throw 'Must _setLastSyncPut to number (not ' + timestamp + ')';
  }
  this._lastSyncPut = timestamp;
  // Note that we're just storing this for later, so we don't need to know
  // when it gets really saved:
  this.storage.put('lastSyncPut', this._lastSyncPut);
};

SyncService.prototype.setAppTracking = function (value) {
  this._appTracking = value;
  this.storage.put('appTracking', value);
};

/* Does a full sync, both getting updates and putting any pending
   local changes.

   By default if the collection has been deleted on the server this
   will fail with callback({collection_deleted: true}), but if
   forcePut is true then it will continue despite that change
   (effectively recreating the collection and ignore the delete).
   Ideally you should confirm with the user before recreating a
   collection this way. */
SyncService.prototype.syncNow = function (callback, forcePut) {
  var self = this;
  log('Starting syncNow');
  logGroup();
  this._getUpdates(function (error) {
    if (error && error.collection_deleted && (! forcePut)) {
      log('Terminating sync due to collection deleted');
      logGroupEnd();
      if (callback) {
        callback(error);
      }
      return;
    }
    if (error && (! error.collection_deleted)) {
      log('getUpdates error/terminating', {error: error});
      logGroupEnd();
      self.sendStatus({error: 'sync_get', detail: error});
      if (callback) {
        callback(error);
      }
      return;
    }
    self.sendStatus({status: 'sync_get'});
    if (error && error.collection_deleted) {
      log('Collection is deleted, but ignoring');
      self.sendStatus({error: 'sync_get_deleted', detail: error});
      // However, since it's been deleted we need to reset, and we
      // can then continue with the put
      self.reset(function () {
        self._putUpdates(function (error) {
          logGroupEnd();
          if (callback) {
            callback(error);
          }
        });
      });
      return;
    }
    self._putUpdates(function (error) {
      log('finished syncNow', {error: error});
      logGroupEnd();
      if (callback) {
        callback(error);
      }
    });
  });
};

/* Deletes the server-side collection, not affecting anything local
   The reason is stored on the server. */
SyncService.prototype.deleteCollection = function (reason, callback) {
  var self = this;
  if (typeof reason == 'string') {
    reason = {reason: reason};
  }
  if (! reason.client_id) {
    reason.client_id = 'unknown';
  }
  // FIXME: add client_id to reason (when we have a client_id)
  this.server.deleteCollection(reason, function (error, result) {
    if (error) {
      self.sendStatus({error: 'delete_collection', detail: error});
      if (callback) {
        callback(error);
      }
      return;
    }
    self._setLastSyncTime(0);
    self._setLastSyncPut(0);
    self.sendStatus({status: 'delete_collection'});
    callback(error, result);
  });
};

/* Gets updates, immediately applying any changes to the repo.

   Calls callback with no arguments on success */
SyncService.prototype._getUpdates = function (callback) {
  var self = this;
  this.server.get(this.lastSyncTime(), function (error, results) {
    // FIXME: check error
    log('Ran GET', {since: self.lastSyncTime(), results: results, error: error});
    if (error) {
      self.sendStatus({error: 'server_get', detail: error});
      if (callback) {
        callback(error);
      }
      return;
    }
    if (! self.confirmUUID(results.uuid)) {
      if (callback) {
        callback({error: "uuid_changed"});
      }
      return;
    }
    self._processUpdates(results.applications, function (error) {
      log('finished processUpdates', {error: error, until: results.until});
      if (error) {
        callback(error);
        return;
      }
      self._setLastSyncTime(results.until);
      if (results.incomplete) {
        log('Refetching next batch');
        self._getUpdates(callback);
        return;
      }
      if (callback) {
        callback();
      }
    });
  });
};

/* Given the applications from a server get request, applies those changes to
   the repo. */
SyncService.prototype._processUpdates = function (apps, callback) {
  var appsToAdd = [];
  var appsToDelete = [];
  var deletionsToRemove = [];
  var appsToUpdate = [];
  var self = this;
  this.sendStatus({status: 'process_updates', number: apps ? apps.length : 0});
  if ((! apps) || (! apps.length)) {
    log('No apps to process');
    callback();
    return;
  }
  log('processing updates', {length: apps.length, apps: apps});
  this.repo.listUninstalled(function (deleted) {
    var deletedByOrigin = {};
    for (var i=0; i<deleted.length; i++) {
      deletedByOrigin[deleted[i].origin] = deleted[i];
    }
    self.repo.list(function (existing) {
      // FIXME: this coercion is due to some inconsistencies in list()
      // implementations; should be removed once everyone is
      // consistent:
      existing = objectValues(existing);
      log('got existing stuff', {existing: existing, deleted: deleted});
      var existingByOrigin = {};
      for (var i=0; i<existing.length; i++) {
        existingByOrigin[existing[i].origin] = existing[i];
      }
      for (i=0; i<apps.length; i++) {
        var app = apps[i];
        if (deletedByOrigin.hasOwnProperty(app.origin)) {
          if ((! app.deleted) && (app.last_modified > deletedByOrigin[app.origin].last_modified)) {
            // A deleted app is being re-installed
            deletionsToRemove.push(app.origin);
            appsToAdd.push(app);
          } // Otherwise the local deletion stands
          continue;
        }
        if (existingByOrigin.hasOwnProperty(app.origin)) {
          if (app.last_modified > existingByOrigin[app.origin].last_modified) {
            if (app.deleted) {
              appsToDelete.push(app);
            } else {
              appsToUpdate.push(app);
            }
          } // Otherwise the local version is newer
          continue;
        }
        // In this case we've never seen this app before
        appsToAdd.push(app);
      }
      var expected = 0;
      // This is to ensure the callback isn't called until we go through all
      // the operations
      var finished = false;
      var expectedCallback = function () {
        expected--;
        if (finished && expected == 0) {
          callback();
        }
        log('expectedCallback', {expected: expected, finished: finished});
      };
      log('results', {deleteRemovals: deletionsToRemove, toAdd: appsToAdd, toDelete: appsToDelete});
      for (i=0; i<deletionsToRemove.length; i++) {
        var origin = deletionsToRemove[i];
        expected++;
        self.repo.removeDeletion(origin, expectedCallback);
      }
      for (i=0; i<appsToAdd.length; i++) {
        var app = appsToAdd[i];
        app.remotely_installed = true;
        expected++;
        self.repo.addApplication(app.origin, app, expectedCallback);
      }
      for (i=0; i<appsToDelete.length; i++) {
        var app = appsToDelete[i];
        expected++;
        self.repo.uninstall(app.origin, expectedCallback);
      }
      if (expected == 0) {
        // Apparently the operations weren't async, so they've already
        // all run... or there was nothing to run.
        callback();
        return;
      }
      finished = true;
    }, function (error) {callback(error || undefined);});
  }, function (error) {callback(error || undefined);});
};

/* Sends any updates the service finds to the remote server.

   Calls callback() with no arguments on success. */
SyncService.prototype._putUpdates = function (callback) {
  var lastUpdate = this._lastSyncPut;
  var self = this;
  this.repo.list(function (appList) {
    self.repo.listUninstalled(function (uninstalled) {
      self._putUpdatesFromApps(appList, uninstalled, callback);
    }, function (error) {
      if (callback) {
        callback(error || true);
      }
    });
  }, function (error) {
    if (callback) {
      callback(error || true);
    }
  });
};

SyncService.prototype._putUpdatesFromApps = function (appList, uninstalled, callback) {
  var appTracking = this._appTracking;
  var self = this;
  if (appTracking === null || appTracking === undefined) {
    log('appTracking has not been fetched yet, cancelling put');
    // FIXME: should we put an error here?
    callback();
    return;
  }
  appList = objectValues(appList);
  log('putUpdates processing', {lastPut: this._lastSyncPut});
  var toUpdate = [];
  for (var i=0; i<appList.length; i++) {
    var app = appList[i];
    if (! app.last_modified) {
      log('App missing last_modified', {app: app});
      app.last_modified = new Date().getTime();
      // We'll update the repo, but we don't need to wait for that to finish,
      // as we've updated "our" copy of the app
      this.repo.addApplication(app.origin, app);
      // FIXME: this should signal some error, but to whom?
      continue;
    }
    // FIXME: strictly speaking, we shouldn't really skip these, as this
    // allows apps to be replicated around...
    if (app.remotely_installed) {
      continue;
    }
    if ((! this._lastSyncPut)
        || (! appTracking[app.origin])
        || (app.last_modified > appTracking[app.origin])) {
      log('Adding app toUpdate:', {origin: app.origin, lastSyncPut: this._lastSyncPut, last_modified: app.last_modified, tracking: appTracking[app.origin]});
      toUpdate.push(app);
    } else {
      log('Skipping toUpdate:', {app: app, lastSyncPut: this._lastSyncPut, lastModified: app.last_modified, appTracking: appTracking});
    }
  }
  for (var i=0; i<uninstalled.length; i++) {
    var app = uninstalled[i];
    if (! app.last_modified) {
      log('Uninstalled app missing last_modified', {app: app});
      // We don't have a good way to fix this
      continue;
    }
    if ((! this._lastSyncPut)
        || (! appTracking[app.origin])
        || (app.last_modified > appTracking[app.origin])) {
      log('Adding deletion to toUpdate:', {origin: app.origin});
      toUpdate.push({origin: app.origin, deleted: true, last_modified: app.last_modified});
    }
  }
  this.sendStatus({status: 'sync_put', count: toUpdate.length});
  if (! toUpdate.length) {
    log('No updates to send');
    if (callback) {
      callback();
    }
    return;
  }
  log('putUpdates', {updates: toUpdate});
  // FIXME: we *must* include a 'since' key here to protect from
  // a concurrent update since our last get
  this.server.put(toUpdate, function (error, result) {
    log('server put completed', {error: error, result: result});
    if (error) {
      self.sendStatus({error: 'sync_put', detail: error});
      if (callback) {
        callback(error);
      }
      return;
    }
    if (! self.confirmUUID(result.uuid)) {
      if (callback) {
        callback({error: "uuid_changed"});
      }
      return;
    }
    self.sendStatus({status: 'sync_put_complete'});
    var tracking = self.storage.get('appTracking', function (tracking) {
      if (! tracking) {
        log('WARNING: appTracking is not set');
        tracking = {};
      }
      for (var i=0; i<toUpdate.length; i++) {
        tracking[toUpdate[i].origin] = toUpdate[i].last_modified;
      }
      self._appTracking = tracking;
      self.storage.put('appTracking', tracking);
    });
    self._setLastSyncPut(result.received);
    self._setLastSyncTime(result.received);
    callback();
  });
};

// Just logging helpers, should be removed at some later date...
function log(msg) {
  if (typeof console == 'undefined' || (! console.log)) {
    return;
  }
  var args = [msg];
  for (var i=1; i<arguments.length; i++) {
    var a = arguments[i];
    if (a === undefined || a === null || a === "") {
      continue;
    }
    if (typeof a == "object") {
      for (var j in a) {
        if (a.hasOwnProperty(j) && a[j] !== undefined && a[j] !== null && a[j] !== "") {
          args.push(j + ":");
          args.push(a[j]);
        }
      }
    } else {
      args.push(a);
    }
  }
  if (typeof exports != 'undefined') {
    // Jetpack doesn't log too nicely, we'll fix it up
    for (var i=0; i<args.length; i++) {
      if (typeof args[i] == 'object' && args[i] !== null) {
        args[i] = JSON.stringify(args[i]);
      }
    }
  }
  console.log.apply(console, args);
}

function logGroup() {
  if (console && console.group) {
    console.group();
  }
}

function logGroupEnd() {
  if (console && console.groupEnd) {
    console.groupEnd();
  } else if (console && console.endGroup) {
    console.endGroup();
  }
}

function objectValues(o) {
  if (o.length) {
    // It's already an array
    return o;
  }
  var result = [];
  for (var i in o) {
    if (o.hasOwnProperty(i)) {
      result.push(o[i]);
    }
  }
  return result;
}


/* A wrapper around the server API.

   The url is the url of the /verify entry point to the server */
var Server = function (url) {
  this._url = url;
  this._loginStatus = null;
  // After login ._collectionUrl is the actual place we put updates:
  this._collectionUrl = null;
  // This is a header sent with all requests (after login):
  this._httpAuthorization = null;
  this.authData = null;
};

/* Logs in with the assertion data {assertion: string, audience: origin} */
Server.prototype.login = function (data, callback) {
  var self = this;
  var assertion = data.assertion;

  if (! assertion) {
    throw "You must provide an assertion ({assertion: 'value'})";
  }
  var audience = data.audience;
  if (! audience) {
    throw "You must provide an audience ({audience: 'domain'})";
  }
  var req = this._createRequest('POST', self._url);
  req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  req.onreadystatechange = function () {
    if (req.readyState != 4) {
      return;
    }
    // FIXME: maybe should check for status == 0 specifically; that typically
    // means some CORS error or other connection issue
    if (req.status != 200) {
      callback({error: "Bad response from " + self._url + ": " + req.status,
                request: req, text: req.responseText});
      return;
    }
    var data = JSON.parse(req.responseText);
    if (data.status == "failed") {
      callback({error: data.reason});
      return;
    }
    self._processLogin(data, callback);
  };
  req.send('assertion=' + encodeURIComponent(assertion)
           + '&audience=' + encodeURIComponent(audience));
};

Server.prototype._processLogin = function (data, callback) {
  if (! data.email) {
    callback(data);
    return;
  }
  this.authData = data;
  this._loginStatus = data;
  this._collectionUrl = data.collection_url;
  this._httpAuthorization = data.http_authorization;
  if (callback) {
    callback(null, data);
  }
};

Server.prototype.loggedIn = function () {
  return this._loginStatus !== null;
};

Server.prototype.logout = function (callback) {
  this._loginStatus = null;
  this._collectionUrl = null;
  this._httpAuthorization = null;
  this.authData = null;
  callback();
};

/* The server takes the assertion and turns it into a real email
   address etc, so this function gives access to those values */
Server.prototype.userInfo = function () {
  if (this._loginStatus === null) {
    return null;
  }
  // Not sure if any other records should be included?
  return {
    email: this._loginStatus.email,
    "valid-until": this._loginStatus['valid-until']
  };
};

Server.prototype._createRequest = function (method, url) {
  var req;
  if (typeof exports !== "undefined") {
    req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
      .createInstance(Ci.nsIXMLHttpRequest);
  } else {
    req = new XMLHttpRequest();
  }

  req.open(method, url);
  if (this._httpAuthorization) {
    req.setRequestHeader('Authorization', this._httpAuthorization);
  }
  return req;
};

/* Does a GET request on the server, getting all updates since the
   given timestamp */
Server.prototype.get = function (since, callback) {
  if (since === null) {
    since = 0;
  }
  if (! this._loginStatus) {
    throw 'You have not yet logged in';
  }
  if (typeof since != 'number') {
    throw 'In get(since, ...) since must be a number or null';
  }
  var url = this._collectionUrl;
  url += '?since=' + encodeURIComponent(since);
  var req = this._createRequest('GET', url);
  req.onreadystatechange = function () {
    if (req.readyState != 4) {
      return;
    }
    if (req.status != 200) {
      callback({error: "Non-200 response code", code: req.status, url: url, request: req, text: req.responseText});
      return;
    }
    var data = JSON.parse(req.responseText);
    if (data.collection_deleted) {
      callback(data, null);
    } else {
      callback(null, data);
    }
  };
  req.send();
};

// FIXME: should have since/lastget here, to protect against concurrent puts
Server.prototype.put = function (data, callback) {
  if (! this._loginStatus) {
    throw 'You have not yet logged in';
  }
  data = JSON.stringify(data);
  var req = this._createRequest('POST', this._collectionUrl);
  // FIXME: add since?
  req.onreadystatechange = function () {
    if (req.readyState != 4) {
      return;
    }
    if (req.status != 200) {
      callback({error: "Non-200 response code", code: req.status, url: this._collectionUrl, request: req});
      return;
    }
    var data = JSON.parse(req.responseText);
    callback(null, data);
  };
  req.send(data);
};

Server.prototype.deleteCollection = function (reason, callback) {
  if (! this._loginStatus) {
    throw 'You have not logged in yet';
  }
  var data = JSON.stringify(reason);
  var url = this._collectionUrl + '?delete';
  var req = this._createRequest('POST', url);
  req.onreadystatechange = function () {
    if (req.readyState != 4) {
      return;
    }
    if (req.status != 200) {
      callback({error: "Non-200 response code", code: req.status, url: url, request: req});
      return;
    }
    if (req.responseText) {
      var data = JSON.parse(req.responseText);
    } else {
      var data = null;
    }
    callback(null, data);
  };
  req.send(data);
};

Server.prototype.toString = function () {
  return '[Server url: ' + this._url + ']';
};


function Scheduler(service) {
  var self = this;
  this.service = service;
  this.service.onlogin = function () {
    self.activate();
  };
  this.service.onlogout = function () {
    self.deactivate();
  };
  this.service.onretryafter = function (retryAfter) {
    self.resetSchedule();
    self._period = retryAfter;
    self.schedule();
  };
  this._timeoutId = null;
  this._nextRun = null;
  this._period = this.settings.normalPeriod;
  this._retryAfter = null;
  if (this.service.loggedIn()) {
    this.activate();
  }
  this.lastSuccessfulSync = null;
  this.onerror = null;
  this.onsuccess = null;
}

/* These default settings inform some of the adaptive scheduling */
// FIXME: do some adaptive scheduling
Scheduler.prototype.settings = {
  maxPeriod: 60*60000, // 1 hour
  minPeriod: 30000, // 30 seconds
  normalPeriod: 5000 // 5 minutes
};

/* Called when we should start regularly syncing (generally after
   login) */
Scheduler.prototype.activate = function () {
  this.deactivate();
  this.resetSchedule();
  this.schedule();
};

/* Stops any regular syncing, if any is happening */
Scheduler.prototype.deactivate = function () {
  if (this._timeoutId) {
    win.clearTimeout(this._timeoutId);
    this._timeoutId = null;
  }
};

Scheduler.prototype.resetSchedule = function () {
  this._nextRun = this.settings.normalPeriod;
};

Scheduler.prototype.schedule = function () {
  var self = this;
  if (this._timeoutId) {
    win.clearTimeout(this._timeoutId);
  };
  this._timeoutId = win.setTimeout(function () {
    try {
      self.service.syncNow(function (error, result) {
        if (error && self.onerror) {
          self.onerror(error);
        }
        self.schedule();
        this.lastSuccessfulSync = new Date().getTime();
        if (self.onsuccess) {
          self.onsuccess();
        }
      });
    } catch (e) {
      if (self.onerror) {
        self.onerror(e);
      }
      self.schedule();
    }
  }, this._nextRun);
};

/* For Jetpack */
if (typeof exports !== "undefined") {
  exports.Server = Server;
  exports.Service = SyncService;
  exports.Scheduler = Scheduler;
}
