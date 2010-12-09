/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is typed-storage.js
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Ian Bicking <ibicking@mozilla.com>
 *  Dan Walkowski <dwalkowski@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

function TypedStorage(browserStorage) {
  var self = {};
  browserStorage = browserStorage || window.localStorage;
  self.open = function (objType) {
    return TypedStorage.ObjectStore(browserStorage, objType, self);
  };
  EventMixin(self);

  var lastModified = null;
  var pollPeriod = 1000;
  var timeoutId = null;

  function changePoller() {
    try {
      var storeLastModified = browserStorage.getItem('typed-storage#last_modified');
      if (storeLastModified) {
        try {
          storeLastModified = parseInt(storeLastModified);
        } catch (e) {
          storeLastModified = null;
        }
      } else {
        storeLastModified = null;
      }
      if (storeLastModified && storeLastModified > lastModified) {
        lastModified = storeLastModified;
        self.dispatchEvent('multiplechange', {});
      }
    } finally {
      timeoutId = setTimeout(changePoller, pollPeriod);
    };
  }

  self.pollForChanges = function (period, types) {
    if (lastModified === null) {
      lastModified = (new Date()).getTime();
    }
    if (period) {
      pollPeriod = period;
    }
    self.cancelPoll();
    timeoutId = setTimeout(changePoller, 0);
  };

  self.cancelPoll = function () {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  self.setLastModified = function () {
    // Danger of clobbering a change here?
    lastModified = (new Date()).getTime();
    browserStorage.setItem('typed-storage#last_modified', lastModified);
  };

  self.addEventListener('addEventListener', function (event) {
    // Automatically start polling for changes if multichange is
    // being listened for
    if (event.eventName == 'multiplechange' && ! timeoutId) {
      self.pollForChanges();
      // Technically the poll could be cancelled...
      self.removeEventListener('addEventListener', arguments.callee);
    }
  });

  return self;
}

TypedStorage.ObjectStore = function (storage, objType, typedStorage) {
  var self = {};
  self._storage = storage;
  self._typedStorage = typedStorage;
  self._objType = objType;

  //for a given user-supplied keystring, create a unique storage key "objType#keystring"
  self.makeKey = function (rawKey) {
    return (objType + "#" + rawKey);
  };

  //break the objType off of the front of the storage key, returning the user-supplied
  // keystring, or null if the objType doesn't match
  self.breakKey = function (madeKey) {
    if (madeKey.indexOf(objType + "#") == 0) {
      return madeKey.substring(madeKey.indexOf("#") + 1);
    } else {
      return null;
    }
  };

  //retrieve the object or null stored with a specified key
  self.get = function (key) {
    return getObject(self._storage, self.makeKey(key));
  };

  //store and object under a specified key
  self.put = function (key, value) {
    var canceled = ! self._typedStorage.dispatchEvent('change',
      {target: key, storageType: self, eventType: 'change', value: value});
    setObject(self._storage, self.makeKey(key), value);
    self._typedStorage.setLastModified();
  };

  //remove the object at a specified key
  self.remove = function (key) {
    var canceled = ! self._typedStorage.dispatchEvent('delete',
        {target: key, eventType: 'delete', storageType: self});
    if (! canceled) {
      delete self._storage.removeItem(self.makeKey(key));
    }
    self._typedStorage.setLastModified();
  };

  //remove all objects with our objType from the storage
  self.clear = function () {
    //possibly slow, but code reuse for the win
    var allKeys = self.keys();
    for (var i=0; i<allKeys.length; i++) {
      self.remove(allKeys[i]);
    }
    self._typedStorage.setLastModified();
  };

  //do we have an object stored with key?
  self.has = function (key) {
    return (self.get(key) !== undefined);
  };

  //returns an array of all the keys with our objType
  self.keys = function () {
    var resultKeys = [];
    var i;
    for (i=0; i < self._storage.length; i++) {
      var nextKey = self.breakKey(self._storage.key(i));
      if (nextKey) {
        resultKeys.push(nextKey);
      }
    }
    return resultKeys;
  };

  //iterate through our objects, applying a callback
  self.iterate = function (callback) {
    var keys = self.keys();
    for (var i=0; i < keys.length; i++) {
      var result = callback(keys[i], self.get(keys[i]));
      if (result === false) {
        return;
      }
    }
  };

  function setObject(storage, key, value) {
    storage.setItem(key, JSON.stringify(value));
  }

  function getObject(storage, key) {
    var value = storage.getItem(key);
    if (value) {
      // FIXME: should this ignore parse errors?
      return JSON.parse(value);
    } else {
      // FIXME: or normalize to null or undefined?
      return undefined;
    }
  }

  return self;
};
