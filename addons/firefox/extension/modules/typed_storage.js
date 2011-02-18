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
 *    Ian Bicking <ibicking@mozilla.com>
 *    Dan Walkowski <dwalkowski@mozilla.com>
 *    Anant Narayanan <anant@kix.in>
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
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var console = {
    log: function(s) {dump(s+"\n");}
};

function TypedStorageImpl() {}
TypedStorageImpl.prototype = {
    open: function (objType) {
        return new ObjectStore(objType);
    }
};

function ObjectStore(objType)
{
    let file = Cc["@mozilla.org/file/directory_service;1"].
                            getService(Ci.nsIProperties).
                            get("ProfD", Ci.nsIFile);
    file.append("applications.sqlite");
    let storageService = Cc["@mozilla.org/storage/service;1"].
                            getService(Ci.mozIStorageService);
                            
    // Will also create the file if it does not exist
    let dbConn = storageService.openDatabase(file);

    // See if the table is already created:
    let statement;
    let tableExists = false;
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
            dbConn.executeSimpleSQL(
                "CREATE TABLE " + objType +
                " (id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, data TEXT)"
            );
        } catch (e) {
            console.log("Error while creating table: " + e);
            throw e;
        }
    }
    
    this._dbConn = dbConn;
    this._objType = objType;
}
ObjectStore.prototype = {
    get: function(key, cb)
    {
        let getStatement = this._dbConn.createStatement(
            "SELECT data FROM " + this._objType + " WHERE key = :key LIMIT 1"
        );
        getStatement.params.key = key;
        getStatement.executeAsync({
            handleResult: function(result) {
                let value = result.getNextRow();
                if (value) {
                    cb(JSON.parse(value.getResultByName("data")));
                } else {
                    cb(undefined);
                }
            },
            handleError: function(error) {
                console.log(
                    "Error while selecting from table " + this._objType + ": " + error
                    + "; " + this._dbConn.lastErrorString
                    + " (" + this._dbConn.lastError +")"
                );
            },
            handleCompletion: function(reason) {
                getStatement.reset();
                if (reason != Ci.mozIStorageStatementCallback.REASON_FINISHED)
                    console.log("Get query canceled or aborted! " + reason);
            }
        });
    },

    put: function(key, value, cb)
    {
        let setStatement = this._dbConn.createStatement(
            "INSERT OR REPLACE INTO " + this._objType +
            " (key, data) VALUES (:key, :data )"
        );
        setStatement.params.key = key;
        setStatement.params.data = JSON.stringify(value);
        this._doAsyncExecute(setStatement, cb);
    },
    
    remove: function(key, cb) {
        let removeStatement = this._dbConn.createStatement(
            "DELETE FROM " + this._objType + " WHERE key = :key"
        );
        this._doAsyncExecute(removeStatement, cb);
    },
    
    clear: function(cb)
    {
        let clearStatement = this._dbConn.createStatement(
            "DELETE FROM " + this._objType
        );
        this._doAsyncExecute(clearStatement, cb);
    },
    
    has: function(key, cb)
    {
        this.get(key, function(data) {
            cb(data !== null);
        })
    },

    keys: function(cb)
    {
        let resultKeys = [];
        let keyStatement = this._dbConn.createStatement(
            "SELECT key FROM " + this._objType
        );
        
        keyStatement.executeAsync({
            handleResult: function(result) {
                let row;
                while ((row = result.getNextRow())) {
                    resultKeys.push(row.getResultByName("key"));
                }
            },
            handleError: function(error) {
                console.log(
                    "Error while getting keys for " + this._objType + ": " + error
                    + "; " + this._dbConn.lastErrorString
                    + " (" + this._dbConn.lastError +")"
                );
            },
            handleCompletion: function(reason) {
                keyStatement.reset();
                if (reason != Ci.mozIStorageStatementCallback.REASON_FINISHED)
                    console.log("Keys query canceled or aborted! " + reason);
                else
                    cb(resultKeys);
            }
        });
    },
    
    iterate: function(cb)
    {
        // sometimes asynchronous calls can make your head hurt
        this.keys(function(allKeys) {
            for (let i = 0; i < allKeys.length; i++) {
                this.get(allKeys[i], function(values) {
                    let result = cb(allKeys[i], values);
                    if (result === false)
                        return;
                });
            }
        });
    },
    
    // Helper function for async execute with no results
    _doAsyncExecute: function(statement, cb) {
        statement.executeAsync({
            handleResult: function(result) {
            },
            handleError: function(error) {
                console.log(
                    "Error while executing " + statement +
                    "on" + this._objType + ": " + error
                    + "; " + this._dbConn.lastErrorString
                    + " (" + this._dbConn.lastError + ")"
                );
            },
            handleCompletion: function(reason) {
                statement.reset();
                if (reason != Ci.mozIStorageStatementCallback.REASON_FINISHED)
                    console.log("Clear query canceled or aborted! " + reason);
                else
                    cb(true);
            }
        });
    }
};

// We create a Singleton
var TypedStorageImpl = new TypedStorageImpl();
function TypedStorage()
{
    return TypedStorageImpl;
}
var EXPORTED_SYMBOLS = ["TypedStorage"];
