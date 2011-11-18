/* For Jetpack */
var win;
if (typeof exports !== "undefined") {
  const { Cc, Ci, Cm, Cu, Cr, components } = require("chrome");
  var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
    .getService(Ci.nsIWindowMediator);  
  win = wm.getMostRecentWindow("navigator:browser"); 
} else {
  win = window;
}

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

SyncService.prototype.reset = function (callback) {
  log('reset incoming');
  var steps = 0;
  var allSet = false;
  var self = this;
  function done() {
    steps--;
    if (steps === 0 && allSet) {
      self.sendStatus({status: 'reset'});
      log('reset outgoing, async');
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
    log('reset outgoing, sync');
    if (callback) {
      callback();
    }
  } else {
    allSet = true;
  }
};

SyncService.prototype.sendStatus = function (message) {
  if (! this.onstatus) {
    return;
  }
  message.timestamp = new Date().getTime();
  this.onstatus(message);
};

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

SyncService.prototype.login = function (assertionData, callback) {
  var self = this;
  this.server.login(assertionData, function (error, result) {
    if (error) {
      if (callback) {
        callback(error);
      }
      return;
    }
    self.confirmUUID(assertionData.uuid);
    if (self.onlogin) {
      self.onlogin(result);
    }
    self.sendStatus({login: true, account: result});
    if (callback) {
      callback(error, result);
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

// FIXME: this also get called anytime the server doesn't like our login
SyncService.prototype.invalidateLogin = function () {
  if (this.onlogout) {
    this.onlogout();
  }
  this.sendStatus({login: false});
};

SyncService.prototype.lastSyncTime = function () {
  if (this._lastSyncTime) {
    return this._lastSyncTime;
  } else {
    return 0;
  }
};

SyncService.prototype._setLastSyncTime = function (timestamp) {
  if ((! timestamp) && timestamp !== 0) {
    // FIXME: not sure if it should ever be valid not to give a timestamp
    timestamp = new Date().getTime();
  }
  if (typeof timestamp != 'number') {
    throw 'Must _setLastSyncTime to number (not ' + timestamp + ')';
  }
  this._lastSyncTime = timestamp;
  // Note that we're just storing this for later, so we don't need to know
  // when it gets really saved:
  this.storage.put('lastSyncTime', this._lastSyncTime);
};

SyncService.prototype._setLastSyncPut = function (timestamp) {
  if ((! timestamp) && timestamp !== 0) {
    // FIXME: not sure if it should ever be valid not to give a timestamp
    timestamp = new Date().getTime();
  }
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
  log('processing updates', {apps: apps, repo: this.repo, uninstall: this.repo.listUninstalled});
  this.repo.listUninstalled(function (deleted) {
    var deletedByOrigin = {};
    for (var i=0; i<deleted.length; i++) {
      deletedByOrigin[deleted[i].origin] = deleted[i];
    }
    self.repo.list(function (existing) {
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

SyncService.prototype._putUpdates = function (callback) {
  var lastUpdate = this._lastSyncPut;
  var self = this;
  this.repo.list(function (appList) {
    if (self._appTracking === null) {
      log('appTracking has not been fetched yet, cancelling put');
      return;
    }
    var appTracking = self._appTracking;
    appList = objectValues(appList);
    log('putUpdates processing', {appList: appList, lastPut: self._lastSyncPut});
    var toUpdate = [];
    for (var i=0; i<appList.length; i++) {
      var app = appList[i];
      if (! app.last_modified) {
        log('App missing last_modified', {app: app});
        app.last_modified = new Date().getTime();
        // We'll update the repo, but we don't need to wait for that to finish,
        // as we've updated "our" copy of the app
        self.repo.addApplication(app.origin, app);
        // FIXME: this should signal some error, but to whom?
        continue;
      }
      // FIXME: strictly speaking, we shouldn't really skip these, as this
      // allows apps to be replicated around...
      if (app.remotely_installed) {
        continue;
      }
      if ((! self._lastSyncPut)
          || (! appTracking[app.origin])
          || (app.last_modified > appTracking[app.origin])) {
        log('Adding app toUpdate:', {origin: app.origin, lastSyncPut: self._lastSyncPut, last_modified: app.last_modified, tracking: appTracking[app.origin]});
        toUpdate.push(app);
      }
    }
    self.sendStatus({status: 'sync_put', count: toUpdate.length});
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
    self.server.put(toUpdate, function (error, result) {
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
  }, function (error) {callback(error);});
};

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

var Server = function (url) {
  this._url = url;
  this._loginStatus = null;
  this._collectionUrl = null;
  this._httpAuthorization = null;
};

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
  this._loginStatus = data;
  this._collectionUrl = data.collection_url;
  this._httpAuthorization = data.http_authorization;
  callback(null, data);
};

Server.prototype.loggedIn = function () {
  return this._loginStatus !== null;
};

Server.prototype.logout = function (callback) {
  this._loginStatus = null;
  this._collectionUrl = null;
  this._httpAuthorization = null;
  callback();
};

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

// FIXME: should probably have since here:
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

Scheduler.prototype.settings = {
  maxPeriod: 60*60000, // 1 hour
  minPeriod: 30000, // 30 seconds
  normalPeriod: 5000 // 5 minutes
};

Scheduler.prototype.activate = function () {
  this.deactivate();
  this.resetSchedule();
  this.schedule();
};

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
