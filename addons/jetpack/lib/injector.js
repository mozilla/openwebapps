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

const {Cc, Ci, Cu} = require("chrome");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const ALL_GROUP_CONSTANT = "___all___";
let refreshed;

let Injector = {
  // Injector will inject code into the browser content.  The provider class
  // looks like:
  
  //  var someapiprovider = {
  //    apibase: null, // null == 'navigator.mozilla.labs', or define your own namespace
  //    name: 'my_fn_name', // builds to 'navigator.mozilla.labs.my_fn_name'
  //    script: null, // null == use injected default script or provide your own
  //    getapi: function() {
  //      let someobject = somechromeobject;
  //      return function() {
  //        someobject();
  //      }
  //    }
  //  }
  //  InjectorInit(window); // set injector on window
  //  injector.register(someapiprovider);
  //
  //  With the above object, there would be a new api in content that can
  //  be used from any webpage like:
  //
  //  navigator.mozilla.labs.my_fn_name();

  //**************************************************************************//
  // 

  _scriptToInject: function(provider) {
    // a provider may use it's own script to inject its api
    if (provider.script)
      return provider.script;

    // otherwise, use a builtin injector script that we load from this
    // function object:
    let script =  (function () {
      // __API_* strings are replaced in injector.js with specifics from
      // the provider class
      let apibase = '__API_BASE__';
      let fname = '__API_NAME__';
      let api_ns = apibase.split('.');
      let api = this;
      for (let i in api_ns) {
        if (!api[api_ns[i]]) 
          api[api_ns[i]] = {}
        api = api[api_ns[i]]
      }
      api[fname] = this['__API_INJECTED__'];
      delete this['__API_INJECTED__'];
      //dump("injected: "+eval(apibase+'.'+fname)+"\n");
    }).toString();

    let apibase = provider.apibase ? provider.apibase : 'navigator.mozilla.labs';
    script = script.replace(/__API_BASE__/g, apibase)
                  .replace(/__API_NAME__/g, provider.name)
                  .replace(/__API_INJECTED__/g, '__mozilla_injected_api_'+(provider.mangledName?provider.mangledName:provider.name)+'__');
    //dump(script+"\n");
    // return a wrapped script that executes the function
    return "("+script+")();";
  },

  /*
   * _inject
   *
   * Injects the content API into the specified DOM window.
   */
  _inject: function(win, provider) {
    // ensure we're dealing with a wrapped native
    var safeWin = new XPCNativeWrapper(win);
    // options here are ignored for 3.6
    let sandbox = new Cu.Sandbox(safeWin, { sandboxProto: safeWin, wantXrays: true });
    /*let sandbox = new Cu.Sandbox(
        Cc["@mozilla.org/systemprincipal;1"].
           createInstance(Ci.nsIPrincipal), 
    );*/

    sandbox.importFunction(provider.getapi(safeWin), '__mozilla_injected_api_'+(provider.mangledName?provider.mangledName:provider.name)+'__');
    sandbox.window = safeWin;
    sandbox.navigator = safeWin.navigator.wrappedJSObject;
    Cu.evalInSandbox(this._scriptToInject(provider), sandbox, "1.8");
  }

};



// hook up a separate listener for each xul window
function InjectorInit(window) {
  if (window.appinjector) return;
  window.appinjector = {
    providers: [],
    actions: [],
    onLoad: function() {
      var obs = Cc["@mozilla.org/observer-service;1"].
                            getService(Ci.nsIObserverService);
      obs.addObserver(this, 'content-document-global-created', false);
    },
  
    onUnload: function() {
      var obs = Cc["@mozilla.org/observer-service;1"].
                            getService(Ci.nsIObserverService);
      obs.removeObserver(this, 'content-document-global-created');
    },

    register: function(provider) {
      this.providers.push(provider);
    },
    registerAction: function(action) {
      this.actions.push(action);
    },

    observe: function(aSubject, aTopic, aData) {
      //if (!aSubject.location.href) return;
      // is this window a child of OUR XUL window?
      let mainWindow = aSubject.QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIWebNavigation)
                     .QueryInterface(Ci.nsIDocShellTreeItem)
                     .rootTreeItem
                     .QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIDOMWindow); 
      if (mainWindow != window) {
        return;
      }
      for (let i in this.actions) {
        this.actions[i]();
      }
      for (let i in this.providers) {
        //dump("injecting api "+this.providers[i].name+"\n");
        Injector._inject(aSubject, this.providers[i]);
      }
    },

    inject: function() {
      // arrange to setup windows created in the future...
      window.appinjector.onLoad();
      window.addEventListener("unload", function() window.appinjector.onUnload(), false);
      // and setup Windows which exist now.
      let browsers = window.document.querySelectorAll("tabbrowser");
      for (let i = 0; i < browsers.length; i++) {
        for (let j = 0; j < browsers[i].browsers.length; j++) {
          let cw = browsers[i].browsers[j].contentWindow;
          if (cw) {
            window.appinjector.observe(cw);
          }
        }
      }
    }
  };
}

exports.InjectorInit = InjectorInit;
