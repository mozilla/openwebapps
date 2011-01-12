function Sync(options) {
  var self = {};
  self.url = options.url;
  self.username = options.username;
  self.password = options.password;
  self.storage = options.storage;

  if (self.url.search(/\/$/) != -1) {
    self.url = self.url.substr(0, self.url.length-1);
  }
  self.defaultError = options.error;
  self.addHeaders = options.addHeaders;
  self.defautBeforeSend = options.beforeSend;
  self.timestampOffset = 0;

  function getSyncer() {
    /* Get the object from storage, where we store information
    about the last time we talked to the server */
    var s = self.storage.open('sync').get('sync');
    if (s === undefined || s === null) {
      s = {};
    }
    return s;
  }

  function saveSyncer(s) {
    self.storage.open('sync').put('sync', s);
  }

  self.getTimestamp = function () {
    /* Gets the time, estimated as how as the server thinks is the
    time.  We keep track of the local/browser timestamp's difference
    from the server and use that to adjust.  But it's only a
    best-effort. */
    var timestamp = (new Date()).getTime() / 1000;
    if (self.timestampOffset) {
      timestamp += self.timestampOffset;
    }
    return timestamp;
  };

  self.clearServer = function (options) {
    /* Clears *all* data for the user from the sync server.

    Does not log the user out or otherwise disclaim the existance
    of the logged in credentials, just the sync'd applications. */
    options = options || {};
    ajax({
      url: userUrl(true),
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
    /* Pull changes from the server.  This should always be performed
    before calling sync.push().  This pulls the document from the web
    and then merges in any changes (deletes and changes).

    options.success is called in case of a success
    options.error is called in case the request fails
    */
    options = options || {};
    var s = getSyncer();
    if (s.lastPull) {
      var addHeaders = {'X-If-Modified-Since': s.lastPull};
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
        } else {
          result = JSON.parse(result.payload);
        }
        // FIXME: I should check for Not Modified
        var lastPull = requestTimestamp(req);
        if (lastPull) {
          s.lastPull = lastPull;
          var myTime = (new Date()).getTime() / 1000;
          self.timestampOffset = s.lastPull - myTime;
        }
        mergeManifests(result);
        if (lastPull) {
          saveSyncer(s);
        }
        if (options.success) {
          options.success.call(window);
        }
      },
      /* FIXME: Maybe we should catch 404 and ignore it, as it's kind
      of an okay failure? */
      error: function (req) {
        if (req.status == 404) {
          // This is basically okay, it means there's nothing to
          // pull
          var lastPull = requestTimestamp(req);
          // On 404 we don't always get a good timestamp:
          if (lastPull) {
            s.lastPull = lastPull;
            saveSyncer(s);
          }
          options.success.call(window);
        } else {
          options.error.apply(window, arguments);
        }
      }
    });
  };

  self.push = function (options) {
    /* Push the current apps to the server.  This unconditionally
    overwrites everything on the server, the idea being that if we
    clobbered someone else's updates then they'll pull ours, merge,
    and overwrite ours eventually.  But it's good to always call
    .pull() before .push() for this reason.

    This collects all the apps from the storage.  It also makes
    sure .lastModified is updated on all the apps before sending.

    options.success: called if the push is successful
    options.error: called in case of a problem
    */
    options = options || {};
    var pushTimestamp = self.getTimestamp();
    var manifests = collectManifests(pushTimestamp);
    ajax({
      url: userUrl(),
      addHeaders: {'Content-Type': 'application/json'},
      data: JSON.stringify({'id': 'apps', 'payload': JSON.stringify(manifests)}),
      // FIXME: some networks might not allow PUT, only POST...
      type: 'PUT',
      dataType: 'text',
      success: function (result, status, req) {
        var s = getSyncer();
        var timestamp = requestTimestamp(req, result);
        if (timestamp) {
          s.lastPush = timestamp;
          saveSyncer(s);
        }
        if (options.success) {
          options.success();
        }
      },
      error: options.error
    });
  };

  self.trackPushNeeded = function () {
    /* Tracks if we need to push any changes, or if the server is
    up-to-date.  This sets up event listeners to check for changes,
    and reset self._needPush if necessary. */
    // FIXME: in case of clobbering, maybe we should notice that the
    // timestamp has changed?  Though we always do a push on a restart
    // so it won't be broken forever.
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
    // We need to start with a push, because we don't know anything about
    // the server status
    // FIXME: look at the lastPush to see if push is needed?
    self._needPush = true;
  };

  function collectManifests(timestamp) {
    /* Collects all the manifests (and deleted manifests) from storage,
    and creates a JSON document that we can push to the sync server. */
    var result = {
      installed: {},
      deleted: {}
    };
    var apps = self.storage.open('app');
    apps.iterate(function (key, app) {
      if (! app.lastModified) {
        app.lastModified = timestamp;
        apps.put(key, app);
      }
      result.installed[key] = app;
    });
    var deleted = self.storage.open('deletedapp');
    deleted.iterate(function (key, tombstone) {
      if (! tombstone.lastModified) {
        tombstone.lastModified = timestamp;
        deleted.put(key, tombstone);
      }
      result.deleted[key] = tombstone;
    });
    return result;
  };

  function mergeManifests(retrieved) {
    var apps = self.storage.open('app');
    var deleted = self.storage.open('deletedapp');
    if (retrieved.deleted) {
      for (var i in retrieved.deleted) {
        // check hasOwnProperty?
        var app = apps.get(i);
        if (app === undefined) {
          deleted.put(i, retrieved.deleted[i]);
        } else {
          if (app.lastModified &&
              retrieved.deleted[i].lastModified > app.lastModified) {
            apps.remove(i);
            deleted.put(i, retrieved.deleted[i]);
          } // If not true, we just avoid copying the deletion
        }
      }
    }
    for (i in retrieved.installed) {
      var deletedapp = deleted.get(i);
      var oldLastPush = retrieved.installed[i].lastPush;
      if (deletedapp) {
        if (! deletedapp.lastModified
            || deletedapp.lastModified > lastModified) {
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
      } else {
        if (app.lastModified &&
            retrieved.installed[i].lastModified > app.lastModified) {
          apps.put(i, retrieved.installed[i]);
        } // Otherwise the existing manifest wins
      }
    }
  }

  self.pollTimerId = null;
  self.pollTime = 5000;
  var pollPull = true;

  self.pollSyncServer = function (setPollTime) {
    if (setPollTime) {
      self.pollTime = setPollTime;
    }
    self.cancelSyncServerPoll();
    self.trackPushNeeded();
    runPoll();
  };

  self.cancelSyncServerPoll = function () {
    if (self.pollTimerId) {
      clearTimeout(self.pollTimerId);
      self.pollTimerId = null;
    }
  };

  function runPoll() {
    // Flip each time between pulling and pushing:
    function rerun() {
      self.pollTimerId = setTimeout(runPoll, self.pollTime);
    }
    function cancelIfNeeded(req) {
      if (typeof console != 'undefined') {
        console.log('Problem with request:', req);
      }
      if (req.status === 0) {
        // Means the server isn't there
        // FIXME: on Chrome this seems to happen with failed requests
        // (maybe cross-origin?)
        self.pollTimerId = null;
        return;
      } else {
        rerun();
      }
    }
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
    if (self.username) {
      req.setRequestHeader('Authorization',
        'Basic ' + Crypto.util.bytesToBase64(
          Crypto.charenc.UTF8.stringToBytes(
            self.username + ':' + self.password)));
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

  var userUrl = function (collection) {
    // FIXME: this should be a UUID or something like that?
    // (instead of '/openwebapps/apps')
    var url = self.url + '/1.0/' + self.username + '/storage/openwebapps/';
    if (! collection) {
      url += 'apps';
    }
    return url;
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

  var requestTimestamp = function (req, possibleDefault) {
    /* Return the timestamp, using X-Weave-Timestamp if possible, Date
    otherwise, or possibleDefault lastly. */
    var val = req.getResponseHeader('X-Weave-Timestamp');
    if (val) {
      return parseFloat(val);
    }
    val = req.getResponseHeader('Date');
    if (val) {
      return (new Date(val)).getTime() / 1000;
    }
    if (possibleDefault) {
      return parseFloat(possibleDefault);
    }
    // This gets called way too often :( -- apparently cross-domain
    // requests maybe have all their headers filtered?  Ugh.
    return self.getTimestamp();
  };

  EventMixin(self);
  return self;
}
