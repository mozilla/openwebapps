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
    observerService.addObserver(this, "openwebapp-uninstalled", false);
}
serviceInvocationHandler.prototype = {

    _createPopupPanel: function() {

      let data = require("self").data;
      let thePanel = require("panel").Panel({
          contentURL: data.url("service2.html"),
          contentScriptFile: [
              data.url("mediatorapi.js"),
              data.url("jquery-1.4.4.min.js"),
              data.url("jquery-ui-1.8.10.custom.min.js"),
              data.url("service.js"),
          ],
          width: 484, height: 484
      });
      return thePanel;
    },
    
    show: function(panelRecord) {
      let {panel} = panelRecord;
      // TODO: steal sizeToContent from F1
      if (!panel.isShowing) {
//          panel.sizeTo(500, 400);
          let larry = this._window.document.getElementById('identity-box');
          panel.show(larry);
      }
      if (!panelRecord.isConfigured) {
        panel.port.emit("reconfigure");
        panelRecord.isConfigured = true;
      }
    },
    
    observe: function(subject, topic, data) {
      if (topic == "openwebapp-installed" || topic == "openwebapp-uninstalled")
      {
        // All visible panels need to be reconfigured now, while invisible
        // ones can wait until they are re-shown.
        for each (let popupCheck in this._popups) {
          if (popupCheck.panel.isShowing) {
            popupCheck.panel.port.emit("reconfigure");
          } else {
            popupCheck.isConfigured = false;
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
            // If this app's window has a parent which lives in one of our
            // panels, message the panel about the readiness.
            if (contentWindowRef.parent) {
              for each (let popupCheck in self._popups) {
                if (popupCheck.panel.url === contentWindowRef.parent.location.href) {
                  popupCheck.panel.port.emit("app_ready", contentWindowRef.location.href);
                  break;
                }
              }
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
    invokeService: function(contentWindow, activity, message, args, cb, cberr, privileged) {
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

            let cbshim = function(result) {
              cb(JSON.stringify(result));
            };
            let cberrshim = function(result) {
              if (cberr) {
                cberr(JSON.stringify(result));
              } else {
                console.log("invokeService error but no error callback:", JSON.stringify(result));
              }
            }
            try {
                theWindow._MOZ_SERVICES[activity][message](args, cbshim, cberrshim);
            } catch (e) {
                console.log("error invoking " + activity + "/" + message + " on app " + app.origin + "\n" + e.toString());
                // invoke the callback with an error object the content can see.
                cberrshim({error: e.toString()});
            }
        });
    },

    invoke: function(contentWindowRef, methodName, args, successCB, errorCB) {
      try {
        // Do we already have a panel for this content window?
        let thePanel, thePanelRecord;
        for each (let popupCheck in this._popups) {
          if (contentWindowRef == popupCheck.contentWindow) {
            thePanel = popupCheck.panel;
            thePanelRecord = popupCheck;
            break;
          }
        }
        // If not, go create one
        if (!thePanel) {
          let thePanel = this._createPopupPanel();
          thePanelRecord =  { contentWindow: contentWindowRef, panel: thePanel,
                              methodName: methodName, args: args,
                              successCB: successCB, errorCB: errorCB,
                              isConfigured: true} ;

          this._popups.push( thePanelRecord );
          this._configureContent(thePanelRecord);
        }
        this.show(thePanelRecord);
        } catch (e) {
          dump(e + "\n");
          dump(e.stack + "\n");
        }
    },

    _configureContent: function(thePanelRecord) {
      // We are going to inject into our iframe (which is pointed at service.html).
      // It needs to know:
      // 1. What method is being invoked (and maybe some nice explanatory text)
      // 2. Which services can provide that method, along with their icons and iframe URLs
      // 3. Where to return messages to once it gets confirmation (that would be this)
      let self = this;
      let { contentWindow, methodName, args, successCB, errorCB } = thePanelRecord;
      let thePanel = thePanelRecord.panel;

      // Ready to go: attach our response listeners
      thePanel.port.on("result", function(msg) {
        try {
          thePanel.hidePopup();
          successCB(event.data);
        } catch (e) {
          dump(e + "\n");
        }
      });
      thePanel.port.on("error", function(msg) {
        console.error("mediator reported invocation error:", msg)
      });
      thePanel.port.on("ready", function() {
        FFRepoImplService.findServices(methodName, function(serviceList) {
          thePanel.port.emit("setup", {
                          method: methodName,
                          args: args,
                          serviceList: serviceList,
                          caller: contentWindow.location.href
          });
      });

      thePanel.successCB = successCB;
      thePanel.errorCB = errorCB;
      });
    }
};

var EXPORTED_SYMBOLS = ["serviceInvocationHandler"];
exports.serviceInvocationHandler = serviceInvocationHandler;
