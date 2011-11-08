var Server = function (url) {
  if (this === window) {
    throw 'You forgot new';
  }
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
    if (req.status != 200) {
      callback({error: "Bad response from " + self._url + ": " + req.status,
                req: req, text: req.responseText});
      return;
    }
    var data = JSON.parse(req.responseText);
    self._processLogin(data, callback);
  };
  req.send('assertion=' + encodeURIComponent(assertion)
           + '&audience=' + encodeURIComponent(audience));
};

Server.prototype._processLogin = function (data, callback) {
  if (data.status != 'okay') {
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
  var req = new XMLHttpRequest();
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
      callback({error: "Non-200 response code", request: req, text: req.responseText});
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
      callback({error: "Non-200 response code", request: req});
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
  var req = this._createRequest('POST', this._collectionUrl + '?delete');
  req.onreadystatechange = function () {
    if (req.readyState != 4) {
      return;
    }
    if (req.status != 200) {
      callback({error: "Non-200 response code", request: req});
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
