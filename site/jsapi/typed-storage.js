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
  // We lazily watch for the storage event, this tells us if we've added
  // it already:
  var storageEventHandlerSet = false;
  var objectStores = {};
  var watchUpdateCallbacks = {};
  var watchUpdateCounter = 1;
  browserStorage = browserStorage || window.localStorage;
  // This adds dispatchEvent/etc methods to this object:
  EventMixin(self);

  self.open = function (objType) {
    var objStore = TypedStorage.ObjectStore(browserStorage, objType, self);
    objectStores[objType] = objStore;
    return objStore;
  };

  var lastModified = null;

  function handleEvent(event) {
    var key = event.key;
    if (key === 'typed-storage#last_modified') {
      return;
    }
    if (key.indexOf('#') == -1) {
      return;
    }
    key = key.split('#');
    var objType = key[0];
    var objKey = key[1];
    if (! objectStores.hasOwnProperty(objType)) {
      return;
    }
    var objStore = objectStores[objType];
    var subEvent;
    if (event.oldValue !== null) {
      callWatchUpdateCallbacks({
        "type": "remove", 
        objects: [JSON.parse(event.oldValue)],
        objectType: objType,
        objectKey: objKey,
        originalEvent: event
      });
    }
    if (event.newValue !== null) {
      callWatchUpdateCallbacks({
        "type": "add", 
        objects: [JSON.parse(event.newValue)],
        objectType: objType,
        objectKey: objKey,
        originalEvent: event
      });
    }
  }
  
  function callWatchUpdateCallbacks(event) {
    for (var i in watchUpdateCallbacks) {
      if (watchUpdateCallbacks.hasOwnProperty(i)) {
        var callback = watchUpdateCallbacks[i];
        callback(event);
      }
    }
  }

  self.watchUpdates = function (callback) {
    if (! storageEventHandlerSet) {
      window.addEventListener('storage', handleEvent, false);
      storageEventHandlerSet = true;
    }
    var id = watchUpdateCounter++;
    watchUpdateCallbacks[id] = callback;
    return id;
  };

  self.clearWatch = function (id) {
    delete watchUpdateCallbacks[id];
  };

  self.setLastModified = function () {
    // Danger of clobbering a change here?
    lastModified = (new Date()).getTime();
    browserStorage.setItem('typed-storage#last_modified', lastModified);
  };

  self.change = function (storage, objType, key, oldValue, newValue) {
    if (oldValue !== undefined) {
      callWatchUpdateCallbacks({
        "type": "remove",
        objects: [oldValue],
        objectType: objType,
        objectKey: key
      });
    }
    if (newValue !== undefined) {
      callWatchUpdateCallbacks({
        "type": "add",
        objects: [newValue],
        objectType: objType,
        objectKey: key
      });
    }
  };

  return self;
}

TypedStorage.ObjectStore = function (storage, objType, typedStorage) {
  var self = {};
  self._storage = storage;
  self._typedStorage = typedStorage;
  self._objType = objType;

  //for a given user-supplied keystring, create a unique storage key "objType#keystring"
  self.makeKey = function(rawKey) {
    return (objType + "#" + rawKey);
  };

  //break the objType off of the front of the storage key, returning the user-supplied
  // keystring, or null if the objType doesn't match
  self.breakKey = function(madeKey) {
    if (madeKey.indexOf(objType + "#") == 0) {
      return madeKey.substring(madeKey.indexOf("#") + 1);
    } else {
      return null;
    }
  };

  //retrieve the object or null stored with a specified key
  self.get = function(key, cb) {
    var item = getObject(self._storage, self.makeKey(key));
    cb && cb(item);
  };

  //store and object under a specified key
  self.put = function(key, value, cb) {
    if (value === undefined) {
      self.remove(key, cb);
      return;
    }
    self.get(key, function (oldValue) {
      setObject(self._storage, self.makeKey(key), value);
      self._typedStorage.change(self, self._objType, key, oldValue, value);
      self._typedStorage.setLastModified();
      cb && cb(true);
    });
  };

  //remove the object at a specified key
  self.remove = function(key, cb) {
    self.get(key, function (oldValue) {
      self._storage.removeItem(self.makeKey(key));
      self._typedStorage.change(self, self._objType, key, oldValue, undefined);
      self._typedStorage.setLastModified();
      cb && cb(true);
    });
  };

  //remove all objects with our objType from the storage
  self.clear = function(cb) {
    //possibly slow, but code reuse for the win
    self.keys(function(allKeys) {
      for (var i=0; i<allKeys.length; i++) {
        self.remove(allKeys[i]);
      }
      self._typedStorage.setLastModified();
      cb && cb(true);
    });
  };

  //do we have an object stored with key?
  self.has = function(key, cb) {
    self.get(key, function(v) {
      cb(v !== undefined);
    });
  };

  //returns an array of all the keys with our objType
  self.keys = function(cb) {
    var resultKeys = [];
    var i;
    for (i=0; i < self._storage.length; i++) {
      var nextKey = self.breakKey(self._storage.key(i));
      if (nextKey) {
        resultKeys.push(nextKey);
      }
    }
    cb && cb(resultKeys);
  };

  //iterate through our objects, applying a callback
  self.iterate = function(cb) {
    var keys = self.keys();
    for (var i=0; i < keys.length; i++) {
      var result = cb(keys[i], self.get(keys[i]));
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
