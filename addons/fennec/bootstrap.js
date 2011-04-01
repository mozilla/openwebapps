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
 * The Original Code is Open Web Apps for Firefox.
 *
 * The Initial Developer of the Original Code is The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *	Anant Narayanan <anant@kix.in>
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

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

function openwebapps(win, add)
{
    this._addon = add;
    this._window = win;
    Services.obs.addObserver(this, "weave:service:ready", false);
    let messageManager = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIChromeFrameMessageManager);
    messageManager.addMessageListener("OpenWebApps:GetApplications", this);
   this._json = null;
}
openwebapps.prototype = {
    _addToHomeScreen: function() {
        if (!this._json)
          return;
        let browser = this._window.Browser.selectedBrowser;
        browser.messageManager.sendAsyncMessage("OpenWebApps:AddToHomeScreen", this._json);
    },

    getApps: function() {
        Cu.import("resource://services-sync/main.js");
        if (!Weave.ID.get("WeaveID"))
          return;
	let {username: uname, password: pwd} = Weave.ID.get("WeaveID");
        let url = Weave.Service.storageURL + "apps/apps";
	
        let self = this;
        let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
	          .createInstance(Ci.nsIXMLHttpRequest);
        
        req.open('GET', url, false);
        req.setRequestHeader(
            'Authorization', 'Basic ' +
            self._window.btoa(uname + ':' + pwd)
        );
        req.onload = function(result) {
            let JSON = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
            self._json = JSON.decode(req.responseText)
            self._addToHomeScreen();
        }
	req.send(null);
    },

    observe: function(subject, topic, data) {
        if (topic == "weave:service:ready") {
            this.getApps();
        }
    },

    receiveMessage: function(aMessage) {
      if (aMessage.name == "OpenWebApps:GetApplications") {
        //this._addToHomeScreen();
        this.getApps();
      }
    }
};

var unloaders = [];
function startup(data, reason) AddonManager.getAddonByID(data.id, function(addon) {
    /* Let's register ourselves a resource: namespace */
    let resource = Services.io.getProtocolHandler("resource")
                   .QueryInterface(Ci.nsIResProtocolHandler);
    let alias = Services.io.newFileURI(data.installPath);
    if (!data.installPath.isDirectory())
        alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);
    resource.setSubstitution("openwebapps", alias);

    let contentURL;
    if (data.installPath.isDirectory())
      contentURL = alias.spec + "content.js";
    else
      contentURL = "jar:" + alias.spec + "!/content.js";

    let messageManager = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIChromeFrameMessageManager);
    messageManager.loadFrameScript(contentURL, true);

    /* We use winWatcher to create an instance per window (current and future) */
    let iter = Cc["@mozilla.org/appshell/window-mediator;1"]
               .getService(Ci.nsIWindowMediator)
               .getEnumerator("navigator:browser");
    while (iter.hasMoreElements()) {
        new openwebapps(iter.getNext().QueryInterface(Ci.nsIDOMWindow), addon);
    }
    function winWatcher(subject, topic) {
        if (topic != "domwindowopened")
            return;
        subject.addEventListener("load", function() {
            subject.removeEventListener("load", arguments.callee, false);
            let doc = subject.document.documentElement;
            if (doc.getAttribute("windowtype") == "navigator:browser") {
                new openwebapps(subject, addon);
            }
        }, false);
    }
    Services.ww.registerNotification(winWatcher);
    unloaders.push(function() Services.ww.unregisterNotification(winWatcher));
})

function shutdown(data, reason)
{
    if (reason == APP_SHUTDOWN) return;
    unloaders.forEach(function(unload) unload && unload());
    
    // Disable the frame script methods we added so they don't conflict with any future cloud printer scripts
    let messageManager = Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIChromeFrameMessageManager);
    messageManager.sendAsyncMessage("OpenWebApps:Disable", {});
}

function install()
{
}

function uninstall()
{
}
