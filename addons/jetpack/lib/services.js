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
 *  Michael Hanson <mhanson@mozilla.com>
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

const {Cu, Ci, Cc} = require("chrome");
const data = require("self").data;

var panel = require("panel");
var {FFRepoImplService} = require("api");

/*
 We create a service invocation panel when needed; there is at most one per
 tab, but the user can switch away from a tab while a service invocation
 dialog is still in progress.
*/
function serviceInvocationHandler(win)
{
    this._window = win;
    this._popups = []; // save references to popups we've created already

    let observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    observerService.addObserver(this, "openwebapp-installed", false);
}
serviceInvocationHandler.prototype = {
    _show: function(thePanel) {
        // TODO: steal sizeToContent from F1
        if (thePanel.state == "closed") {
            thePanel.resize(500, 400);
            let larry = this._window.document.getElementById('identity-box');
            thePanel.show(larry);
        }
    },
    
    observe: function(subject, topic, data) {
        if (topic != "openwebapp-installed")
            return;

        // let our panels know, if they are visible
        for each (let popupCheck in this._popups) {
            if (popupCheck.panel.isShowing) {
                this._updateContent(popupCheck);
            }
        }
    },
    
    invoke: function(contentWindowRef, methodName, args, successCB, errorCB) {
        // Do we already have a panel for this content window?
        let thePanel, thePanelRecord;
        for each (let popupCheck in this._popups) {
            if (contentWindowRef == popupCheck.contentWindow) {
                thePanel = popupCheck.thePanel;
                thePanelRecord = popupCheck;
                break;
            }
        }

        // If not, go create one
        if (!thePanel) {
            let thePanel =  require("panel").Panel({
                contentURL: data.url("service2.html")
            });
            thePanelRecord = {
                contentWindow: contentWindowRef,
                thePanel: thePanel
            };
        }

        this._popups.push( thePanelRecord );
        this._show(thePanel);

        // Update the content for the new invocation        
        thePanelRecord.contentWindow = contentWindowRef;
        thePanelRecord.methodName = methodName;
        thePanelRecord.args = args;
        thePanelRecord.successCB = successCB;
        thePanelRecord.errorCB = errorCB; 
        // XXX: this memory is going to stick around for a long time;
        // consider cleaning it up proactively
        
        this._updateContent(thePanelRecord);
    },

    _updateContent: function(thePanelRecord) {
        // We are going to inject into our iframe (which is pointed at service.html).
        // It needs to know:
        // 1. What method is being invoked (and maybe some nice explanatory text)
        // 2. Which services can provide that method, along with their icons and iframe URLs
        // 3. Where to return messages to once it gets confirmation (that would be this)
        let { methodName, args, successCB, errorCB } = thePanelRecord;
        let contentWindowRef = thePanelRecord.contentWindow;
        let thePanel = thePanelRecord.thePanel;
      
        // Ready to go: attach our response listener
        let self = this;
        thePanel.port.on("result", function(msg) {
            try {
                thePanel.hidePopup();
                successCB(event.data);
            } catch (e) {
                dump(e + "\n");
            }
        });
        thePanel.port.on("error", function(msg) {
            dump(event.data + "\n");
        });
        thePanel.port.on("reconfigure", function(msg) {
            dump("services.js: Got a reconfigure event\n");
            self._updateContent(
                contentWindowRef, thePanel, theIFrame, methodName, args,
                successCB, errorCB
            );
        });
        thePanel.port.on("loaded", function(msg) {
            let obs = Cc["@mozilla.org/observer-service;1"].
                    getService(Ci.nsIObserverService);
            obs.notifyObservers(
                frame.contentWindow, "openwebapps-service-panel-loaded", ""
            );
        });
          
        // Send reconfigure event
        FFRepoImplService.findServices(methodName, function(serviceList) {
            thePanel.port.emit("setup", {
                method: methodName,
                args: args,
                serviceList: serviceList,
                caller: contentWindowRef.location.href
            });
            thePanel.port.emit("start_channels");
        });
    }
};

var EXPORTED_SYMBOLS = ["serviceInvocationHandler"];
exports.serviceInvocationHandler = serviceInvocationHandler;

