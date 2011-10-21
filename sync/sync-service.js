var SyncService = function (args) {
  if (this === window) {
    throw 'You forgot new';
  }
  this.pollTime = args.pollTime;
  if (this.pollTime !== null && typeof this.pollTime !== 'number') {
    throw 'Invalid pollTime argument (should be null or a number): ' + this.pollTime;
  }
  this.server = args.server;
  this.repo = args.repo;
  this.storage = args.storage || localStorage;
  var value = this.storage.getItem('lastSyncTime');
  if (value) {
    this._lastSyncTime = parseFloat(value);
  } else {
    this._lastSyncTime = null;
  }
  value = this.storage.getItem('lastSyncPut');
  if (value) {
    this._lastSyncPut = parseFloat(value);
  } else {
    this._lastSyncPut = null;
  }
  // This will get set if the server tells us to back off on polling:
  this._backoffTime = null;
};

SyncService.prototype.toString = function () {
  return '[SyncService pollTime: ' + this.pollTime + ' server: ' + this.server + ']';
};

SyncService.prototype.login = function (assertionData, callback) {
  this.server.login(assertionData, callback);
};

SyncService.prototype.loginStatus = function () {
  return this.server.loginStatus();
};

SyncService.prototype.lastSyncTime = function () {
  return this._lastSyncTime;
};

SyncService.prototype._setLastSyncTime = function (timestamp) {
  if (! timestamp) {
    // FIXME: not sure if it should ever be valid not to give a timestamp
    timestamp = new Date().getTime();
  }
  if (typeof timestamp != 'number') {
    throw 'Must _setLastSyncTime to number (not ' + timestamp + ')';
  }
  this._lastSyncTime = timestamp;
  this.storage.setItem('lastSyncTime', this._lastSynctime);
};

SyncService.prototype._setLastSyncPut = function (timestamp) {
  if (! timestamp) {
    // FIXME: not sure if it should ever be valid not to give a timestamp
    timestamp = new Date().getTime();
  }
  if (typeof timestamp != 'number') {
    throw 'Must _setLastSyncPut to number (not ' + timestamp + ')';
  }
  this._lastSyncPut = timestamp;
  this.storage.setItem('lastSyncPut', this._lastSyncPut);
};

SyncService.prototype.syncNow = function (callback) {
  var self = this;
  console.warn('starting syncNow');
  this._getUpdates(function (error) {
    if (error) {
      if (callback) {
        callback(error);
      }
      return;
    }
    self._putUpdates(function (error) {
      console.warn('finished syncNow', error);
      if (callback) {
        callback(error);
      }
    });
  });
};

SyncService.prototype._getUpdates = function (callback) {
  var self = this;
  console.log('getUpdates');
  server.get(this.lastSyncTime(), function (error, results) {
    // FIXME: check error
    if (error) {
      if (callback) {
        callback(error);
      }
      return;
    }
    console.log('getUpdates response', results);
    self._processUpdates(results.applications, function (error) {
      console.log('processUpdates finished');
      self._setLastSyncTime(results.until);
      if (results.incomplete) {
        self._getUpdates(callback);
        return;
      }
      if (callback) {
        callback(error);
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
  this.repo.listUninstalled(function (deleted) {
    var deletedByOrigin = {};
    for (var i=0; i<deleted.length; i++) {
      deletedByOrigin[deleted[i].origin] = deleted[i];
    }
    this.repo.list(function (existing) {
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
        console.log('expectedCallback', expected, finished);
      };
      console.log('results', {dr: deletionsToRemove, a: appsToAdd, d: appsToDelete});
      for (i=0; i<deletionsToRemove.length; i++) {
        var origin = deletionsToRemove[i];
        expected++;
        self.repo.removeDeletion(origin, expectedCallback);
      }
      for (i=0; i<appsToAdd.length; i++) {
        var app = appsToAdd[i];
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
      }
      finished = true;
    }, function (error) {callback(error || true);});
  }, function (error) {callback(error || true);});
};

SyncService.prototype._putUpdates = function (callback) {
  console.log('putUpdates');
  var now = new Date().getTime();
  var lastUpdate = this._lastSyncPut;
  var self = this;
  this.repo.list(function (appList) {
    var toUpdate = [];
    for (var i=0; i<appList.length; i++) {
      var app = appList[i];
      if (! app.last_modified) {
        // FIXME: this should signal some error, but to whom?
        continue;
      }
      if (app.sync) {
        continue;
      }
      if ((! self._lastSyncPut) || app.last_modified > self._lastSyncPut) {
        toUpdate.push(app);
      }
    }
    if (! toUpdate.length) {
      if (callback) {
        callback();
      }
      return;
    }
    console.log('got updates to putUpdates', toUpdate);
    server.put(toUpdate, function (error, result) {
      if (error) {
        if (callback) {
          callback(error);
        }
        return;
      }
      self._setLastSyncPut(now);
      callback();
    });
  }, function (error) {callback(error || true);});
};
