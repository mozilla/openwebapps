
var callid = 0;

function _makeCall(msg, args, callback, errcb) {
  let data = {
    location: location.href,
    data: args
  };
  callid++;
  if (callback) {
    data.success = msg+".success."+callid;
    self.port.once(data.success, function(data) {
      //dump("msg "+msg+" got "+JSON.stringify(data)+"\n");
      if (errcb)
        self.port.removeListener(errcb);
      callback(data);
    });
  }
  if (errcb) {
    data.error = msg+".error."+callid;
    self.port.once(data.error, function(data) {
      if (callback)
        self.port.removeListener(callback);
      errcb(data);
    });
  }
  //dump("making call to "+msg+"\n");
  self.port.emit(msg, data);
}

let _watches = {
  "install": [],
  "uninstall": []
};

function _updateWatchers(args) {
  let _watchers = null;

  // both install/uninstall are only for 1 app at a time,
  // the first in the array for add/remove notifications
  let result = args[1][0];
  // If oninstall/onuninstall handlers exist, invoke them
  let mgmt = unsafeWindow.navigator.wrappedJSObject.mozApps.mgmt;
  if (args[0] == "add") {
    _watchers = _watches["install"];
    if (mgmt.oninstall) {
      mgmt.oninstall(result);
    }
  } else if (args[0] == "remove") {
    _watchers = _watches["uninstall"];
    if (mgmt.onuninstall) {
      mgmt.onuninstall(result);
    }
  }
  if (_watchers) {
    for (var i=0; i < _watchers.length; i++) {
      var _watcher = _watchers[i];
      _watcher({application: result});
    }
  }
}

function _clearWatcher(type, fn) {
  let idx = _watches[type].indexOf(fn);
  if (idx >= 0) {
    _watches[type].splice(idx, 1);
  }
}

// A helper function to make an 'app object' that implements
// both launch() & uninstall() from an app record. Similar to
// what's in api.js, but uses _makeCall instead of FFRepoImplService
function appObject(apprec) {
  // FIXME: Any better way to do this?
  let props = ["manifest", "manifestURL", "origin", "installOrigin", "installTime"];
  for (let i = 0; i < props.length; i++) {
    this[props[i]] = apprec[props[i]];
  }
  this.receipts = null;
  if ('installData' in apprec && 'receipts' in apprec.installData) {
    this.receipts = apprec.installData.receipts;
  }
}
appObject.prototype = {
  launch: function() {
    _makeCall('owa.mgmt.launch', this.origin);
  },
  uninstall: function() {
    let pendingUninstall = {};
    _makeCall('owa.mgmt.uninstall', this.origin,
      function(e) {
        if (pendingUninstall.onsuccess) pendingUninstall.onsuccess(e);
      },
      function(e) {
        if (pendingUninstall.onerror) pendingUninstall.onerror(e);
      }
    );
    return pendingUninstall;
  }
};


// We are mapping the new API to the old ones, so addEventListener
// and removeEventListener are built on top of updateWatcher & clearWatch.
// Additionally, getAll implements the pendingGetAll object in place to
// conform with the new API.
//
// We don't implement these mgmt calls either in api.js or repo.js because
// pageMod is used to inject these privileged functions only to certain
// origins, listed in the 'allowedOrigins' array in main.js
unsafeWindow.navigator.wrappedJSObject.mozApps.mgmt = {
  getAll: function() {
    let pendingGetAll = {
      onsuccess: function(e) {
        console.log("default getAll: " + JSON.stringify(pendingGetAll.result));
      },
      // FIXME: When is onerror called?
      onerror: function(e) {
        console.log("default getAll error: " + JSON.stringify(e));
      },
      result: undefined
    };

    _makeCall('owa.mgmt.getAll', null, function(apps) {
      let appObjs = [];
      for (var i = 0; i < apps.length; i++) {
        appObjs.push(new appObject(apps[i]));
      }
      pendingGetAll.result = appObjs;
      pendingGetAll.onsuccess(appObjs);
    });

    return pendingGetAll;
  },
  addEventListener: function(type, callback) {
    _watches[type].push(callback);
  },
  removeEventListener: function(type, callback) {
    _clearWatcher(type, callback);
    // We never actually call removeListener because oninstall/onuninstall
    // might be set
    //_makeCall('owa.mgmt.clearWatch');
    //self.port.removeListener("owa.mgmt.update", _updateWatchers);
  },
  oninstall: null,
  onuninstall: null
};

// Immediately register for updates, even if there are no listeners
// The array _watches will simply be empty and nothing bad should happen
self.port.on("owa.mgmt.update", _updateWatchers);
_makeCall('owa.mgmt.watchUpdates');
