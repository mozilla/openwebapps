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
 *	Mark Hammond <mhammond@mozilla.com>
 *	Shane Caraveo <scaraveo@mozilla.com>
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
let {URLParse} = require("openwebapps/urlmatch");

// a mediator is what provides the UI for a service.  It is normal "untrusted"
// content (although from the user's POV it is somewhat trusted)
// What isn't clear is how the mediator should be registered - possibly it
// should become a normal app?
// key is the service name, value is object with static properties.
var mediators = {};

// An 'agent' is trusted code running with chrome privs.  It gets a chance to
// hook into most aspects of a service operation to add additional value for
// the user.  This might include things like automatically bookmarking
// sites which have been shared etc.  Agents will be either builtin to
// the User-Agent (ie, into Firefox) or be extensions.
var agentCreators = {}; // key is service name, value is a callable.

/**
 * MediatorPanel
 *
 * This class controls the mediator panel UI.  There is one per tab
 * per mediator, created only when needed.
 */
function MediatorPanel(window, contentWindowRef, methodName, args, successCB, errorCB) {
    this.window = window; // the window the panel is attached to
    this.contentWindow = contentWindowRef; // ???
    this.methodName = methodName;
    this.successCB = successCB;
    this.errorCB = errorCB;

    // Update the content for the new invocation
    this.args = this.updateargs(args);
    this.mediator = mediators[this.methodName];

    this.panel = null;
    this.configured = false;
    this.haveAddedListener = false; // is the message handler installed?
    this.isConfigured = false;

    this._createPopupPanel();
}
MediatorPanel.prototype = {
    /* OWA Mediator Agents may subclass the following: */
    
    /**
     * what the panel gets attached to
     * */
    get anchor() { return this.window.document.getElementById('identity-box') },
    
    /**
     * update the arguments that get sent to a mediator
     */
    updateargs: function(args) {
        return args;
    },
    /**
     * handlers for show/hide of the panel - will be hooked up if a subclass
     * defines them.
     * XXX - rename these to _on_panel_shown etc?
     */
    //_panelShown: function() {},
    //_panelHidden: function() {},

    /**
     * onResult
     *
     * the result data is sent back to the content that invoked the service,
     * this may result in data going back to some 3rd party content.  Eg, a
     * website invokes the share mechanism via a share button in its content.
     * the user clicks on the share button in the content, the share panel
     * appears.  When the user complets the share, the result of that share
     * is returned via on_result.
     */
    onResult: function(msg) {
        this.panel.hide();
        if (this.successCB)
            this.successCB(msg);
    },

    onClose: function(msg) {
        this.panel.hide();
    },
        
    onError: function(msg) {
        console.error("mediator reported invocation error:", msg)
        this.showErrorNotification(msg);
    },

    onReady: function(msg) {
        FFRepoImplService.findServices(this.methodName, function(serviceList) {
          this.panel.port.emit("setup", {
                          method: this.methodName,
                          args: this.args,
                          serviceList: serviceList,
                          caller: this.contentWindow.location.href
          });
        }.bind(this));
    },

    onSizeToContent: function (args) {
        this.panel.resize(args.width, args.height);
    },

    attachHandlers: function() {    
        this.panel.port.on("result", this.onResult.bind(this));
        this.panel.port.on("error", this.onError.bind(this));
        this.panel.port.on("close", this.onClose.bind(this));
        this.panel.port.on("ready", this.onReady.bind(this));
        this.panel.port.on("sizeToContent", this.onSizeToContent.bind(this));
    },
    /* end message api */

    _createPopupPanel: function() {
        let data = require("self").data;
        let contentScriptFile = [data.url("mediatorapi.js")];

        // XXX - update mediator registration to also include
        // additional contentScriptFiles.
        let url = this.mediator && this.mediator.url;
        if (!url) {
            url = require("self").data.url("service2.html");
        } else {
          if (this.mediator.contentScriptFile) {
            contentScriptFile = contentScriptFile.concat(this.mediator.contentScriptFile);
          }
        }
        let thePanel = require("panel").Panel({
          contentURL: url,
          contentScriptFile: contentScriptFile,
          contentScriptWhen: "start",
          width: 484, height: 484
        });

        if (this._panelShown) {
            thePanel.on("show", this._panelShown.bind(this));
        }
        if (this._panelHidden) {
            thePanel.on("hide", this._panelHidden.bind(this));
        }
        this.panel = thePanel;
    },

    /**
     * show
     *
     * show the mediator popup
     */
    show: function() {
        if (!this.isConfigured) {
            this.panel.port.emit("reconfigure");
            this.isConfigured = true;
        }
        this.panel.show(this.anchor);
    },

    /**
     * showErrorNotification
     *
     * show an error notification for this mediator
     */
    showErrorNotification: function(data) {
        let nId = "openwebapp-error-" + this.methodName;
        let nBox = this.window.gBrowser.getNotificationBox();
        let notification = nBox.getNotificationWithValue(nId);

        // Check that we aren't already displaying our notification
        if (!notification) {
            let message;
            if (data && data.msg)
                message = data.msg;
            else if (this.mediator && this.mediator.notificationErrorText)
                message = this.mediator.notificationErrorText;
            else
                message = "42";

            let self = this;
            buttons = [{
                label: "try again",
                accessKey: null,
                callback: function () {
                    self.window.setTimeout(function () {
                        self.show();
                    }, 0);
                }
            }];
            nBox.appendNotification(message, nId, null,
                                    nBox.PRIORITY_WARNING_MEDIUM, buttons);
        }
    },

    /**
     * hideErrorNotification
     *
     * hide notifications from this mediator
     */
    hideErrorNotification: function() {
        let nId = "openwebapp-error-" + this.methodName;
        let nb = this.window.gBrowser.getNotificationBox();
        let notification = nb.getNotificationWithValue(nId);
        if (notification) {
            nb.removeNotification(notification);
        }
    }
}


/**
 * serviceInvocationHandler
 *
 * Controller for all mediator panels within a single top level window.
 * 
 * We create a service invocation panel when needed; there is at most one per
 * tab, but the user can switch away from a tab while a service invocation
 * dialog is still in progress.
 *
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

    /**
     * registerMediator
     *
     * this is conceptually a 'static' method - once called it will affect
     * all future and current instances of the serviceInvocationHandler.
     *
     */
    registerMediator: function(methodName, mediator) {
      mediators[methodName] = mediator;
    },

    /**
     * registerAgent
     *
     * this is conceptually a 'static' method - once called it will affect
     * all future and current instances of the serviceInvocationHandler.
     *
     */
    registerAgent: function(methodName, callback) {
      agentCreators[methodName] = callback;
    },

    /**
     * initApp
     *
     * reset our mediators if an app is installed or uninstalled
     */
    observe: function(subject, topic, data) {
      if (topic === "openwebapp-installed" || topic === "openwebapp-uninstalled")
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

    /**
     * initApp
     *
     * called when an app tells us it's ready to go
     */
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
    
    /**
     * removePanelsForWindow
     *
     * window unload handler that removes any popup panels attached to the
     * window from our list of managed panels
     */
    removePanelsForWindow: function(evt) {
        // this window is unloading
        // nuke any popups targetting this window.
        // XXX - this probably needs tweaking - what if the app is still
        // "working" as the user navigates away from the page?  Currently
        // there is no reasonable way to detect this though.
        let newPopups = [];
        for each (let popupCheck in this._popups) {
          if (popupCheck.contentWindow === evt.currentTarget) {
            // this popup record must die.
            let nukePanel = popupCheck.panel;
            nukePanel.destroy();
          } else {
            newPopups.push(popupCheck);
          }
        }
        console.log("window closed - had", this._popups.length, "popups, now have", newPopups.length);
        this._popups = newPopups;
    },
    
    get: function(contentWindowRef, methodName, args, successCB, errorCB) {
        for each (let popupCheck in this._popups) {
            if (contentWindowRef == popupCheck.contentWindow && methodName == popupCheck.methodName) {
                return popupCheck;
            }
        }
        // if we didn't find it, create it
        let agent = agentCreators[methodName] ? agentCreators[methodName] : MediatorPanel;
        let panel = new agent(this._window, contentWindowRef, methodName, args, successCB, errorCB);
        // attach our response listeners
        panel.attachHandlers();
        this._popups.push(panel);
        // add an unload listener so we can nuke this popup info as the window closes.
        contentWindowRef.addEventListener("unload",
                           this.removePanelsForWindow.bind(this), true);
        return panel;
    },

    /**
     * invoke
     *
     * show the panel for a mediator, creating one if necessary.
     */
    invoke: function(contentWindowRef, methodName, args, successCB, errorCB) {
      try {
        // Do we already have a panel for this service for this content window?
        let panel = this.get(contentWindowRef, methodName, args, successCB, errorCB);
        panel.hideErrorNotification();
        panel.show();
      } catch (e) {
        dump(e + "\n");
        dump(e.stack + "\n");
      }
    }
};

var EXPORTED_SYMBOLS = ["serviceInvocationHandler"];
exports.serviceInvocationHandler = serviceInvocationHandler;
exports.MediatorPanel = MediatorPanel;
