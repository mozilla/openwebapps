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
