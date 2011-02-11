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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

let EXPORTED_SYMBOLS = ["InjectorInit"];

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
    /*let sandbox = new Components.utils.Sandbox(
        Components.classes["@mozilla.org/systemprincipal;1"].
           createInstance(Components.interfaces.nsIPrincipal), 
    );*/

    sandbox.importFunction(provider.getapi(safeWin), '__mozilla_injected_api_'+(provider.mangledName?provider.mangledName:provider.name)+'__');
    sandbox.window = safeWin;
    sandbox.navigator = safeWin.navigator.wrappedJSObject;
    Cu.evalInSandbox(this._scriptToInject(provider), sandbox, "1.8");
  }

};



// hook up a seperate listener for each xul window
function InjectorInit(window) {
  if (window.injector) return;
  window.injector = {
    providers: [],
    actions: [],
    onLoad: function() {
      var obs = Components.classes["@mozilla.org/observer-service;1"].
                            getService(Components.interfaces.nsIObserverService);
      obs.addObserver(this, 'content-document-global-created', false);
    },
  
    onUnload: function() {
      var obs = Components.classes["@mozilla.org/observer-service;1"].
                            getService(Components.interfaces.nsIObserverService);
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
      let mainWindow = aSubject.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                     .getInterface(Components.interfaces.nsIWebNavigation)
                     .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                     .rootTreeItem
                     .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                     .getInterface(Components.interfaces.nsIDOMWindow); 
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
      
      // Now construct services based on installed apps
      Components.utils.import("resource://openwebapps/modules/api.js");
      let apps = FFRepoImplService.list("chrome://openwebapps/modules/injector.js");
      let suiteMap = {};
      
      for each (let app in apps)
      {
        if (app.experimental && app.experimental.services) 
        {
          for each (let service in app.experimental.services)
          {
            let suiteName = service.suite;
            let methodName = service.method;

            if (!suiteMap[suiteName]) {
              suite = {};
              suiteMap[suiteName] = suite;
            } else {
              suite = suiteMap[suiteName];
            }
            
            if (!suite[methodName]) {
              methodList = [];
              suite[methodName] = methodList;
            } else {
              methodList = suite[methodName];
            }
            
            methodList.push( {app:app, service:service});
          }
        }
      }
      
      function performServiceInvocation(theApplication, theService, callbackFn, args)
      {
        dump("Beginning service invocation for app " + theApplication.name + "." + theService.suite + "." +
          theService.method + " to " + theService.frame + "\n");
        dump("callbackFn is " + callbackFn + "\nargs is " + args + "\n");
          
        try {

          // There may be more efficient ways to do this.
          let windowMediator = Cc['@mozilla.org/appshell/window-mediator;1'].
            getService(Ci.nsIWindowMediator);
          let window = windowMediator.getMostRecentWindow(null);
          let document = window.document;
          let rootElement = document.documentElement;

          // Create an iframe and make it hidden
          let iframe = document.createElementNS('http://www.w3.org/1999/xhtml', 'iframe');
          iframe.setAttribute("style", "display:none");
          iframe.setAttribute("type", "content");
          rootElement.appendChild(iframe);

          // XXX this is probably not right - unless we require the page to register
          // onMessage before "load" - is that okay?
          let parseHandler = {
            _self: this,
            handleEvent: function Res_parseHandler_handleEvent(event) {
              event.target.removeEventListener("load", this, false);
              try
              { 
                // in a pure-JS world, we could just call this:
                let result = iframe.contentWindow.wrappedJSObject[theService.suite][theService.method].apply(null, args);
                
                // Typecheck: result should be an array.
                callbackFn.apply(null, result);
              }
              catch (e) { 
                dump("ERROR: " + e + "\n"); 
              }
              finally { 
                this._self = null; 
              }
            }
          };
          iframe.addEventListener("load", parseHandler, true);

          // and now target it
          iframe.setAttribute("callerWindow", window);
          iframe.src = theService.frame;        
        } catch (e) {
          dump(e + "\n");
          dump(e.stack + "\n");
        }
      }
      
      function generateConfirmationMessage(aSuiteName, aMethodName, args)
      {
        let hostname = window.gBrowser.selectedBrowser.contentWindow.location.hostname;
        if (aSuiteName == "id")
        {
          if (aMethodName == "getProfile")
          {
            let s = "" + hostname + " wants to know your ";
            for (let i=0;i<args[0].length;i++)
            {
              if (i == args[0].length - 1) s += " and ";
              else if (i > 0) s += ", ";
              
              let POCO_RENDER = {
                "name" : "full name",
                "gender" : "gender",
                "birthday" : "birthday",
                "emails": "email address(es)",
                "addresses": "street address(es)"
              }
              
              s += POCO_RENDER[args[0][i]]
            }
            s += ".";
            return {message:s, buttonPrefix:"Share data from "};
          }
        }
        else
        {
          return {message:
            "Allow " + hostname + " access to " + aSuiteName + "." + aMethodName + "?",
            buttonPrefix:"Allow access to "
          }
        }
      }
      
      for (let suiteName in suiteMap)
      {
        for (let methodName in suiteMap[suiteName])
        {
          let methodList = suiteMap[suiteName][methodName];
          dump("injecting " + suiteName + "." + methodName + ".\n");
          Injector._inject(aSubject,
            {
              apibase:"navigator.services." + suiteName,
              name: methodName,
              mangledName: 'services_' + suiteName + '_' + methodName,
              script: null,
              getapi: function() {
                let suiteLocal = suiteName;
                let methodLocal = methodName;
                return function(whitelist, callbackFn) {

                  // extract arguments:
                  let args = [];
                  for (let i=2;i<arguments.length;i++) {
                    args.push(arguments[i]);
                  }

                  // Render the message:
                  dump("making confirmation for " + suiteLocal + "." + methodLocal + ".\n");
                  
                  let confirm = generateConfirmationMessage(suiteLocal, methodLocal, args);
                  let message = confirm.message;
                  let buttonPrefix = confirm.buttonPrefix;
                  if (!buttonPrefix) buttonPrefix = "";

                  // TODO get the default.  first one wins right now.
                  let defaultOption = new Object();
                  let otherOptions = [];
                  
                  defaultOption.label = buttonPrefix + methodList[0].app.name;
                  defaultOption.accessKey = "i";
                  defaultOption.callback = function() {
                    performServiceInvocation(methodList[0].app, methodList[0].service, callbackFn, args);
                  };
                  
                  for (let i=1;i<methodList.length;i++) {
                    let svc = methodList[i];
                    let option = new Object();
                    option.label = buttonPrefix + svc.app.name;
                    option.accessKey = "p";
                    option.callback = function() {
                      performServiceInvocation(svc.app, svc.service, callbackFn, args);
                    }
                    otherOptions.push(option);
                  }

                  let ret = window.PopupNotifications.show(
                      window.gBrowser.selectedBrowser,
                      "openwebapps-service-notification",
                      message, null, defaultOption, otherOptions, {
                          "persistence": 1,
                          "persistWhileVisible": true
                      }
                  );
                }
              }
            }
          );
        }
      }
    }
  };
  window.injector.onLoad();
  window.addEventListener("unload", function() window.injector.onUnload(), false);
}
