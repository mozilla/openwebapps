/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
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
let {OAuthConsumer} = require("oauthorizer/oauthconsumer");
let tmp = {}
Cu.import("resource://gre/modules/Services.jsm", tmp);
let {Services} = tmp;
const { Worker } = require('api-utils/content');
const tabs = require("tabs");

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
function MediatorPanel(window, activity) {
  this.window = window; // the window the panel is attached to
  this.methodName = activity.action;
  this.defaultData = {
    activity: {
      action: activity.action,
      type: activity.type,
      data: {}
    }
  };
  this.frames = [];
  this.handlers = {};

  this.mediator = mediators[this.methodName];

  this.panel = null;
  this.invalidated = true;

  // we use document-element-inserted here rather than
  // content-document-global-created so that other listeners using
  // content-document-global-created will be called before us (e.g. injector.js
  // needs to run first)
  Services.obs.addObserver(this, 'document-element-inserted', false);
  this.contentScriptFile = [require("self").data.url("servicesapi.js")];

  this._createPopupPanel();
}

MediatorPanel.prototype = {
  startActivity: function(activity, successCB, errorCB) {
    let tabData = {
      activity: activity,
      successCB: successCB,
      errorCB: errorCB
    }
    let tab = tabs.activeTab;
    if (!tab.activity)
      tab.activity = {};
    tab.activity[this.methodName] = tabData;
    // If the tab is closed or deactivated we want to hide and invalidate the
    // panel so our state doesn't get messed up.
    tab.on("close", function() {
      this.invalidated = true;
      this.panel.hide();
    }.bind(this));
    tab.on("deactivate", function() {
      this.invalidated = true;
      this.panel.hide();
    }.bind(this));
    this.invalidated = true;
  },
  
  get tabData() {
    let tab = tabs.activeTab;
    return tab.activity? tab.activity[this.methodName] : this.defaultData;
  },

  observe: function(document, aTopic, aData) {
    if (aTopic != 'document-element-inserted' ||
        !document.defaultView || !document.defaultView.frameElement) return;
    //console.log("mediator got documented created notification");
    var id = document.defaultView.frameElement.getAttribute('id');
    for (var i=0; i < this.frames.length; i++) {
      if (id == this.frames[i].id) {
        let frame = this.frames.splice(i,1);
        this.inject(document.defaultView, frame[0]);
        // hack to get the panel's window, important for tests
        this._panelWindow = document.defaultView.top;
        break;
      }
    }
  },
  
  get panelWindow() {
    return this._panelWindow;
  },
  
  inject: function(contentWindow, frame) {
    //console.log("using content scripts "+JSON.stringify(this.contentScriptFile)+"\n");
    let worker =  Worker({
      window: contentWindow,
      contentScriptFile: this.contentScriptFile
    });
    worker.port.emit("owa.service.origin", frame.origin);
    this.registerAPIs(worker, frame);
  },
  
  registerAPIs: function(worker, frame) {
    let mediator = this;
    // setup the owa.service api handlers
    worker.port.on("owa.service.oauth.call", function(args) {
      OAuthConsumer.call(args.svc, args.data, function(req) {
        //dump("oauth call response "+req.status+" "+req.statusText+" "+req.responseText+"\n");
        let response = JSON.parse(req.responseText);
        worker.port.emit(args.result, response);
      });
    });
    worker.port.on("owa.service.register.handler", function (activity) {
      //dump("register.handler "+JSON.stringify(activity)+"\n");
      //console.log("register.handler "+frame.origin+":"+activity.action+":"+activity.message);
      if (!mediator.handlers[frame.origin])
        mediator.handlers[frame.origin] = {};
      if (!mediator.handlers[frame.origin][activity.action])
        mediator.handlers[frame.origin][activity.action] = {};
      mediator.handlers[frame.origin][activity.action][activity.message] = worker;
    });
    worker.port.on("owa.service.ready", function () {
      mediator.panel.port.emit("owa.app.ready", frame.origin);
    });
  },

  /* OWA Mediator Agents may subclass the following: */
  get width() 484,
  get height() 484,

  /**
   * what the panel gets attached to
   * */
  get anchor() { return this.window.document.getElementById('identity-box') },

  /**
   * update the arguments that get sent to a mediator, primarily for subclassing
   */
  updateargs: function(data) { return data },

  /**
   * onOWASuccess
   *
   * the result data is sent back to the content that invoked the service,
   * this may result in data going back to some 3rd party content.  Eg, a
   * website invokes the share mechanism via a share button in its content.
   * the user clicks on the share button in the content, the share panel
   * appears.  When the user complets the share, the result of that share
   * is returned via on_result.
   */
  onOWASuccess: function(msg) {
    this.panel.hide();
    // the mediator might have seen a failure but offered its own UI to
    // retry - so hide any old error notifications.
    this.hideErrorNotification();
    if (this.tabData.successCB)
      this.tabData.successCB(msg);
  },

  onOWAClose: function(msg) {
    this.panel.hide();
  },

  onOWAFailure: function(errob) {
    console.error("mediator reported invocation error:", errob.message)
    this.showErrorNotification(errob);
  },

  onOWAReady: function(msg) {
    this._panelWindow = null;
    activityRegistry.get(this.methodName, function(serviceList) {
      this.tabData.activity.data = this.updateargs(this.tabData.activity.data);
      this.panel.port.emit("owa.mediation.setup", {
              activity: this.tabData.activity,
              serviceList: serviceList
      });
    }.bind(this));
  },

  onOWASizeToContent: function (args) {
    this.panel.resize(args.width, args.height);
  },

  onOWAFrames: function (args) {
    this.frames = args;
    this.panel.port.emit("owa.mediation.create-frames");
  },

  onOWAInvoke: function (activity) {
    let self = this;
    let worker = this.handlers[activity.origin][activity.action][activity.message];
    // setup the callback tunneling
    function postResult(result) {
      self.panel.port.emit(activity.success, result);
      self.panel.port.removeListener(activity.error, postException);
    }
    function postException(result) {
      self.panel.port.emit(activity.error, result);
      self.panel.port.removeListener(activity.success, postResult);
    }
    worker.port.once(activity.success, postResult)
    worker.port.once(activity.error, postException)
    // TODO! get the credentials working
    worker.port.emit("owa.service.invoke", {
      activity: activity,
      credentials: {}
    });
  },

  onOWALogin: function(params) {
    let wasShowing = this.panel.isShowing;
    let {app, auth} = params;
    if (auth.type == 'oauth') {
      try {
        let self = this;
        this.oauthAuthorize(auth, function(result) {
          let params = {app: app, credentials: result};
          self.panel.port.emit("owa.mediation.onLogin", params);
          // auth probably caused the panel to close - reopen it.
          if (wasShowing && !self.panel.isShowing) {
            self.show();
          }
        });
      } catch(e) {
        dump("onLogin fail "+e+"\n");
      }
    } else
    if (auth.type == 'dialog') {
      // I don't see how to set width/height with addon-sdk windows, so
      // we'll just do it the old fashioned way.  We use a full browser
      // window so that we get the urlbar, security status, etc.
      var url = auth.url,
        w = auth.width || 600,
        h = auth.height || 600,
        win = window.open(url,
            "owaLoginWindow",
            "dialog=no, modal=yes, width="+w+", height="+h+", scrollbars=yes");
      win.focus();
    } else {
      dump("XXX UNSUPPORTED LOGIN TYPE\n");
      this.panel.port.emit(eventName, {app: app, credentials: {}});
    }
  },

  onPanelShown: function() {
    // nothing to do here yet, but sub-classes might want to override this.
  },

  onPanelHidden: function() {
    // there is a timing issue here when tabs are being switched - as the
    // panel hide event comes the "old" tab is active, but by the time we
    // message the contentScript and it messages back, the "new" tab is
    // active.  So we must take care to remember the "old" tab before doing
    // the message dance.
    var activityToUpdate = this.tabData.activity;
    var tab = tabs.activeTab;
    this.panel.port.once("owa.mediation.setMediatorState", function(state) {
      activityToUpdate.mediatorState = state;
    });
    this.panel.port.emit("owa.mediation.panelHidden");
  },

  attachHandlers: function() {
    this.panel.port.on("owa.success", this.onOWASuccess.bind(this));
    this.panel.port.on("owa.failure", this.onOWAFailure.bind(this));
    this.panel.port.on("owa.close", this.onOWAClose.bind(this));
    this.panel.port.on("owa.mediation.ready", this.onOWAReady.bind(this));
    this.panel.port.on("owa.mediation.frames", this.onOWAFrames.bind(this));
    this.panel.port.on("owa.mediation.invoke", this.onOWAInvoke.bind(this));
    this.panel.port.on("owa.mediation.sizeToContent", this.onOWASizeToContent.bind(this));
    this.panel.port.on("owa.mediation.doLogin", this.onOWALogin.bind(this));
    // and handlers related to the panel itself
    this.panel.on("show", this.onPanelShown.bind(this));
    this.panel.on("hide", this.onPanelHidden.bind(this));
  },
  /* end message api */

  _createPopupPanel: function() {
    let data = require("self").data;
    let contentScriptFile = [data.url("mediatorapi.js")];
    let contentScript;

    // XXX - update mediator registration to also include
    // additional contentScriptFiles.
    let url = this.mediator && this.mediator.url;
    if (!url) {
      url = require("self").data.url("service.html");
    }
    if (this.mediator) {
      if (this.mediator.contentScriptFile) {
        contentScriptFile = contentScriptFile.concat(this.mediator.contentScriptFile);
      }
      if (this.mediator.contentScript) {
        contentScript = this.mediator.contentScript;
      }
    }

    let thePanel = require("panel").Panel({
      contentURL: url,
      contentScriptFile: contentScriptFile,
      contentScript: contentScript,
      contentScriptWhen: "start",
      width: this.width, height: this.height
    });

    this.panel = thePanel;
  },

  /**
   * show
   *
   * show the mediator popup
   */
  show: function() {
    if (this.invalidated) {
      this.tabData.activity.data = this.updateargs(this.tabData.activity.data);
      this.panel.port.emit("owa.mediation.updateActivity", this.tabData.activity);
      this.invalidated = false;
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
      if (data && data.message)
        message = data.message;
      else if (this.mediator && this.mediator.notificationErrorText)
        message = this.mediator.notificationErrorText;
      else
        message = "There was an error performing this action";

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
  },

  _makeOauthProvider: function(config) {
    try {
      // this is very much a copy of OAuthConsumer.authorize, but we have to
      // create a provider service object ourselves.  this should move into
      // oauthorizer.
      var svc = OAuthConsumer.makeProvider("f1-" + config.name, config.displayName, config.key, config.secret, config.completionURI, config.calls, true);
      svc.version = config.version;
      svc.tokenRx = new RegExp(config.tokenRx, "gi");
      if (config.deniedRx) {
        svc.deniedRx = new RegExp(config.deniedRx, "gi");
      }
      if (config.params) svc.requestParams = config.params;
      return svc;
    } catch (e) {
      dump("_makeOauthProvider: "+e + "\n");
    }
    return null;
  },

  oauthAuthorize: function(config, callback) {
    try {
      var svc = this._makeOauthProvider(config);
      var self = this;
      var handler = OAuthConsumer.getAuthorizer(svc, callback);

      this.window.setTimeout(function() {
        handler.startAuthentication();
      }, 1);
    } catch (e) {
      dump("oauthAuthorize: "+e + "\n");
    }
  },
  
  reconfigure: function() {
    if (this.panel.isShowing)
      this.panel.hide();

    this._panelWindow = null;
    this.frames = [];
    this.handlers = {};
    this.panel.port.emit("owa.mediation.reconfigure");
  }
}

var activityRegistry = {
  _activitiesList: {},
  registerActivityHandler: function(activity, url, title, data) {
    this.unregisterActivityHandler(activity, url);
    if (!this._activitiesList[activity]) this._activitiesList[activity] = [];
    this._activitiesList[activity].push({
      url: url,
      service: activity,
      title: title,
      app: data
    });
    Services.obs.notifyObservers(null, 'activity-handler-registered', activity);
  },
  unregisterActivityHandler: function(activity, url) {
    let activities = this._activitiesList[activity];
    if (!activities)
      return;
    for (var i=0; i < activities.length; i++) {
      if (activities[i].url == url) {
        activities.splice(i, 1);
        Services.obs.notifyObservers(null, 'activity-handler-unregistered', activity);
        return;
      }
    }
  },
  get: function(activityName, cb) {
    let activities = this._activitiesList[activityName] ? [].concat(this._activitiesList[activityName]) : [];
    try {
      // the owa api will need to be xpcom or something, we cannot import
      // addon-sdk files from an external addon
      //var {FFRepoImplService} = require("openwebapps/api");
      //FFRepoImplService.findServices(activityName, function(serviceList) {
      //  // make a combo list of our internal activities and installed apps
      //  activities = activities.concat(serviceList);
      //  cb(activities);
      //});
    } catch (e) {
    }
    cb(activities);
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
  observerService.addObserver(this, "activity-handler-registered", false);
  observerService.addObserver(this, "activity-handler-unregistered", false);
  observerService.addObserver(this, "openwebapp-installed", false);
  observerService.addObserver(this, "openwebapp-uninstalled", false);
  observerService.addObserver(this, "net:clear-active-logins", false);
  
  // if we open a new tab, close any mediator panels
  win.gBrowser.tabContainer.addEventListener("TabOpen", function(e) {
    for each (let mediator in this._popups) {
      if (mediator.panel.isShowing) mediator.panel.hide();
    }
  }.bind(this));
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
    // need to nuke any cached mediators here?
    mediators[methodName] = mediator;

    let newPopups = [];
    for each (let popupCheck in this._popups) {
      if (popupCheck.methodName === methodName) {
        // this popup record must die.
        let nukePanel = popupCheck.panel;
        nukePanel.destroy();
      } else {
        newPopups.push(popupCheck);
      }
    }
    this._popups = newPopups;
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
    if (topic === "activity-handler-registered" ||
        topic === "activity-handler-unregistered") {
      for each (let popupCheck in this._popups) {
        if (popupCheck.methodName == data)
          popupCheck.reconfigure();
      }
    } else
    if (topic === "openwebapp-installed" ||
        topic === "openwebapp-uninstalled" ||
        topic === "net:clear-active-logins")
    {
      // XXX TODO look at the change in the app and only reconfigure the related
      // mediators.
      for each (let popupCheck in this._popups) {
        popupCheck.reconfigure();
      }
    }
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
    //console.log("window closed - had", this._popups.length, "popups, now have", newPopups.length);
    this._popups = newPopups;
  },

  get: function(activity, successCB, errorCB) {
    for each (let panel in this._popups) {
      if (activity.action == panel.methodName) {
        // We are going to replace the existing activity (if any) for the
        // current tab with this new activity - but if there is some
        // mediatorState for that tab we want to keep that.
        activity.mediatorState = panel.tabData.activity.mediatorState;
        panel.startActivity(activity, successCB, errorCB);
        return panel;
      }
    }
    // if we didn't find it, create it
    let agent = agentCreators[activity.action] ? agentCreators[activity.action] : MediatorPanel;
    let panel = new agent(this._window, activity);
    panel.startActivity(activity, successCB, errorCB);
    // attach our response listeners
    panel.attachHandlers();
    this._popups.push(panel);
    return panel;
  },

  /**
   * invoke
   *
   * show the panel for a mediator, creating one if necessary.
   */
  invoke: function(activity, successCB, errorCB) {
    try {
    // Do we already have a panel for this service for this content window?
    let panel = this.get(activity, successCB, errorCB);
    panel.hideErrorNotification();
    panel.show();
    } catch (e) {
    dump(e + "\n");
    dump(e.stack + "\n");
    }
  }
};

exports.serviceInvocationHandler = serviceInvocationHandler;
exports.MediatorPanel = MediatorPanel;
exports.activityRegistry = activityRegistry;
