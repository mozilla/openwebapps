var MockServer = function () {
  if (this === window) {
    throw 'You forgot new';
  }
  this._last_modified = null;
  this._applications = [];
  this._loginStatus = null;
};

MockServer.prototype.login = function (data, callback) {
  var self = this;
  var assertion = data.assertion;
  if (! assertion) {
    throw "You must provide an assertion ({assertion: 'value'})";
  }
  var audience = data.audience;
  if (! audience) {
    throw "You must provide an audience ({audience: 'domain'})";
  }
  var match = /a=(.*)/.exec(assertion);
  if (match) {
    if (match[1] != audience) {
      // A (deliberately) bad login
      setTimeout(function () {
        if (callback) {
          callback({error: "audience does not match"});
        }
      }, 10);
      return;
    }
    assertion = assertion.substr(0, assertion.indexOf('?'));
  }
  setTimeout(function () {
    self._loginStatus = {
      status: "okay",
      email: assertion,
      audience: audience,
      "valid-until": new Date().getTime() + 1000,
      issuer: "browserid.org"
    };
    if (callback) {
      callback(null, self._loginStatus);
    }
  }, 10);
};

MockServer.prototype.loggedIn = function () {
  return this._loginStatus !== null;
};

MockServer.prototype.userInfo = function () {
  if (this._loginStatus === null) {
    return null;
  }
  // Not sure if any other records should be included?
  return {
    email: this._loginStatus.email, 
    "valid-until": this._loginStatus['valid-until']
  };
};

MockServer.prototype.get = function (since, callback) {
  if (since === null) {
    since = 0;
  }
  if (! this._loginStatus) {
    throw 'You have not yet logged in';
  }
  if (typeof since != 'number') {
    throw 'In get(since, ...) since must be a number or null';
  }
  var result = {since: since, until: new Date().getTime(), applications: []};
  for (var i=0; i<this._applications.length; i++) {
    var app = this._applications[i];
    if (app.last_modified >= since) {
      result.applications.push(app);
    }
  }
  setTimeout(function () {
    if (callback) {
      callback(null, result);
    }
  }, 10);
};

// FIXME: should probably have since here:
MockServer.prototype.put = function (data, callback) {
  if (! this._loginStatus) {
    throw 'You have not yet logged in';
  }
  for (var i=0; i<data.length; i++) {
    this._addApplication(data[i]);
  }
  this._finishAdd();
  setTimeout(function () {
    if (callback) {
      callback(null, {received: new Date().getTime()});
    }
  }, 10);
};

MockServer.prototype._addApplication = function (app) {
  var found = false;
  for (var i=0; i<this._applications.length; i++) {
    if (this._applications[i].origin == app.origin) {
      this._applications[i] = app;
      found = true;
      break;
    }
  }
  if (! found) {
    this._applications.push(app);
  }
};

MockServer.prototype._finishAdd = function () {
  this._applications.sort(function (a, b) {
    if (a.last_modified == b.last_modified) {
      return (a.origin < b.origin) ? -1 : 1;
    } else {
      return (a.last_modified < b.last_modified) ? -1 : 1;
    }
  });
};

MockServer.prototype.toString = function () {
  return '[MockServer]';
};
