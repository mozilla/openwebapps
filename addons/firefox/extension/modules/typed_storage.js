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

var EXPORTED_SYMBOLS = ["TypedStorage"];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://openwebapps/modules/eventmixin.js");

var console = {
  log: function(s) {dump(s+"\n");}
};

function TypedStorage(browserStorage) {
  var self = {};
  self.open = function (objType) {
    return TypedStorage.ObjectStore(objType, self);
  };
  EventMixin(self);

  var lastModified = null;
  var pollPeriod = 1000;
  var timeoutId = null;

  function changePoller() {

    /*
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
    */
  }

  self.pollForChanges = function (period, types) {
  /*
    if (lastModified === null) {
      lastModified = (new Date()).getTime();
    }
    if (period) {
      pollPeriod = period;
    }
    self.cancelPoll();
    timeoutId = setTimeout(changePoller, 0);
    */
  };

  self.cancelPoll = function () {
   /* if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }*/
  };

  self.setLastModified = function () {
    // Danger of clobbering a change here?
    lastModified = (new Date()).getTime();
/*    browserStorage.setItem('typed-storage#last_modified', lastModified);*/
  };

/*
  self.addEventListener('addEventListener', function (event) {
    // Automatically start polling for changes if multichange is
    // being listened for
    if (event.eventName == 'multiplechange' && ! timeoutId) {
      self.pollForChanges();
      // Technically the poll could be cancelled...
      self.removeEventListener('addEventListener', arguments.callee);
    }
  });
*/
  return self;
}

TypedStorage.ObjectStore = function (objType, typedStorage) {

  var file = Components.classes["@mozilla.org/file/directory_service;1"]
                       .getService(Components.interfaces.nsIProperties)
                       .get("ProfD", Components.interfaces.nsIFile);
  file.append("applications.sqlite");
  var storageService = Components.classes["@mozilla.org/storage/service;1"]
                          .getService(Components.interfaces.mozIStorageService);
  var dbConn = storageService.openDatabase(file); // Will also create the file if it does not exist

  // See if the table is already created:
  var statement;
  var tableExists = false;
  try {
    statement = dbConn.createStatement("SELECT * FROM " + objType + " LIMIT 1");
    statement.executeStep();
    tableExists = true;
  } catch (e) {
  } finally {
    if (statement) statement.finalize();
  }
  if (!tableExists) {
    try {
      dbConn.executeSimpleSQL("CREATE TABLE " + objType + " (id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, data TEXT)");
    } catch (e) {
      console.log("Error while creating table: " + e);
      throw e;
    }
  }

  var self = {};
  self._dbConn = dbConn;
  self._typedStorage = typedStorage;
  self._objType = objType;

  //retrieve the object or null stored with a specified key
  self.get = function (key) {
    var getStatement;
    try {
      getStatement = dbConn.createStatement("SELECT data FROM " + objType + " WHERE key = :key");
      getStatement.params.key = key;
      var data;
      if (getStatement.executeStep()) {
        data = getStatement.row.data;
      }

      if (data) {
        // FIXME: should this ignore parse errors?
        return JSON.parse(data);
      } else {
        // FIXME: or normalize to null or undefined?
        return undefined;
      }
    } catch (e) {
      console.log("Error while selecting from table " + objType + ": " + e + "; " + dbConn.lastErrorString + " (" + dbConn.lastError +")");
      throw e;
    } finally {
      if (getStatement) getStatement.finalize();
    }
  };

  //store and object under a specified key
  self.put = function (key, value) {
    var canceled = ! self._typedStorage.dispatchEvent('change',
      {target: key, storageType: self, eventType: 'change', value: value});
    setObject(key, value);
    self._typedStorage.setLastModified();
  };

  //remove the object at a specified key
  self.remove = function (key) {
    if (key === undefined) {
      throw('Invalid key passed to TypedStorage().remove(): undefined');
    }
    var canceled = ! self._typedStorage.dispatchEvent('delete',
        {target: key, eventType: 'delete', storageType: self});
    if (! canceled) {
      var removeStatement;
      try {
        removeStatement = dbConn.createStatement("DELETE FROM " + objType + " WHERE key = :key");
        removeStatement.params.key = key;
        removeStatement.executeStep();
      } catch (e) {
        console.log("Error while deleting from table " + objType + ": " + e+ "; " + dbConn.lastErrorString + "; statement was " +
          "DELETE FROM " + objType + " WHERE key = :key" + "; key was " + key);
        throw e;
      } finally {
        if (removeStatement) removeStatement.finalize();
      }
    }
    self._typedStorage.setLastModified();
  };

  //remove all objects with our objType from the storage
  self.clear = function () {
    var clearStatement;
    try {
      clearStatement = dbConn.createStatement("DELETE FROM " + objType);
      clearStatement.executeStep();
    } catch (e) {
      console.log("Error while clearing table " + objType + ": " + e + "; " + dbConn.lastErrorString);
      throw e;
    } finally {
      if (clearStatement) clearStatement.finalize()
    }
    self._typedStorage.setLastModified();
  };

  //do we have an object stored with key?
  self.has = function (key) {
    return (self.get(key) !== undefined);
  };

  //returns an array of all the keys with our objType
  self.keys = function () {
    var keyStatement;
    try {
      var resultKeys = [];
      var keyStatement = dbConn.createStatement("SELECT key FROM " + objType);
      while (keyStatement.executeStep()) {
        resultKeys.push(keyStatement.row.key);
      }
    } catch (e) {
      console.log("Error while getting keys for " + objType + ": " + e + "; " + dbConn.lastErrorString);
      throw e;
    } finally {
      if (keyStatement) keyStatement.finalize()
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

  function setObject(key, value) {
    var setStatement;
    try {
      setStatement = dbConn.createStatement("INSERT OR REPLACE INTO " + objType + " (key, data) VALUES (:key, :data )");
      setStatement.params.key = key;
      setStatement.params.data = JSON.stringify(value);
      setStatement.executeStep();
    } catch (e) {
      console.log('Stack:\n' + e.stack + '\n');
      console.log('variables:'+ JSON.stringify(key)+','+ JSON.stringify(value));
      console.log("Error while updating table " + objType + ": " + e + "; " + dbConn.lastErrorString);
      throw e;
    } finally {
      if (setStatement) setStatement.finalize();
    }
  }

  function getObject(key) {
    var value = self.get(key);
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
