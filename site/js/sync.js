function EventMixin(self) {
  self._listeners = {};

  self.addEventListener = function (event, callback) {
    if (! (event in self._listeners)) {
      self._listeners[event] = [];
    }
    self._listeners[event].push(callback);
  };

  self.removeEventListener = function (event, callback) {
    if (! (event in self._listeners)) {
      return;
    }
    for (var i=0; i<self._listeners[event].length; i++) {
      if (self._listeners[event][i] === callback) {
        self._listeners[event].splice(i, 1);
        return;
      }
    }
  };
  
  self.dispatchEvent = function (name, event) {
    if (! (name in self._listeners)) {
      return true;
    }
    var result = true;
    for (var i=0; i<self._listeners[name].length; i++) {
      // FIXME: This isn't quite right...
      if (self._listeners[name][i](event) === false) {
        result = false;
      }
    }
    return result;
  };
  return self;
}

function Sync(options) {
  var self = {};
  // FIXME: default?
  self.url = options.url;
  self.storage = options.storage || Storage;

  if (self.url.search(/\/$/) != -1) {
    self.url = self.url.substr(0, self.url.length-1);
  }
  self.addHeaders = options.addHeaders;
  self.defaultError = options.error;
  self.defautBeforeSend = options.beforeSend;

  function getSyncer() {
    var s = self.storage.open('sync').get('sync');
    if (s === undefined || s === null) {
      s = {};
    }
    return s;
  }

  function saveSyncer(s) {
    self.storage.open('sync').put('sync', s);
  }

  self.clearServer = function (options) {
    /* Clears *all* data for the user from the sync server.

    Does not log the user out or otherwise disclaim the existance
    of the logged in credentials, just the sync'd applications. */
    options = options || {};
    ajax({
      url: userUrl(),
      type: 'DELETE',
      success: function (result) {
        if (options.success) {
          options.success();
        }
      },
      error: options.error
    });
  };

  self.pull = function (options) {
    options = options || {};
    var s = getSyncer();
    if (s.lastPull) {
      var addHeaders = {'X-If-Modified-Since-Timestamp': s.lastPull};
    } else {
      var addHeaders = null;
    }

    ajax({
      url: userUrl(),
      dataType: 'json',
      addHeaders: addHeaders,
      success: function (result, statusTest, req) {
        if (! result) {
          result = {installed: {}, deleted: {}}
        }
        // FIXME: I should check for Not Modified
        s.lastPull = parseFloat(req.getResponseHeader('X-Server-Timestamp'));
        mergeManifests(result, s.lastPull);
        saveSyncer(s);
        if (options.success) {
          options.success.call(window);
        }
      },
      error: options.error
    });
  };

  self.push = function (options) {
    options = options || {};
    ajax({
      url: userUrl(),
      addHeaders: {'Content-Type': 'application/json'},
      data: JSON.stringify(collectManifests()),
      type: 'POST',
      success: function (result, status, req) {
        var s = getSyncer();
        var timestamp = parseFloat(req.getResponseHeader('X-Server-Timestamp'));
        s.lastPush = timestamp;
        updatePushTimes('app', timestamp);
        updatePushTimes('deletedapp', timestamp);
        saveSyncer(s);
        if (options.success) {
          options.success.call(window);
        }
      },
      error: options.error
    });
  };

  function collectManifests() {
    var result = {
      installed: {},
      deleted: {}
    };
    var apps = self.storage.open('app');
    apps.iterate(function (key, app) {
      result.installed[key] = app;
    });
    var deleted = self.storage.open('deletedapp');
    deleted.iterate(function (key, tombstone) {
      result.deleted[key] = tombstone;
    });
    return result;
  };

  function mergeManifests(retrieved, timestamp) {
    // FIXME: I'm not sure the timestamp is the right thing to use here.
    // Should the server set these values itself?  Or... the client?
    var apps = self.storage.open('app');
    var deleted = self.storage.open('deletedapp');
    if (retrieved.deleted) {
      for (var i in retrieved.deleted) {
        retrieved.deleted[i].lastPull = retrieved.deleted[i].lastPush = timestamp;
        var app = apps.get(i);
        if (app === undefined) {
          deleted.put(i, retrieved.deleted[i]);
        } else {
          if (app.lastPushed &&
              retrieved.deleted[i].lastPushed > app.lastPushed) {
            apps.remove(i);
            deleted.put(i, retrieved.deleted[i]);
          } // If not true, we just avoid copying the deletion
        }
      }
    }
    for (i in retrieved.installed) {
      retrieved.installed[i].lastPull = retrieved.installed[i].lastPush = timestamp;
      var app = apps.get(i);
      if (app === undefined) {
        apps.put(i, retrieved.installed[i]);
      } else {
        if (app.lastPushed &&
            retrieved.installed[i].lastPushed > app.lastPushed) {
          apps.put(i, retrieved.installed[i]);
        } // Otherwise the existing manifest wins
      }
    }
  }

  function updatePushTimes(objType, time) {
    var objs = self.storage.open(objType);
    var keys = objs.keys();
    for (var i=0; i<keys.length; i++) {
      var app = objs.get(keys[i]);
      if (! app) {
        continue;
      }
      app.lastPush = time;
      objs.put(keys[i], app);
    }
  }

  self.isLoggedIn = function (options) {
    ajax({
      url: self.url + '/login-status',
      dataType: 'json',
      success: function (result) {
        // In the future, this should be replaced with a simple cookie check
        options.success(result.displayName ? true : false);
      },
      error: options.error
    });
  };

  self.loginStatus = function (options) {
    ajax({
      url: self.url + '/login-status',
      dataType: 'json',
      success: function (result) {
        options.success(result);
      },
      error: options.error
    });
  };

  var ajax = function (options) {
    options.error = options.error || self.defaultError;
    if (options.addHeaders) {
      var headers = mergeObjects(options.addHeaders, self.addHeaders);
    } else {
      var headers = self.addHeaders;
    }
    var oldBeforeSend = options.beforeSend || self.defaultBeforeSend;
    options.beforeSend = function (req) {
      req.url = options.url;
      req.method = options.type || 'GET';
      console.log(req, req.url);
      for (var header in headers) {
        req.setRequestHeader(header, headers[header]);
      }
      if (oldBeforeSend) {
        oldBeforeSend(req);
      }
    };
    $.ajax(options);
  };

  var userUrl = function () {
    return self.url + '/data/{' + self.user + '}';
  };

  var mergeObjects = function (ob1, ob2) {
    var newObject = {};
    for (var i in ob1) {
      newObject[i] = ob1[i];
    }
    for (i in ob2) {
      newObject[i] = ob2[i];
    }
    return newObject;
  };

  // FIXME: read a cookie or something
  self.user = options.forceUser || 'test';

  EventMixin(self);
  return self;
}
