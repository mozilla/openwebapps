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
 * The Original Code is hotkey support for open web apps.
 *
 * Contributor(s):
 *     Anant Narayanan <anant@kix.in>
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
 
const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

var EXPORTED_SYMBOLS = ["HotkeyService"];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var svc = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
var console = { 
    log: function(msg) { svc.logStringMessage(msg); }
};

function HotkeyServiceImpl() {
    try {
        this._kb = Cc["@songbirdnest.com/Songbird/GlobalHotkeys;1"]
            .createInstance(Ci.sbIGlobalHotkeys);
            
        //void addHotkey( in PRInt32 keyCode, in PRBool altKey, in PRBool ctrlKey, in PRBool shiftKey, in PRBool metaKey, in AString key_id, in sbIGlobalHotkeyCallback cb );
        this._kb.addHotkey(0xB0, false, false, false, false, "next", this);
        this._kb.addHotkey(0xB1, false, false, false, false, "previous", this);
        this._kb.addHotkey(0xB2, false, false, false, false, "stop", this);
        this._kb.addHotkey(0xB3, false, false, false, false, "play", this);
        
        this._wm = Cc["@mozilla.org/appshell/window-mediator;1"]
            .getService(Ci.nsIWindowMediator);
    } catch (e) {
        // Not catastrophic
        console.log(e.stack + "\n");
    }
}
HotkeyServiceImpl.prototype = {
    QueryInterface: function(aIID) {
        if (!aIID.equals(Ci.sbIGlobalHotkeyCallback) &&
            !aIID.equals(Ci.nsISupports))
            throw Components.results.NS_ERROR_NO_INTERFACE;
        return this;
    },
        
    onHotkey: function(id) {
        // Send event to all open documents
        // XXX: Should we worry about security here and send events to
        // apps only? Maybe not
        let bEnum = this._wm.getEnumerator("navigator:browser");
        while (bEnum.hasMoreElements()) {
            let browserWin = bEnum.getNext();
            let tabbrowser = browserWin.gBrowser;
            let numTabs = tabbrowser.browsers.length;
                
            for (let index = 0; index < tabbrowser.tabs.length; index++) {
                let cur = tabbrowser.tabs[index];
                let win = tabbrowser.getBrowserForTab(cur).contentWindow;
                let doc = win.document;
                
                // Is MessageEvent the best type of DOM event for this?
                let evt = doc.createEvent("MessageEvent");
                evt.initMessageEvent(
                    "MozHotkey", false, false, id, cur.contentURI, null, win
                );
                doc.dispatchEvent(evt);
            }
        }
    }
};

var HotkeyService = new HotkeyServiceImpl();
