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
var {FFRepoImplService} = require("api");

/**
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

    _createPopupPanel: function() {
      let doc = this._window.document;
      let XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
      let xulPanel = doc.createElementNS(XUL_NS, "panel");
      xulPanel.setAttribute("type", "arrow");

      let frame = doc.createElementNS(XUL_NS, "browser");      
      frame.setAttribute("flex", "1");
      frame.setAttribute("type", "content");
      frame.setAttribute("transparent", "transparent");
      frame.setAttribute("style", "width:484px;height:484px");
      xulPanel.appendChild(frame);
      doc.getElementById("mainPopupSet").appendChild(xulPanel);
      
      frame.setAttribute("src", require("self").data.url("service2.html"));

      return [xulPanel, frame];
    },
    
    show: function(panel) {
      // TODO: steal sizeToContent from F1
      if (panel.state == "closed") {
          panel.sizeTo(500, 400);
          let larry = this._window.document.getElementById('identity-box');
          panel.openPopup(larry, "after_start", 8);
      }
    },
    
    observe: function(subject, topic, data) {
      if (topic == "openwebapp-installed")
      {
        // let our panels know, if they are visible
        for each (let popupCheck in this._popups) {
          if (popupCheck.panel.state != "closed")
          {
            this._updateContent(popupCheck);
          }
        }
      }
    },

    // called when an app tells us it's ready to go
    initApp: function(contentWindowRef) {
        let self = this;
        // check that this is indeed an app
        FFRepoImplService.getAppByUrl(contentWindowRef.location, function(app) {
            if (!app) return;

            // at this point, all services should be registered
            
            // we invoke the login one if it's supported
            if (app.services && app.services.login) {
                // FIXME: what do we do with tons of IFRAMEs? Do they all get the login message?
                self.invokeService(contentWindowRef, 'login', 'doLogin', {'credentials' : null}, function(result) {
                    // if result is status ok, we're good
                    if (result.status == 'ok') {
                        console.log("app is logged in");
                        return;
                    }

                    // if result is status dialog, we need to open a popup.
                    if (result.status == 'notloggedin') {
                        if (app.services.login.dialog) {
                            // open up a dialog
                            var windows = require("windows").browserWindows;
                            windows.open({
                                url: app.login_dialog_url,
                                onOpen: function(window) {
                            }});
                        }
                    }
                });
            }
        });
    },


    // FIXME: This should all be replaced with postMessage passing.
    // Until we get that working we are invoking functions directly.
    
    // when an app registers a service handler
    registerServiceHandler: function(contentWindowRef, activity, message, func) {
        // check that this is indeed an app
        FFRepoImplService.getAppByUrl(contentWindowRef.location, function(app) {

            // do we need to unwrap it?
            var theWindow = contentWindowRef;

            if (!app) {
              // We register handlers for things that aren't apps
              var theWindow = contentWindowRef;
              if (!theWindow._MOZ_NOAPP_SERVICES)
                  theWindow._MOZ_NOAPP_SERVICES = {};
              if (!theWindow._MOZ_NOAPP_SERVICES[activity])
                  theWindow._MOZ_NOAPP_SERVICES[activity] = {};
              theWindow._MOZ_NOAPP_SERVICES[activity][message] = func;
              return;
            }

            // make sure the app supports this activity
            if (!(app.services && app.services[activity])) {
                console.log("app attempted to register handler for activity " + activity + " but not declared in manifest");
                return;
            }
            //console.log("Registering handler for " + app.origin + " " + activity + " / " + message);

            if (!theWindow._MOZ_SERVICES)
                theWindow._MOZ_SERVICES = {};

            if (!theWindow._MOZ_SERVICES[activity])
                theWindow._MOZ_SERVICES[activity] = {};

            theWindow._MOZ_SERVICES[activity][message] = func;
        });
    },

    // invoke below should really be named startActivity or something
    // this call means to invoke a specific call within a given app
    invokeService: function(contentWindow, activity, message, args, cb, privileged) {
        FFRepoImplService.getAppByUrl(contentWindow.location, function(app) {
            var theWindow = contentWindow;

            if (!app) {
              if (privileged) {
                try {
                    theWindow._MOZ_NOAPP_SERVICES[activity][message](args, cb);
                } catch (e) {
                    console.log("error invoking " + activity + "/" + message + " in privileged invocation\n" + e.toString());
                }
              }
              return;
            }

            // make sure the app supports this activity
            if (!(app.services && app.services[activity])) {
                console.log("attempted to send message to app for activity " + activity + " but app doesn't support it");
                return;
            }

            try {
                theWindow._MOZ_SERVICES[activity][message](args, cb);
            } catch (e) {
                console.log("error invoking " + activity + "/" + message + " on app " + app.origin + "\n" + e.toString());
            }
        });
    },

    invoke: function(contentWindowRef, methodName, args, successCB, errorCB) {
      try {
        // Do we already have a panel for this content window?
        let thePanel, theIFrame, thePanelRecord;
        for each (let popupCheck in this._popups) {
          if (contentWindowRef == popupCheck.contentWindow) {
            thePanel = popupCheck.panel;
            theIFrame = popupCheck.iframe;
            thePanelRecord = popupCheck;
            break;
          }
        }
        // If not, go create one
        // TEMPORARY: always create panel for debugging
        //if (!thePanel) {
        if (1) {
          let tmp = this._createPopupPanel();
          thePanel = tmp[0];
          theIFrame = tmp[1];
          thePanelRecord =  { contentWindow: contentWindowRef, panel: thePanel, iframe: theIFrame} ;

          this._popups.push( thePanelRecord );
        }
        this.show(thePanel);

        // Update the content for the new invocation        
        thePanelRecord.contentWindow = contentWindowRef;
        thePanelRecord.methodName = methodName;
        thePanelRecord.args = args;
        thePanelRecord.successCB = successCB;
        thePanelRecord.errorCB = errorCB; 
        //XX this memory is going to stick around for a long time; consider cleaning it up proactively
        
        this._updateContent(thePanelRecord);
        } catch (e) {
          dump(e + "\n");
          dump(e.stack + "\n");
        }
    },

    _updateContent: function(thePanelRecord) {
      // We are going to inject into our iframe (which is pointed at service.html).
      // It needs to know:
      // 1. What method is being invoked (and maybe some nice explanatory text)
      // 2. Which services can provide that method, along with their icons and iframe URLs
      // 3. Where to return messages to once it gets confirmation (that would be this)
      
      // Hang on, the window may not be fully loaded yet
      let self = this;
      let { methodName, args, successCB, errorCB } = thePanelRecord;
      let contentWindowRef = thePanelRecord.contentWindow;
      let theIFrame = thePanelRecord.iframe;
      let thePanel = thePanelRecord.panel;
      
      
      function updateContentWhenWindowIsReady()
      {
//        let theIFrame = theIFrame.wrappedJSObject;
        if (!theIFrame.contentDocument || !theIFrame.contentDocument.getElementById("wrapper")) {
          let timeout = self._window.setTimeout(updateContentWhenWindowIsReady, 1000);
        } else {
          // Ready to go: attach our response listener
          theIFrame.contentDocument.wrappedJSObject.addEventListener("message", function(event) {
            if (event.origin == "resource://openwebapps/service") {
              var msg = JSON.parse(event.data);
              if (msg.cmd == "result") {
                try {
                  thePanel.hidePopup();
                  successCB(event.data);
                } catch (e) {
                  dump(e + "\n");
                }
              } else if (msg.cmd == "error") {
                dump(event.data + "\n");
              } else if (msg.cmd == "reconfigure") {
                dump("services.js: Got a reconfigure event\n");
                self._updateContent(contentWindowRef, thePanel, theIFrame, methodName, args, successCB, errorCB);
              }
            } else {
            }
          }, false);
          
          // Send reconfigure event
          thePanel.successCB = successCB;
          thePanel.errorCB = errorCB;
          
          FFRepoImplService.findServices(methodName, function(serviceList) {
    
            // Make the iframes
            for (var i=0;i<serviceList.length;i++)
            {
              let svc = serviceList[i];
              let frame = theIFrame.contentDocument.createElement("iframe");
              frame.src = svc.url;
              frame.classList.add("serviceFrame");
              frame.setAttribute("id", "svc-frame-" + i);
              theIFrame.contentDocument.getElementById("frame-garage").appendChild(frame);
              theIFrame.addEventListener("DOMContentLoaded", function(event) {
                // XXX this should be a deterministic link based on the call to registerBuiltInApp
                if (svc.url.indexOf("resource://") == 0) {
                  let observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
                  observerService.notifyObservers(frame.contentWindow, "openwebapps-service-panel-loaded", "");
                }
              }, false);
            }

            // direct call
            theIFrame.contentWindow.wrappedJSObject.handleAdminPostMessage(
                JSON.stringify({cmd:"setup", method:methodName, args:args, serviceList: serviceList, 
                                caller:contentWindowRef.location.href}));

            // direct call
            theIFrame.contentWindow.wrappedJSObject.handleAdminPostMessage(
                JSON.stringify({cmd:"start_channels"}));
          });
        }
      }
      updateContentWhenWindowIsReady();
    }
};

var EXPORTED_SYMBOLS = ["serviceInvocationHandler"];
exports.serviceInvocationHandler = serviceInvocationHandler;
