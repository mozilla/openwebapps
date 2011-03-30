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
 * Contributor(s):
 *   Anant Narayanan <anant@kix.in>
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

var EXPORTED_SYMBOLS = ['AppsEngine', 'AppRec'];

const Cu = Components.utils;
const Ci = Components.interfaces;
const APPS_GUID = "apps";

Cu.import("resource://services-sync/util.js");
Cu.import("resource://services-sync/record.js");
Cu.import("resource://services-sync/engines.js");
Cu.import("resource://openwebapps/modules/api.js");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://openwebapps/modules/typed_storage.js");

function AppRec(collection, id) {
    CryptoWrapper.call(this, collection, id);
}
AppRec.prototype = {
    __proto__: CryptoWrapper.prototype,
    _logName: "Record.App",
    
    // Override for plaintext app records
    encrypt: function encrypt(keyBundle) {
        this.ciphertext = JSON.stringify(this.cleartext);
        this.cleartext = null;
    },
    
    decrypt: function decrypt(keyBundle) {
        if (!this.ciphertext) {
            throw "No ciphertext found";
        }
        
        let result = JSON.parse(this.ciphertext);
        if (result && (result instanceof Object)) {
            this.cleartext = result;
            this.ciphertext = null;
        } else {
            throw "Decryption failed, result is: " + result;
        }
        
        if (this.cleartext.id != this.id)
            throw "Record id mismatch: " + [this.cleartext.id, this.id];
            
        return this.cleartext;
    }
};
Utils.deferGetSet(AppRec, "cleartext", ["value"]);

function AppStore(name) {
    Store.call(this, name)
}
AppStore.prototype = {
    __proto__: Store.prototype,
    __store: null,
    __repo: FFRepoImplService,

    _getAllApps: function _getAllApps() {
        let values = {};
        let callback = Utils.makeSyncCallback();
        this.__repo.list(callback);
        return Utils.waitForSyncCallback(callback);
    },
    
    getAllIDs: function _getAllIDs() {
        let allapps = {};
        allapps[APPS_GUID] = true;
        return allapps;
    },
    
    changeItemID: function _changeItemID(oldID, newID) {
        this._log.trace("AppsStore GUID is constant");
    },
    
    itemExists: function _itemExists(guid) {
        return (guid == APPS_GUID);
    },
    
    createRecord: function _createRecord(guid, collection) {
        let record = new AppRec(collection, guid);
        
        if (guid == APPS_GUID) {
            record.value = this._getAllApps();
        } else {
            record.deleted = true;
        }
        
        return record;
    },
    
    create: function _create(record) {
        this._log.trace("Ignoring create request");
    },
    
    remove: function _remove(record) {
        this._log.trace("Ignoring remove request");
    },
    
    update: function _update(record) {
        // XXX: Implement
        this._log.trace("Ignoring update request, not implemented");
    },
    
    wipe: function _wipe(record) {
        // XXX: Not checking callback
        TypedStorage().open("app").clear();
    }
};

function AppsEngine() {
    SyncEngine.call(this, "Apps");
}
AppsEngine.prototype = {
    __proto__: SyncEngine.prototype,
    _storeObj: AppStore,
    _trackerObj: AppTracker,
    _recordObj: AppRec,
    version: 2,
    
    getChangedIDs: function getChangedIDs() {
        let changedIDs = {};
        if (this._tracker.modified)
            changedIDs[APPS_GUID] = 0;
        return changedIDs;
    },
    
    _wipeClient: function _wipeClient() {
        SyncEngine.prototype._wipeClient.call(this);
        this.justWiped = true;
    },
    
    _reconcile: function _reconcile(item) {
        if (this.justWiped) {
            this.justWiped = false;
            return true;
        }
        return SyncEngine.prototype._reconcile.call(this,  item);
    }
};

function AppTracker(name) {
    Tracker.call(this, name);
    Svc.Obs.add("openwebapp-installed", this);
    Svc.Obs.add("openwebapp-uninstalled", this);
    Svc.Obs.add("weave:engine:start-tracking", this);
    Svc.Obs.add("weave:engine:stop-tracking", this);
}
AppTracker.prototype = {
    __proto__: Tracker.prototype,
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
    
    _enabled: false,
    observe: function(aSubject, aTopic, aData) {
        switch (aTopic) {
        case "openwebapp-installed":
        case "openwebapp-uninstalled":
            // 100 points for either changed
            this.score = 100;
            this.modified = true;
            break;
        case "weave:engine:start-tracking":
            if (!this._enabled) {
                this._enabled = true;
            }
            break;
        case "weave:engine:stop-tracking":
            if (this._enabled)
                this._enabled = false;
            break;
        }
    }
};
