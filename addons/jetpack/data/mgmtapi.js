


var callid = 0;

function _makeCall(msg, args, callback, errcb) {
  let data = {
    location: location.href,
    data: args
  }
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

let _watches = [];
function _updateWatchers() {
  for (var i=0; i < _watches.length; i++) {
    _watches[i](arguments);
  }
}
function _clearWatcher(fn) {
  let idx = _watches.indexOf(fn);
  if (idx >= 0) {
    _watches.splice(idx, 1);
  }
}

unsafeWindow.navigator.mozApps.mgmt = {
  launch: function(args) {
    // no return, just emit the message
    _makeCall('owa.mgmt.launch', args);
  },
  list: function(callback) {
    _makeCall('owa.mgmt.list', null, callback);
  },
  loginStatus: function(args, callback) {
    _makeCall('owa.mgmt.loginStatus', args, callback);
  },
  loadState: function(callback) {
    _makeCall('owa.mgmt.loadState', null, callback);
  },
  saveState: function(state, callback) {
    _makeCall('owa.mgmt.saveState', state, callback);
  },
  uninstall: function(key, callback, onerror) {
    _makeCall('owa.mgmt.uninstall', key, callback, onerror);
  },
  watchUpdates: function(callback) {
    _watches.push(callback);
    let idx = _watches.indexOf(callback);
    if (idx == 0) {
      self.port.on("owa.mgmt.update", _updateWatchers);
      _makeCall('owa.mgmt.watchUpdates');
    }
  },
  clearWatch: function(callback) {
    _clearWatcher(callback);
    if (_watches.length < 1) {
      _makeCall('owa.mgmt.clearWatch');
      self.port.removeListener("owa.mgmt.update", _updateWatchers);
    }
  }
}

