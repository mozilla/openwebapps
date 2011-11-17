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
      localStorage.setItem('syncbutton-saved-login', null);
      setButtonData({logout: true}, false);
    });
    return;
  }
  var audience = getOrigin(location.href);
  var loginData = {assertion: event.newValue, audience: audience};
  login(loginData);
}, false);

function login(loginData) {
  sync.login(
    loginData, 
    function (error, status) {
      if (error) {
        setButtonData({status: "Login failed: " + JSON.stringify(error)}, true);
        localStorage.setItem('syncbutton-saved-login', null);
        setButtonData({logout: true}, false);
        return;
      }
      localStorage.setItem('syncbutton-saved-login', JSON.stringify(loginData));
      setButtonData({logout: false, username: status.email, status: null}, false);
      // FIXME: this needs to be a much fancier loop:
    }
  );
}

window.addEventListener('load', function () {
  var loginData = localStorage.getItem('syncbutton-saved-login');
  if (loginData) {
    loginData = JSON.parse(loginData);
    if (loginData) {
      login(loginData);
      return;
    }
  }
  setButtonData({logout: true}, false);
}, false);

function syncNow(callback, forcePut) {
  sync.syncNow(function (error, result) {
    // FIXME: get better way to display error
    if (error) {
      setButtonData({status: "Error syncing: " + JSON.stringify(error)}, true);
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
    setButtonData({status: "Error syncing: " + JSON.stringify(status.detail)}, true);
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
  setButtonData({status: "Error syncing: " + JSON.stringify(error)}, true);
};
