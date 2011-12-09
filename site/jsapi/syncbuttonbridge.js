window.addEventListener('storage', function (event) {
  if (event.key == 'syncbutton-syncnow') {
    // Note we are doing forcePut, but this is all a hacky method anyway:
    console.warn('manual sync');
    syncNow(function (error, result) {console.log('synced', error, result);}, true);
    return;
  }
  if (event.key == 'syncbutton-deletenow') {
    console.warn('manual delete');
    sync.deleteCollection({reason: 'manual deletion'}, function (error) {console.log('did delete', error);});
    sync.reset(function () {console.log('did reset');});
    return;
  }
  if (event.key !== 'syncbutton-assertion') {
    return;
  }
  if (event.newValue == 'logout1' || event.newValue === 'logout2') {
    console.log('Logout out via bridge.js');
    sync.logout(function (error) {
      if (error) {
        // FIXME: how can this happen?
        // FIXME: could it mean that you were already logged out?  Ideally no
        setButtonData({status: "Logout failed: " + error}, true);
        return;
      }
      localStorage.setItem('syncbutton-saved-authdata', null);
      setButtonData({logout: true}, false);
    });
    return;
  }
  var audience = getOrigin(location.href);
  var loginData = {assertion: event.newValue, audience: audience};
  login(loginData);
}, false);

function login(loginData) {
  sync.login(loginData, loginHandler);
}

function loginHandler(error, status) {
  if (error) {
    setButtonData({status: "Login failed: " + JSON.stringify(error)}, true);
    localStorage.setItem('syncbutton-saved-authdata', null);
    setButtonData({logout: true}, false);
    return;
  }
  localStorage.setItem('syncbutton-saved-authdata', JSON.stringify(sync.getAuthData()));
  setButtonData({logout: false, username: status.email, status: null}, false);
}

window.addEventListener('load', function () {
  var authData = localStorage.getItem('syncbutton-saved-authdata');
  if (authData) {
    authData = JSON.parse(authData);
    if (authData) {
      sync.setAuthData(authData, loginHandler);
      return;
    }
  }
  setButtonData({logout: true}, false);
}, false);

function syncNow(callback, forcePut) {
  sync.syncNow(function (error, result) {
    // FIXME: get better way to display error
    if (error && (! error.error == 'uuid_changed')) {
      sync.onstatus({error: true, detail: error});
    } else {
      setButtonData({lastUpdate: new Date().getTime()}, true);
    }
    callback(error, result);
  }, forcePut);
}


function setButtonData(data, merge) {
  if (merge) {
    var mergeData = data;
    data = localStorage.getItem('syncbutton-comm');
    if (data) {
      data = JSON.parse(data);
    } else {
      data = {};
    }
    for (var i in mergeData) {
      if (mergeData.hasOwnProperty(i)) {
        data[i] = mergeData[i];
      }
    }
  }
  localStorage.setItem('syncbutton-comm', JSON.stringify(data));
}

function getOrigin(url) {
  var protocol = url.substr(0, url.indexOf('//')).toLowerCase();
  var domain = url.substr(url.indexOf('//')+2);
  if (domain.indexOf('/') != -1) {
    domain = domain.substr(0, domain.indexOf('/'));
  }
  domain = domain.toLowerCase();
  if (protocol == 'http:' && domain.search(/:80$/) != -1) {
    domain = domain.replace(/:80$/, '');
  } else if (protocol == 'https:' && domain.search(/:443$/) != -1) {
    domain = domain.replace(/:443$/, '');
  }
  return protocol + '//' + domain;
}  

var sync = new SyncService({
  repo: Repo,
  server: new Server('/verify')
});

sync.onstatus = function (status) {
  if (status.error) {
    if (status.detail.error != 'uuid_changed') {
      var message = status.detail.error;
      if (status.detail.message) {
        message = status.detail.message;
      } else if (status.detail.error == 'Non-200 response code') {
        message = 'server error';
      } 
      setButtonData({status: "Error: " + message}, true);
    }
  } else if (status.status) {
    if (status.status == 'sync_get') {
      setButtonData({last_sync_get: status.timestamp}, true);
    } else if (status.status == 'sync_put_complete' || (status.status == 'sync_put' && status.count === 0)) {
      setButtonData({last_sync_put: status.timestamp}, true);
    }
  }
};

var scheduler = new Scheduler(sync);
scheduler.onerror = function (error) {
  sync.onstatus({error: true, detail: error});
};
