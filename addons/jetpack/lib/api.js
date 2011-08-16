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
 * The Original Code is trusted.js; substantial portions derived
 * from XAuth code originally produced by Meebo, Inc., and provided
 * under the Apache License, Version 2.0; see http://github.com/xauth/xauth
 *
 * Contributor(s):
 *     Michael Hanson <mhanson@mozilla.com>
 *     Dan Walkowski <dwalkowski@mozilla.com>
 *     Anant Narayanan <anant@kix.in>
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

const {Cc, Ci, Cu, Cr, components} = require("chrome");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

var {TypedStorage} = require("typed_storage");

var console = {
    log: function(s) {dump(s+"\n");}
};

var {Manifest} = require("./manifest");
var {URLParse} = require("./urlmatch");

// We want to use as much from the cross-platform repo implementation
// as possible, but we do need to override a few methods.
var {Repo} = require("repo");

function FFRepoImpl() {
  this._builtInApps = {};
}
FFRepoImpl.prototype = {
    __proto__: Repo,
    _observer: Cc["@mozilla.org/observer-service;1"]
                .getService(Ci.nsIObserverService),
    
    _registerBuiltInApp: function(domain, app, injector) {
        this._builtInApps[domain] = { 
            manifest:app,
            origin:domain,
            install_time: new Date().getTime(),
            install_origin:domain,
            injector: injector
        }
        this._repo.invalidateCaches();
    },
    
    iterateApps: function(callback) {
        let that = this;
        Repo.iterateApps(function(apps) {
            if (that._builtInApps) {
                for (var k in that._builtInApps) {
                    apps[k] = that._builtInApps[k];
                }
            }
            callback(apps);
        });
    },
    
    install: function _install(location, args, window)
    {
        // added a quick hack to forgo the prompt if a special argument is 
        // sent in, to make it easy to install app straight from the lower-right prompt.
        var autoInstall = args._autoInstall;

        function displayPrompt(installOrigin, appOrigin, manifestToInstall,
            isUpdate, installConfirmationFinishFn)
        {
            dump("APPS | api.install.displayPrompt | Checking for prompt\n");
            if (autoInstall)
                return installConfirmationFinishFn(true);

            let acceptButton = new Object();
            let declineButton = new Object();

            let message = "Are you sure you want to install " +
                manifestToInstall.name + "?";

            acceptButton.label = "Install";
            acceptButton.accessKey = "i";
            acceptButton.callback = function() {
                installConfirmationFinishFn(true);
            };

            declineButton.label = "Cancel";
            declineButton.accessKey = 'c';
            declineButton.callback = function() {
                installConfirmationFinishFn(false);
            };

            let ret = window.PopupNotifications.show(
                window.gBrowser.selectedBrowser,
                "openwebapps-install-notification",
                message, null, acceptButton, [declineButton], {
                    "persistence": 1,
                    "persistWhileVisible": true,
                    "eventCallback": function(state) {
                        // If the user dismisses the prompt, we cancel
                        // installation
                        if (state == "dismissed") {
                            installConfirmationFinishFn(false);
                            ret.remove();
                        }
                    }
                }
            );
        }

        function fetchManifest(url, cb)
        {
          dump("APPS | api.install.fetchManifest | Fetching manifest from " + url + "\n");
            // contact our server to retrieve the URL
            let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
                    createInstance(Ci.nsIXMLHttpRequest);
            xhr.open("GET", url, true);
            xhr.onreadystatechange = function(aEvt) {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        dump("APPS | api.install.fetchManifest | Got manifest (200) " + xhr.responseText.length + " bytes\n");
                        cb(xhr.responseText, xhr.getResponseHeader('Content-Type'));
                    } else {
                        dump("Failed to get manifest (" + xhr.status + ")\n");
                        cb(null);
                    }
                }
            };
            xhr.send(null);
        }
    
        // Fetch from local file:// or resource:// URI (eg. for faker apps)
        let originalOrigin = {};
        function fetchLocalManifest(url, cb)
        {
            function LocalReader(callback) { this._callback = callback; }
            LocalReader.prototype = {
                QueryInterface: function(iid) {
                    if (iid.equals(Ci.nsIStreamListener) ||
                        iid.equals(Ci.nsIRequestObserver) ||
                        iid.equals(Ci.nsISupports))
                        return this;
                    throw Cr.NS_ERROR_NO_INTERFACE;
                },
            
                onStartRequest: function(req, ctx) {
                    this._data = "";
                    this._input = null;
                },

                onDataAvailable: function(req, ctx, stream, off, count) {
                    if (!this._input) {
                        let sis = Cc["@mozilla.org/scriptableinputstream;1"]
                            .getService(Ci.nsIScriptableInputStream);
                        sis.init(stream);
                        this._input = sis;
                    }
                    
                    this._data += this._input.read(count);
                },

                onStopRequest: function(req, ctx, stat) {
                    this._input.close();
                    if (components.isSuccessCode(stat))
                        this._callback(this._data, "application/x-web-app-manifest+json");
                    else
                        this._callback(null);
                }
            };

            let ios = Cc["@mozilla.org/network/io-service;1"]
                .getService(Ci.nsIIOService);
            let stream = Cc["@mozilla.org/scriptableinputstream;1"]
                .getService(Ci.nsIScriptableInputStream);
            let channel = ios.newChannel(originalOrigin[url], null, null);
            channel.asyncOpen(new LocalReader(cb), null);
        }

        // Choose appropriate fetcher depending on where the manifest lives
        let fetcher = fetchManifest;
        if (args.url.indexOf("resource://") === 0 ||
            args.url.indexOf("file://") === 0) {
            fetcher = fetchLocalManifest;
            if (!args.origin) throw "Local manifest specified without origin!";

            // We'll have to store the resource/file URI to allow repo.install
            // to get the correct origin domain
            originalOrigin[args.origin] = args.url;
            args.url = args.origin;
        }

        let self = this;
        return Repo.install(location, args, displayPrompt, fetcher,
            function (result) {
                dump("APPS | jetpack.install | Repo install returned to callback; result is " + result + "\n");
                // install is complete
                if (result !== true) {
                    if (args.onerror) {
                        let errorResult;
                        if (result.error.length == 2) {
                            // Then it's [code, error]
                            errorResult = {code: result.error[0], message: result.error[1]};
                        } else {
                            errorResult = result.error;
                        }
                        // Note, here and below we use (1,...) to force this to be
                        // window (instead of args):
                        (1,args.onerror)(errorResult);
                    }
                } else {
                    var origin = URLParse(args.url).normalize().originOnly().toString();
                    self._observer.notifyObservers(
                        null, "openwebapp-installed", JSON.stringify({ 
                          origin: origin, 
                          skipPostInstallDashboard: args.skipPostInstallDashboard ? args.skipPostInstallDashboard : false
                        })
                    );
                    
                    // create OS-local application
                    /*
                    dump("APPS | jetpack.install | Getting app by URL now\n");
                    Repo.getAppById(origin, function(app) {
                        dump("APPS | jetpack.install | getAppByUrl returned " + app + "\n");
                        if (app) {
                          dump("APPS | jetpack.install | Calling NativeShell.CreateNativeShell\n");
                          NativeShell.CreateNativeShell(app);
                        }
                    });
                    */

                    if (args.onsuccess) {
                        (1,args.onsuccess)();
                    }
                }
            }
        );
    },
    
    uninstall: function(key, onsuccess, onerror)
    {
        let self = this;
        Repo.uninstall(key, function(result) {
            if (typeof result == 'object' && 'error' in result) {
                onerror({
                    'code':result['error'][0],
                    'message':result['error'][1]
                });
            } else if (typeof onsuccess == 'function') {
                self._observer.notifyObservers(
                    null, "openwebapp-uninstalled", null
                );
                onsuccess(result);
            }
        });
    },
    
    /* a function to check that an invoking page has "management" permission
     * all this means today is that the invoking page (dashboard) is served
     * from the same domain as the application repository. */
    verifyMgmtPermission: function _verifyMgmtPermission(origin)
    {
        let loc = origin;

        // make an exception for local testing, who via postmessage events
        // have an origin of "null"
        if ((origin === 'null' || origin.toString().substr(0, 8) == 'file:///')) {
            return;
        }

        // this is where we could have a whitelist of acceptable management
        // domains.
        if (origin.host == "127.0.0.1:60172" || /* special case for unit testing: to be removed when we get capability tracking for mgmt! */
            origin.host == "myapps.mozillalabs.com" ||
            origin.host == "stage.myapps.mozillalabs.com" ||
            origin.host == "apps.mozillalabs.com" ||
            origin.host == "localhost:8010" ||
            origin.toString().substr(0, 10) == "about:apps" ||
            origin.toString().substr(0, 9) == "resource:"
            )
        {
            return;
        }
        
        // but for now:
        throw [ 'permissionDenied',
                "to access open web apps management apis, you must be on the same domain " +
                "as the application repository" ];
    },

    loginStatus: function loginStatus(location, args)
    {
        verifyMgmtPermission(location.href);
        let loginInfo = {
            loginLink: location.protocol + '//' + location.host + '/login.html',
            logoutLink: location.protocol + '//' + location.host + '/logout'
        };
        let userInfo = sync.readProfile();
        return [userInfo, loginInfo];
    },

    launch: function _launch(id, dest)
    {
        function openAppURL(url, app)
        {
            let ss = Cc["@mozilla.org/browser/sessionstore;1"]
                    .getService(Ci.nsISessionStore);
            let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Ci.nsIWindowMediator);
            let bEnum = wm.getEnumerator("navigator:browser");

            let origin = URLParse(url).normalize().originOnly().toString();
            let found = false;

            // Do we already have this app running in a tab? If so, target it.
            while (!found && bEnum.hasMoreElements()) {
                let browserWin = bEnum.getNext();
                let tabbrowser = browserWin.gBrowser;

                for (let index = 0; index < tabbrowser.tabs.length; index++) {
                    let cur = tabbrowser.tabs[index];
                    let brs = tabbrowser.getBrowserForTab(cur);
                    let appURL = ss.getTabValue(cur, "appURL");
                    let brsOrigin = URLParse(brs.currentURI.spec)
                        .normalize().originOnly().toString();

                    if (appURL && appURL == origin) {
                        // The app is running in this tab; select it and retarget.
                        browserWin.focus();
                        tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];

                        // If destination is different than loaded content,
                        // notify the app if it is registered to handle it,
                        // else, reload the page with the new URL?
                        if (url != brs.currentURI.spec) {
                            if (app.services && app.services['link.transition']) {
                                try {
                                    var services = require("./services");
                                    var serviceInterface = new services.serviceInvocationHandler(browserWin);
                                    serviceInterface.invokeService(brs.contentWindow.wrappedJSObject,
                                                                   'link.transition', 'transition',
                                                                   {'url' : url},
                                                                   function(result) {});
                                } catch (e) {
                                    console.log(e);
                                }
                            } else {
                                brs.loadURI(url, null, null); // Referrer is broken
                            }
                        }

                        found = true;
                    }
                }
            }

            // Our URL does not belong to a currently running app.
            // Create a new tab for that app and load our URL into it.
            if (!found) {
                let recentWindow = wm.getMostRecentWindow("navigator:browser");
                if (recentWindow) {
					let brs = recentWindow.gBrowser;
                    let tab = brs.addTab(app.launch_url);
                    let bar = recentWindow.document.getElementById("nav-bar");

                    brs.pinTab(tab);
                    brs.selectedTab = tab;
                    ss.setTabValue(tab, "appURL", origin);
                    bar.setAttribute("collapsed", true);
					
					//when clicking install after being told 'app available',
					//sometimes a user will have been not on the landing page,
					//so we should try to launch them into the page they were on
					//but now in the app experience
					if (app.services && app.services['link.transition']) {
						let launchService = function(e) {
                        	try {
	                            var services = require("./services");
	                            var serviceInterface = new services.serviceInvocationHandler(recentWindow);
								//TODO: this feels hacky. see line 425 for discussion
								if (brs.contentWindow.wrappedJSObject._MOZ_SERVICES != undefined) {
									//console.log("services were ready");
		                            serviceInterface.invokeService(brs.contentWindow.wrappedJSObject,
		                                                           'link.transition', 'transition',
		                                                           {'url' : url},
		                                                           function(result) {});
								}
								else {
									//console.log("services weren't ready");
									recentWindow.setTimeout(launchService, 500, false);	
								}
							} catch (e) {
                            	console.log(e);
                        	}
							recentWindow.document.removeEventListener("DOMContentLoaded", launchService, false);
						};
						
						// FIXME: for some reason using "load" here instead of "DOMContentLoaded" makes it never fire
						// same with using let tabwindow = brs.getBrowserForTab(tab).contentWindow.wrappedJSObject;
						// (and tabwindow.document) instead of recentWindow...
						// try em out yourself i guess, as we may have missed one combination of options.
						//this problem is what necessitates the above check on ._MOZ_SERVICES != undefined
						recentWindow.document.addEventListener("DOMContentLoaded", launchService, false);
						
						//let tabwindow = brs.getBrowserForTab(tab).contentWindow.wrappedJSObject;
						//tabwindow.document.addEventListener("DOMContentLoaded", launchLater, false);
                    } else {
                        brs.loadURI(url, null, null); // Referrer is broken
                    }
                } else {
                    // This is a very odd case: no browser windows are open, so open a new one.
                    var new_window = aWindow.open(url);
                    // TODO: convert to app tab somehow
                }
            }
        }

        // fixed the hack, using a proper API call to get a single app
        // (that API call may iterate, but that's not our problem here)
        Repo.getAppById(id, function(app) {
            if (!app)
                throw "Invalid AppID: " + id;

            if (dest) {
                let origin = URLParse(dest).normalize().originOnly().toString();
                if (origin != id)
                    throw "Invalid AppDestination " + dest;
            }

            openAppURL(dest ? dest : app.launch_url, app);
        });
    },

    getCurrentPageHasApp: function _getCurrentPageHasApp()
    {
        return this.currentPageAppURL != null;
    },

    getCurrentPageAppManifestURL: function _getCurrentPageAppManifestURL()
    {
        return this.currentPageAppURL;
    },

    getCurrentPageApp: function _getCurrentPageApp(callback)
    {
        if (this.currentPageAppURL) {
            if (this.currentPageAppManifest) {
                callback(this.currentPageAppManifest);
                return;
            }
            try {
                let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
                    createInstance(Ci.nsIXMLHttpRequest);
                xhr.open("GET", this.currentPageAppURL.spec, true);
                xhr.onreadystatechange = function(aEvt) {
                    if (xhr.readyState == 4) {
                        if (xhr.status == 200) {
                            try {
                                let manifest = JSON.parse(xhr.responseText);
                                this.currentPageAppManifest = manifest;
                                callback(manifest);
                            } catch (e) {
                                // TODO report this out
                                callback(null);
                            }
                        } else {
                            callback(null);
                        }
                    }
                };
                xhr.send(null);
            } catch (e) {
                dump("Error in getCurrentPageApp: " + e + "\n");
            }
        }
    },

    setCurrentPageAppURL: function _setCurrentPageApp(aURI)
    {
        this.currentPageAppURL = aURI;
        this.currentPageAppManifest = null;
    },
    
    websendIntroduce: function _websendIntroduce(browser, pickerPresentationCallback, iframeCreationCallback, anchor, wanted, callback)
    {
        try {
            // Find whether we have some apps that implement 'wanted'
            let potentialProviders = [];
            let apps = Repo.list();
            let matchArray = [];
            for each (let app in apps) {
                if (app.experimental && app.experimental.providers) {
                    for each (let w in wanted) {
                        for each (let p in app.experimental.providers) {
                            if (p.supports.indexOf(w) >= 0) {
                                matchArray.push(w);
                                // go ahead and check them all; we'll need the list later
                            }
                        }
                    }
                    if (matchArray.length > 0) {
                        potentialProviders.push(app);
                        break;
                    }
                }
            }

            if (potentialProviders.length == 0) {
                callback([]); // no matches, sorry!
            } else {
                // Save off the introductionCallback keyed on browser.contentDocument;
                // we'll need it when somebody calls welcome() later.   
                pickerPresentationCallback(potentialProviders, function(gotProvider) {
                    // instantiate the provider..
                    // assuming there will be a frame for now?
                    // which provider to load?    TODO to be 100% correct we should render each of the
                    // matching providers for the app as a different line item.
                    let providerElem;
                    for each (let p in gotProvider.experimental.providers) {
                        for each (let w in wanted) {
                            if (p.supports.indexOf(w) >= 0) {
                                providerElem = p;
                            }
                        }
                    }
                    if (providerElem.frame) {
                        let theIframe = iframeCreationCallback(providerElem.frame, matchArray, callback);
                    }
                });
            }
        } catch (e) {
            dump("Error in websend Introduce: " + e+"\n");
        }
    },
    
    websendWelcome: function _websendWelcome(browser, window, registrants, callback, introductionCallback)
    {
        // browser is the top-level browser
        // window is the iframe's window
        
        // BIG SCARY UNSAFE ASSUMPTION: The introduce() calling context is the top-level context.
        // Go recover the introductionCallback based on the introducing window (but see ASSUMPTION above, meh)
        // FIX: use window.parent not gBrowser.contentDocument
        
        // not sure what to do with welcomeCallback. SPEC.
        // TODO don't understand what to do with registrants? 
        try {
            let servicePort = new MessagePort(window, window.location.href);
            introductionCallback(["service-match-goes-here?"], servicePort, window);
        } catch (e) {
            dump("Error in websend welcome introductionCallback: " + e + "\n");
        }
        
        try {
            let customerPort = new MessagePort(browser.contentWindow, browser.contentWindow.location.href);
            callback(customerPort, {"customer":browser.contentDocument.location.href, "wanted":["who knows"]});
        } catch (e) {
            dump("Error in websend welcome callback:"    +e + "\n");
        }
    }
    
};


function MessagePort(window,targetDomain)
{
    this.window = window;
    this.targetDomain = targetDomain;
}

MessagePort.prototype = 
{
    postMessage: function(msg) {
        if (this.window) {
            this.window.postMessage(JSON.stringify(msg), "*");
            //TODO: get domain targeting right, do not use until this is done!    (+/- this.targetDomain?)
        }
    },
    
    close: function() {
        this.window = null;
    }
}

MessagePort.__defineSetter__("onmessage", function(val) {
    this.window.addEventListener('message', val, false);
});

// Declare the singleton
if (!FFRepoImplService) {
  var EXPORTED_SYMBOLS = ["FFRepoImplService"];
  var FFRepoImplService = new FFRepoImpl();
}

exports.FFRepoImplService = FFRepoImplService;

