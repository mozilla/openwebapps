function Sync(options) {
  var self = {};
  // FIXME: default?
  self.url = options.url;
  self.storage = options.storage;

  if (self.url.search(/\/$/) != -1) {
    self.url = self.url.substr(0, self.url.length-1);
  }
  self.addHeaders = options.addHeaders;
  self.defaultError = options.error;
  self.defautBeforeSend = options.beforeSend;
  self.timestampOffset = 0;

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
          result = {installed: {}, deleted: {}};
        }
        // FIXME: I should check for Not Modified
        s.lastPull = parseFloat(req.getResponseHeader('X-Server-Timestamp'));
        var myTime = (new Date()).getTime();
        self.timestampOffset = s.lastPull - myTime;
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
    var pushTimestamp = (new Date()).getTime() + self.timestampOffset;
    ajax({
      url: userUrl(),
      addHeaders: {'Content-Type': 'application/json'},
      data: JSON.stringify(collectManifests(pushTimestamp)),
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

  self.trackPushNeeded = function () {
    if (self._needPush !== undefined) {
      // Already tracking
      return;
    }
    function needPush(event) {
      if (event.objType == 'app' || event.objType == 'deletedapp') {
        self._needPush = true;
      }
    }
    self.storage.addEventListener('change', needPush);
    self.storage.addEventListener('add', needPush);
    self._needPush = false;
  };

  function collectManifests(timestamp) {
    var result = {
      installed: {},
      deleted: {}
    };
    var apps = self.storage.open('app');
    apps.iterate(function (key, app) {
      if (! app.lastPush) {
        app.lastPush = timestamp;
      }
      result.installed[key] = app;
    });
    var deleted = self.storage.open('deletedapp');
    deleted.iterate(function (key, tombstone) {
      if (! tombstone.lastPush) {
        tombstone.lastPush = timestamp;
      }
      result.deleted[key] = tombstone;
    });
    return result;
  };

  function mergeManifests(retrieved, timestamp) {
    // FIXME: I'm not sure the timestamp is the right thing to use here.
    // Should the server set these values itself?  Or... the client?
    var apps = self.storage.open('app');
    var deleted = self.storage.open('deletedapp');
    var appChanged = false;
    var deletedappChanged = false;
    if (retrieved.deleted) {
      for (var i in retrieved.deleted) {
        retrieved.deleted[i].lastPull = retrieved.deleted[i].lastPush = timestamp;
        var app = apps.get(i);
        if (app === undefined) {
          deleted.put(i, retrieved.deleted[i]);
          deletedappChanged = true;
        } else {
          if (app.lastPushed &&
              retrieved.deleted[i].lastPushed > app.lastPushed) {
            apps.remove(i);
            deleted.put(i, retrieved.deleted[i]);
            deletedappChanged = true;
          } // If not true, we just avoid copying the deletion
        }
      }
    }
    for (i in retrieved.installed) {
      var deletedapp = deleted.get(i);
      var oldLastPush = retrieved.installed[i].lastPush;
      retrieved.installed[i].lastPull = retrieved.installed[i].lastPush = timestamp;
      if (deletedapp) {
        if (! deletedapp.lastPushed
            || deletedapp.lastPushed > oldLastPush) {
          // This app has been deleted locally, ignore this record
          continue;
        } else {
          // This app has been re-installed remotely
          apps.put(i, retrieved.installed[i]);
          deleted.remove(i);
          continue;
        }
      }
      var app = apps.get(i);
      if (app === undefined) {
        apps.put(i, retrieved.installed[i]);
        appChanged = true;
      } else {
        if (app.lastPushed &&
            retrieved.installed[i].lastPushed > app.lastPushed) {
          apps.put(i, retrieved.installed[i]);
          appChanged = true;
        } // Otherwise the existing manifest wins
      }
    }
    if (appChanged || deletedappChanged) {
      var types = [];
      if (appChanged) {
        types.push('app');
      }
      if (deletedappChanged) {
        types.push('deletedapp');
      }
      self.storage.dispatchEvent('multiplechange', {types: types});
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

  // FIXME: I don't think we need this
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

  // FIXME: I don't think we need this (cookie is sufficient):
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

  var pollTimerId = null;
  var pollTime = 5000;
  var pollPull = true;

  self.pollSyncServer = function (setPollTime) {
    if (setPollTime) {
      pollTime = setPollTime;
    }
    self.cancelSyncServerPoll();
    self.trackPushNeeded();
    runPoll();
  };

  self.cancelSyncServerPoll = function () {
    if (pollTimerId) {
      clearTimeout(pollTimerId);
      pollTimerId = null;
    }
  };

  function runPoll() {
    // Flip each time between pulling and pushing:
    function rerun() {
      pollTimerId = setTimeout(runPoll, pollTime);
    }
    function cancelIfNeeded(req) {
      if (req.status === 0) {
        // Means the server isn't there
        // FIXME: log?
        pollTimerId = null;
        return;
      } else {
        rerun();
      }
    }
    var options = {
      success: function () {
        pollTimerId = setTimeout(runPoll, pollTime);
        self._needPush = false;
      },
      error: function (req) {
        if (req.status === 0) {
          // Means the server isn't there
          // FIXME: Log this?
          pollTimerId = null;
          return;
        }
      }
    };
    if (pollPull) {
      self.pull({
        success: rerun,
        error: cancelIfNeeded
      });
    } else {
      if (self._needPush) {
        self.push({
          success: function () {
            rerun();
            self._needPush = false;
          },
          error: cancelIfNeeded
        });
      } else {
        rerun();
      }
    }
    pollPull = ! pollPull;
  }

  function ajax(options) {
    options.error = options.error || self.defaultError;
    if (options.addHeaders) {
      var headers = mergeObjects(options.addHeaders, self.addHeaders);
    } else {
      var headers = self.addHeaders;
    }
    options.beforeSend = options.beforeSend || self.defaultBeforeSend;
    options.type = options.type || 'GET';
    var req = new XMLHttpRequest();
    req.open(options.type, options.url, true);
    if (options.beforeSend) {
      options.beforeSend(req);
    }
    if (headers) {
      for (var i in headers) {
        req.setRequestHeader(i, headers[i]);
      }
    }
    if (options.contentType) {
      req.setRequestHeader('Content-Type', options.contentType);
    }
    req.onreadystatechange = function (event) {
      if (req.readyState != 4) {
        return;
      }
      if (req.status == 200) {
        var body = req.responseText;
        if (options.dataType == 'json') {
          body = JSON.parse(body);
        }
        // FIXME: statusText might be boring?
        options.success(body, req.statusText, req);
      } else if (req.status > 200 && req.status < 400) {
        // Success, but no body
        options.success(null, req.statusText, req);
      } else {
        // Failure of some sort
        // FIXME: not a good status, doesn't handle callback errors, etc.
        if (options.error) {
          options.error(req, req.statusText, null);
        }
      }
    };
    // FIXME: no timeout implemented here
    req.send(options.data || null);
    return req;
  }

  var userUrl = function () {
    return self.url + '/data/{' + encodeURIComponent(encodeURIComponent(self.user)) + '}/apps';
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

  self.readProfile = function () {
    var value = readCookie('user_info');
    if (! value) {
      return null;
    }
    value = decodeURIComponent(value.split(/\|/)[0]);
    value = JSON.parse(value);
    return value;
  };

  // FIXME: read a cookie or something
  if (options.forceUser) {
    self.user = options.forceUser;
  } else {
    var profile = self.readProfile();
    if (profile) {
      self.user = profile.identifier;
    } else {
      self.user = null;
    }
  }

  EventMixin(self);
  return self;
}


// From quirksmode:
function readCookie(name) {
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for (var i=0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1,c.length);
    }
    if (c.indexOf(nameEQ) == 0) {
      return c.substring(nameEQ.length, c.length);
    }
  }
  return null;
}
