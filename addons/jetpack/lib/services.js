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
var {FFRepoImplService} = require("api");
let {URLParse} = require("openwebapps/urlmatch");
let {OAuthConsumer} = require("oauthorizer/oauthconsumer");
let tmp = {}
Cu.import("resource://gre/modules/Services.jsm", tmp);
let {Services} = tmp;
const { Worker } = require('api-utils/content');

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

var nextinvocationid = 0;
/**
 * MediatorPanel
 *
 * This class controls the mediator panel UI.  There is one per tab
 * per mediator, created only when needed.
 */
function MediatorPanel(window, contentWindowRef, activity, successCB, errorCB) {
  this.window = window; // the window the panel is attached to
  this.contentWindow = contentWindowRef; // ???
  this.methodName = activity.action;
  this.activity = activity;
  this.successCB = successCB;
  this.errorCB = errorCB;
  this.frames = [];
  this.handlers = {};

  // Update the content for the new invocation
  this.args = this.updateargs(activity.data);
  this.mediator = mediators[this.methodName];

  this.panel = null;
  this.configured = false;
  this.haveAddedListener = false; // is the message handler installed?
  this.isConfigured = false;
  this.invocationid = nextinvocationid++;

  Services.obs.addObserver(this, 'content-document-global-created', false);
  this.contentScriptFile = [require("self").data.url("servicesapi.js")];

  this._createPopupPanel();
}
MediatorPanel.prototype = {
  observe: function(contentWindow, aTopic, aData) {
    if (aTopic != 'content-document-global-created') return;
    var id = contentWindow.frameElement.getAttribute('id');
    for (var i=0; i < this.frames.length; i++) {
      if (id == this.frames[i].id) {
        this.inject(contentWindow, this.frames[i]);
      }
    }
  },
  
  inject: function(contentWindow, frame) {
    dump("using content scripts "+JSON.stringify(this.contentScriptFile)+"\n");
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
      //dump("register.handler "+frame.origin+"/"+activity.action+"/"+activity.message+"\n");
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
    if (this.successCB)
      this.successCB(msg);
  },

  onOWAClose: function(msg) {
    this.panel.hide();
  },

  onOWAFailure: function(msg) {
    console.error("mediator reported invocation error:", msg)
    this.showErrorNotification(msg);
  },

  onOWAReady: function(msg) {
    FFRepoImplService.findServices(this.methodName, function(serviceList) {
      this.panel.port.emit("owa.mediation.setup", {
              activity: this.activity,
              serviceList: serviceList,
              caller: this.contentWindow.location.href,
              invocationid: this.invocationid
      });
    }.bind(this));
  },

  onOWASizeToContent: function (args) {
    this.panel.resize(args.width, args.height);
  },

  onOWAFrame: function (args) {
    this.frames.push(args);
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
    if (params.type == 'oauth') {
      try {
        let self = this;
        this.oauthAuthorize(params, function(result) {
          self.panel.port.emit("owa.mediation.onLogin", result);
          // auth probably caused the panel to close - reopen it.
          if (wasShowing && !self.panel.isShowing) {
            self.show();
          }
        });
      } catch(e) {
        dump("onLogin fail "+e+"\n");
      }
    } else
    if (params.type == 'dialog') {
      // I don't see how to set width/height with addon-sdk windows, so
      // we'll just do it the old fashioned way.  We use a full browser
      // window so that we get the urlbar, security status, etc.
      var url = params.url,
        w = params.width || 600,
        h = params.height || 600,
        win = window.open(url,
            "owaLoginWindow",
            "dialog=no, modal=yes, width="+w+", height="+h+", scrollbars=yes");
      win.focus();
    } else {
      dump("XXX UNSUPPORTED LOGIN TYPE\n");
      this.panel.port.emit("owa.mediation.onLogin", {});
    }
  },

  attachHandlers: function() {
    this.panel.port.on("owa.success", this.onOWASuccess.bind(this));
    this.panel.port.on("owa.failure", this.onOWAFailure.bind(this));
    this.panel.port.on("owa.close", this.onOWAClose.bind(this));
    this.panel.port.on("owa.mediation.ready", this.onOWAReady.bind(this));
    this.panel.port.on("owa.mediation.frame", this.onOWAFrame.bind(this));
    this.panel.port.on("owa.mediation.invoke", this.onOWAInvoke.bind(this));
    this.panel.port.on("owa.mediation.sizeToContent", this.onOWASizeToContent.bind(this));
    this.panel.port.on("owa.mediation.doLogin", this.onOWALogin.bind(this));
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
      url = require("self").data.url("service2.html");
    } else {
      if (this.mediator.contentScriptFile) {
      contentScriptFile = contentScriptFile.concat(this.mediator.contentScriptFile);
      }
      contentScript = this.mediator.contentScript;
    }
    let thePanel = require("panel").Panel({
      contentURL: url,
      contentScriptFile: contentScriptFile,
      contentScript: contentScript,
      contentScriptWhen: "start",
      width: this.width, height: this.height
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
      this.panel.port.emit("owa.mediation.reconfigure");
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
    if (topic === "openwebapp-installed" || topic === "openwebapp-uninstalled")
    {
    // All visible panels need to be reconfigured now, while invisible
    // ones can wait until they are re-shown.
    for each (let popupCheck in this._popups) {
      if (popupCheck.panel.isShowing) {
      popupCheck.panel.port.emit("owa.mediation.reconfigure");
      } else {
      popupCheck.isConfigured = false;
      }
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
    console.log("window closed - had", this._popups.length, "popups, now have", newPopups.length);
    this._popups = newPopups;
  },

  get: function(contentWindowRef, activity, successCB, errorCB) {
    for each (let popupCheck in this._popups) {
      if (contentWindowRef == popupCheck.contentWindow && activity.action == popupCheck.methodName) {
        return popupCheck;
      }
    }
    // if we didn't find it, create it
    let agent = agentCreators[activity.action] ? agentCreators[activity.action] : MediatorPanel;
    let panel = new agent(this._window, contentWindowRef, activity, successCB, errorCB);
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
  invoke: function(contentWindowRef, activity, successCB, errorCB) {
    try {
    // Do we already have a panel for this service for this content window?
    let panel = this.get(contentWindowRef, activity, successCB, errorCB);
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
