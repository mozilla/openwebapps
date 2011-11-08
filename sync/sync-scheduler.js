function Scheduler(service) {
  if (this == window) {
    throw 'You forgot new';
  }
  var self = this;
  this.service = service;
  this.service.onlogin = function () {
    self.activate();
  };
  this.service.onlogout = function () {
    self.deactivate();
  };
  this.service.onretryafter = function (retryAfter) {
    self.resetSchedule();
    self._period = retryAfter;
    self.schedule();
  };
  this._timeoutId = null;
  this._nextRun = null;
  this._period = this.settings.normalPeriod;
  this._retryAfter = null;
  if (this.service.loggedIn()) {
    this.activate();
  }
  this.lastSuccessfulSync = null;
  this.onerror = null;
  this.onsuccess = null;
}

Scheduler.prototype.settings = {
  maxPeriod: 60*60000, // 1 hour
  minPeriod: 30000, // 30 seconds
  normalPeriod: 5000 // 5 minutes
};

Scheduler.prototype.activate = function () {
  return;
  this.deactivate();
  this.resetSchedule();
  this.schedule();
};

Scheduler.prototype.deactivate = function () {
  if (this._timeoutId) {
    clearTimeout(this._timeoutId);
    this._timeoutId = null;
  }
};

Scheduler.prototype.resetSchedule = function () {
  this._nextRun = this.settings.normalPeriod;
};

Scheduler.prototype.schedule = function () {
  var self = this;
  if (this._timeoutId) {
    clearTimeout(this._timeoutId);
  };
  this._timeoutId = setTimeout(function () {
    try {
      self.service.syncNow(function (error, result) {
        if (error && self.onerror) {
          self.onerror(error);
        }
        self.schedule();
        this.lastSuccessfulSync = new Date().getTime();
        if (self.onsuccess) {
          self.onsuccess();
        }
      });        
    } catch (e) {
      if (self.onerror) {
        self.onerror(e);
      }
      self.schedule();
    }
  }, this._nextRun);
};
