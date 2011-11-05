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
 * The Original Code is People.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Shane Caraveo <shane@caraveo.com>
 *   Myk Melez <myk@mozilla.org>
 *   Justin Dolske <dolske@mozilla.com>
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

/* Inject the People content API into window.navigator objects. */
/* Partly based on code in the Geode extension. */

const { Cc, Ci, Cu } = require("chrome");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
const xulApp = require("api-utils/xul-app");

const HAS_NAVIGATOR_INJECTOR =
        xulApp.versionInRange(xulApp.version, "9.0a2", "*");

/**
 * NavigatorInjector
 *
 * this class backfills support for the JavaScript-navigator-property category
 * used by nsIDOMGlobalPropertyInitializer, which was added for fx9.  Any
 * module that wants to add properties onto the navigator object should do so
 * using nsIDOMGlobalPropertyInitializer.  Ideally only one instance of this
 * class would be run in a single process of firefox (ie. it should be an
 * xpcom service.). NavigatorInjector will only initialize in firefox 8 or
 * earlier.
 *
 * Once you call init() in this module, you do not need to do anything else
 * so long as you have registered your api like:

  // register the class that implements nsIDOMGlobalPropertyInitializer
  Cm.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
    MozAppsAPIClassID, "MozAppsAPI", MozAppsAPIContract, MozAppsAPIFactory
  );
  // register the category and contract for our api
  Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager).
              addCategoryEntry("JavaScript-navigator-property", "mozApps",
                      MozAppsAPIContract,
                      false, true);

 * see openwebapps/addon/jetpack/lib/main.js for an implementation of the
 * above classes.
 */
function NavigatorInjector() {
  console.log("initalize NavigatorInjector");
  this.onLoad();
}
NavigatorInjector.prototype = {
  _scriptToInject: function(entry, fname) {
    // use a builtin injector script that we load from this
    // function object:
    let script = (function() {
      // __API_* strings are replaced in injector.js with specifics from
      // the provider class
      let apibase = '__API_BASE__';
      let fname = '__API_NAME__';
      let api_ns = apibase.split('.');
      let api = this;
      for (let i in api_ns) {
        if (!api[api_ns[i]]) api[api_ns[i]] = {}
        api = api[api_ns[i]]
      }
      api[fname] = this['__API_INJECTED__'];
      delete this['__API_INJECTED__'];
      //console.log("injected: "+apibase+'.'+fname+" "+eval(apibase+'.'+fname)+"\n");
    }).toString();

    let apibase = 'navigator.'+entry;
    let mangledName = entry+"_"+fname;
    script = script.replace(/__API_BASE__/g, apibase).
                    replace(/__API_NAME__/g, fname).
                    replace(/__API_INJECTED__/g, '__navigator_injected_api_' + mangledName + '__');
    //console.log(script+"\n");
    // return a wrapped script that executes the function
    return "(" + script + ")();";
  },

/*
   * _inject
   *
   * Injects the content API into the specified DOM window.
   */
  _inject: function(aWindow, entry, fname, fn) {
    // ensure we're dealing with a wrapped native
    let mangledName = entry+"_"+fname;
    var safeWin = new XPCNativeWrapper(aWindow);
    let sandbox = new Cu.Sandbox(safeWin, {
      sandboxProto: aWindow,
      wantXrays: true
    });

    sandbox.importFunction(fn, '__navigator_injected_api_' + mangledName + '__');
    sandbox.window = safeWin;
    sandbox.navigator = safeWin.navigator.wrappedJSObject;
    Cu.evalInSandbox(this._scriptToInject(entry, fname), sandbox, "1.8");
  },

  _createProperties: function(aWindow) {
    //console.log("createProperties for "+aWindow.location);
    try {
      const CATEGORY_TO_ENUMERATE = "JavaScript-navigator-property";
      var cm = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
      var enumerator = cm.enumerateCategory(CATEGORY_TO_ENUMERATE);
      var entries = [];
      while (enumerator.hasMoreElements()) {
          var item = enumerator.getNext();
          var entry = item.QueryInterface(Ci.nsISupportsCString)
          var value = cm.getCategoryEntry(CATEGORY_TO_ENUMERATE, entry.toString());
          entries.push([entry, value]);
          var p = Cc[value].createInstance(Ci.nsIDOMGlobalPropertyInitializer);
          var obj = p.init(aWindow);

          for (var fn in obj) {
            this._inject(aWindow, entry, fn, obj[fn]);
          }
      }
    } catch(e) {
      console.log(e.toString());
    }
  },

  onLoad: function() {
    var obs = Cc["@mozilla.org/observer-service;1"].
    getService(Ci.nsIObserverService);
    obs.addObserver(this, 'content-document-global-created', false);
  },

  onUnload: function() {
    var obs = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    obs.removeObserver(this, 'content-document-global-created');
  },

  observe: function(aWindow, aTopic, aData) {
    this._createProperties(aWindow);
  }
}

var gInjector;
exports.init = function() {
  if (!HAS_NAVIGATOR_INJECTOR)
    gInjector = new NavigatorInjector();
}


