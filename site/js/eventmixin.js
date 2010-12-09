function EventMixin(self) {
  self._listeners = {};

  self._freezeDispatch = false;

  self.addEventListener = function (event, callback) {
    if (! (event in self._listeners)) {
      self._listeners[event] = [];
    }
    self._listeners[event].push(callback);
    if (! self._freezeDispatch) {
      self._freezeDispatch = true;
      try {
        self.dispatchEvent('addEventListener',
            {eventName: event, callback: callback});
      } finally {
        self._freezeDispatch = false;
      }
    }
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
    if (! self._freezeDispatch) {
      self._freezeDispatch = true;
      try {
        self.dispatchEvent('removeEventListener',
            {eventName: event, callback: callback});
      } finally {
        self._freezeDispatch = false;
      }
    }
  };

  self.dispatchEvent = function (name, event) {
    event.eventType = name;
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
