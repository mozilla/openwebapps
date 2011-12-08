/* A repo that supports just a minimum number of methods to act 
   as a decent replacement for sync use */

var MockRepo = function (name) {
  if (this === window) {
    throw 'You forgot new';
  }
  this.name = name;
  this._applications = {};
  this._deleted = {};
  this._watchers = [];
};

MockRepo.prototype.list = function (callback) {
  var result = [];
  for (var i in this._applications) {
    if (this._applications.hasOwnProperty(i)) {
      result.push(this._applications[i]);
    }
  }
  // Make async for better mocking:
  setTimeout(function () {callback(result);}, 10);
};

// Like install, but doesn't fetch manifest and doesn't confirm installation:
MockRepo.prototype.addApplication = function (origin, installRecord, callback) {
  var self = this;
  this._applications[origin] = installRecord;
  if (! installRecord.last_modified) {
    installRecord.last_modified = new Date().getTime();
  }
  if (origin in this._deleted) {
    delete this._deleted[origin];
  }
  console.log('Added app to', origin, this._applications, this._deleted);
  writeln(this.name + ' added application ', origin);
  setTimeout(function () {
    if (callback) {
      callback();
    }
    for (var i=0; i<self._watchers.length; i++) {
      self._watchers[i]('add', installRecord);
    }
  }, 10);
};

MockRepo.prototype.removeDeletion = function (origin, callback) {
  writeln(this.name + ' removing deletion ', origin);
  delete this._deleted[origin];
  if (callback) {
    setTimeout(function () {
      callback();
    }, 10);
  }
};

MockRepo.prototype.uninstall = function (origin, callback) {
  writeln(this.name + ' removed application ', origin);
  var self = this;
  var existing = !! (this._applications[origin]);
  delete this._applications[origin];
  this._deleted[origin] = new Date().getTime();
  setTimeout(function () {
    if (callback) {
      if (existing) {
        callback(true);
      } else {
        callback({error: ["noSuchApplication", "no application exists with the origin: " + origin]});
      }
    }
    for (var i=0; i<self._watchers.length; i++) {
      self._watchers[i]('remove', origin);
    }
  }, 10);
};

MockRepo.prototype.listUninstalled = function (callback) {
  var result = [];
  for (var i in this._deleted) {
    if (this._deleted.hasOwnProperty(i)) {
      result.push({last_modified: this._deleted[i], origin: i});
    }
  }
  setTimeout(function () {
    callback(result);
  }, 10);
};

MockRepo.prototype.watchUpdates = function (callback) {
  this._watchers.push(callback);
};
