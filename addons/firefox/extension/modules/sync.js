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
 
const EXPORTED_SYMBOLS = ['AppsEngine'];
const Cu = Components.utils;
const Ci = Components.interfaces;

Cu.import("resource://services-sync/util.js");
Cu.import("resource://services-sync/stores.js");
Cu.import("resource://services-sync/engines.js");
Cu.import("resource://services-sync/trackers.js");
Cu.import("resource://services-sync/base_records/crypto.js");
Cu.import("resource://openwebapps/modules/typed_storage.js");

function AppsEngine() {
    SyncEngine.call(this, "Apps");
}
AppsEngine.prototype = {
    __proto__: SyncEngine.prototype,
    _storeObj: AppStore, // lol
    _trackerObj: AppTracker,
    _recordObj: AppRec,
    version: 1
};

function AppRec(collection, id) {
    CryptoWrapper.call(this, collection, id);
}
AppRec.prototype = {
    __proto__: CryptoWrapper.prototype,
    _logName: "Record.App"
};
Utils.deferGetSet(AppRec, "cleartext", ["value"]);

function AppStore(name) {
    Store.call(this, name)
}
AppStore.prototype = {
    __proto__: Store.prototype,
    __store: null,
    get __store() {
        if (!this.__store)
            this.__store = TypedStorage().open("app");
        return this.__store;
    },
    
    getAllIDs: function _getAllIDs() {
        let guids = {};
        for each (let key in this.__store.keys())
            guids[key] = true;
        return guids;
    },
    
    changeItemID: function _changeItemID(oldID, newID) {
        // can't really do this
        this._log.trace("AppIDs are immutable!");
    },
    
    itemExists: function _itemExists(guid) {
        return this.__store.has(guid);
    },
    
    createRecord: function _createRecord(guid, collection) {
        let record = new AppRec(collection, guid);
        
        if (this.__store.has(guid)) {
            record.value = this.__store.get(guid);
        } else {
            record.deleted = true;
        }
        
        return record;
    },
    
    create: function _create(record) {
        this.__store.put(record.id, record.value);
    },
    
    remove: function _remove(record) {
        this.__store.remove(record.id);
    },
    
    update: function _update(record) {
        // store.put does INSERT or REPLACE
        // XXX: under what situation does an app manifest change?
        this.__store.put(record.id, record.value);
    },
    
    wipe: function _wipe(record) {
        this.__store.clear();
    }
};

function AppTracker(name) {
    Tracker.call(this, name);
    Svc.Obs.add("weave:engine:start-tracking", this);
    Svc.Obs.add("weave:engine:stop-tracking", this);
}
AppTracker.prototype = {
    __proto__ = Tracker.prototype,
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),
    
    _enabled: false,
    observe: function(aSubject, aTopic, aData) {
        switch (aTopic) {
        case "weave:engine:start-tracking":
            if (!this._enabled) {
                this._enabled = true;
            }
            // FIXME: app storage has no asynchronous notifications for
            // when an app has been installed or removed by the user!
            this.modified = true;
            this.score += 100;
            break;
        case "weave:engine:stop-tracking":
            if (this._enabled)
                this._enabled = false;
            break;
        }
    }
};
