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
 *   Michael Hanson <mhanson@mozilla.com>
 *   Dan Walkowski <dwalkowski@mozilla.com>
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

/**
  2010-07-14
  First version of server code
  -Michael Hanson. Mozilla
**/

/*
* The server stores installed application metadata in local storage.
*
* The key for each application is the launch URL of the application;
* installation of a second app with the same launch URL will cause
* the first to be overwritten.
*
* The value of each entry is a serialized structure like this:
* {
*   app: { <application metadata> },
*   installTime: <install timestamp, UTC milliseconds>,
*   installURL: <the URL that invoked the install function>
* }
*
*/

;
ClientBridge = (function () {
  var chan = Channel.build({
    window: window.parent,
    origin: "*",
    scope: "openwebapps"
  });

  // If set to true, then you can suppress the install dialogs for installation
  // purposes.  You must change this at the source level (i.e., rewrite the
  // following line)
  var TESTING_MODE = false;
  // This holds the next response when confirmation is mocked out:
  var TESTING_MODE_RESPONSE = null;
  // This holds the next response when a service is invoked:
  var TESTING_MODE_CHOOSER = null;

  // Reference shortcut so minifier can save on characters
  var win = window;

  // when we recieve an install message we'll cache the origin
  // so we can instruct the client on how to handle visibility
  var installOrigin;


  // We're the top window, don't do anything
  if (win.top == win)
    return {};

  // unsupported browser
  if (!win.postMessage || !win.localStorage || !win.JSON)
    return {};

  function fetchManifest(url, cb) {
    // contact our server to retrieve the URL
    var xhr = new XMLHttpRequest();
    // proxy through HTML5 repo host to support cross domain fetching
    xhr.open("GET", "/getmanifest?url=" + escape(url), true);
    xhr.onreadystatechange = function(aEvt) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          cb(xhr.responseText, xhr.getResponseHeader("Content-Type"));
        } else {
          cb(null);
        }
      }
    };
    xhr.send(null);
  }

  function mockInstallPrompt(installOrigin, appOrigin, manifest, isUpdate, clientCB) {
    clientCB(TESTING_MODE_RESPONSE);
  }

  function mockAppChooser(requestor, serviceName, apps, onsuccess, onerror) {
    setTimeout(function () {
      onsuccess(apps[TESTING_MODE_CHOOSER]);
    });
  }

  if (TESTING_MODE) {
    chan.bind("setMockResponse", function (t, args) {
      TESTING_MODE_RESPONSE = args;
      return;
    });
    chan.bind("setApplicationChooser", function (t, args) {
      TESTING_MODE_CHOOSER = args;
      return;
    });
  }

  chan.bind("install", function(t, args) {
    // indicate that response will occur asynchronously, later.
    t.delayReturn(true);

    Repo.install(t.origin, args,
                 (TESTING_MODE && TESTING_MODE_RESPONSE !== null) ? mockInstallPrompt : displayInstallPrompt,
                 fetchManifest, function(r) {
      if (r === true) {
        // installation was confirmed by the user and successful.  In the case
        // where the installer is different than the app, we'll launch the user's
        // dashboard and "emphasize" the application that was just installed.
        var appURL = URLParse(args.url).normalize().originOnly();
        if ((! TESTING_MODE) && (! appURL.contains(t.origin))) {
          window.open("https://myapps.mozillalabs.com/?emphasize=" +
                      encodeURIComponent(appURL.toString()), "open_web_app_dashboard");
        }
        t.complete();
      } else if (typeof r.error === 'object' && typeof r.error.length === 'number' &&
                 r.error.length === 2) {
        t.error(r.error[0], errorRepr(r.error[1]));
      } else {
        t.error("internalError", "unknown internal error during install: " + errorRepr(r));
      }
    });
  });

  chan.bind("invokeService", function(t, args) {
    // indicate that response will occur asynchronously, later.
    t.delayReturn(true);

    Repo.findServices(args.name, function(svcs) {
      if (svcs.length === 0) {
        t.error("notAvailable", "no services are installed which support: " + args.name);
      } else {
        Repo.renderChooser(
          t.origin, svcs, args.name, args.args,
          (TESTING_MODE && TESTING_MODE_CHOOSER !== null) ? mockAppChooser : displayAppChooser,
          function(invocationResults) {
            t.complete(invocationResults);
          }, function(errCode, errMessage) {
            t.error(errCode, errMessage);
          });
      }
    });
  });

  /** Determines which applications are installed *for* the origin domain */
  chan.bind('amInstalled', function(t, args) {
    t.delayReturn(true);
    Repo.amInstalled(t.origin, function(v) {
      t.complete(v);
    });
  });

  /** Determines which applications were installed *by* the origin domain. */
  chan.bind('getInstalledBy', function(t, args) {
    t.delayReturn(true);
    Repo.getInstalledBy(t.origin, function(v) {
      t.complete(v);
    });
  });

  /* Management APIs for dashboards live beneath here */

  /* a function to check that an invoking page has "management" permission
   * all this means today is that the invoking page (dashboard) is served
   * from the same domain as the application repository. */
  function verifyMgmtPermission(origin) {
    var loc = win.location;
    // make an exception for local testing, who via postmessage events
    // have an origin of "null"
    if ((origin === 'null' && window.location.protocol === 'file:') ||
        ((loc.protocol + "//" + loc.host) === origin)) {
      return;
    }
    throw [ 'permissionDenied',
            "to access open web apps management apis, you must be on the same domain " +
            "as the application repository" ];
  }

  chan.bind('list', function(t) {
    verifyMgmtPermission(t.origin);
    t.delayReturn(true);
    Repo.list(function (apps) {
      var appList = [];
      for (var i in apps) {
        appList.push(apps[i]);
      }
      t.complete(appList);
    });
  });

  chan.bind('uninstall', function(t, origin) {
    verifyMgmtPermission(t.origin);
    t.delayReturn(true);
    Repo.uninstall(origin, function(r) {
      if (r === true) {
        t.complete(true);
      } else if (typeof r.error === 'object' && typeof r.error.length === 'number' &&
                 r.error.length === 2) {
        t.error(r.error[0], errorRepr(r.error[1]));
      } else {
        t.error("internalError", "unknown internal error during uninstall: " + errorRepr(r));
      }
    });
  });

  chan.bind('trackChanges', function (t) {
    Repo.watchUpdates(function (event) {
      chan.call({
        method: 'change', 
        params: event,
        success: function () {}
      });
    });
  });

  /*
   * help with debugging issues
   * We can eventually toggle this using a debug.myapps.org store
   */
  function logError(message) {
    if (win.console && win.console.log) {
      win.console.log('App Repo error: ' + message);
    }
  }

  function errorRepr(o) {
    /* Format an object to be presented as an error message
       [object Object] isn't very helpful ;) */
    var s = "";
    if (typeof o == 'object' && o.length) {
      for (var i=0; i<o.length; i++) {
        if (s) {
          s += " ";
        }
        s += o[i]; // XX ? safeRepr(o[i]);
      }
    } else if (typeof o == 'object') {
      for (var i in o) {
        if (o.hasOwnProperty(i)) {
          if (s) {
            s += ", ";
          }
          s += i + ': ' + o[i]; // XX ? safeRepr(o[i]);
        }
      }
    } else {
      s = o + '';
    }
    return s;
  }

  return {
    showDialog: function() { chan.notify({ method: "showme" }); },
    hideDialog: function() { chan.notify({ method: "hideme" }); }
  };
})();
