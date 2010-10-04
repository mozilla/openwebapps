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
 * The Original Code is Wallet; substantial portions derived
 * from XAuth code originally produced by Meebo, Inc., and provided
 * under the Apache License, Version 2.0; see http://github.com/xauth/xauth
 *
 * Contributor(s):
 *   Michael Hanson <mhanson@mozilla.com>
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

;ClientBridge = (function() {
  // Reference shortcut so minifier can save on characters
  var win = window;

  // when we recieve an install message we'll cache the origin
  // so we can instruct the client on how to handle visibility
  var installOrigin;

  // We're the top window, don't do anything
  if(win.top == win) {
    return;
  }

  // unsupported browser
  if(!win.postMessage || !win.localStorage || !win.JSON) {
    return;
  }

  // Reference shortcut so minifier can save on characters
  var storage = win.localStorage;
  
  // Returns whether this application runs in the specified domain (scheme://hostname[:nonStandardPort])
  function applicationMatchesDomain(application, domain)
  {
    // TODO look into optimizing this so we are not constructing
    // regexps over and over again, but make sure it works in IE
    for (var i=0;i<application.app.urls.length;i++)
    {
      var testURL = application.app.urls[i];
      
      try {
        var splitOne = testURL.split("://")
        var splitTwo = splitOne[1].split("/")
        var testDomain = splitOne[0] + "://" + splitTwo[0];
        if (testDomain == domain) return true;
      } catch (e) {
      }
      // var re = RegExp("^" + testURL.replace("*", ".*"));// no trailing $
      // if (re.exec(url) != null) return true;
    }
    return false;
  }
  
  function getApplicationsForOrigin(originHostname, requestObj, origin)
  {
    var result = [];
    var toRemove = [];

    for (var i =0;i<storage.length;i++)
    {
      var key = localStorage.key(i);
      var item = localStorage.getItem(key);
      try {
        // validate the manifest
        var install = JSON.parse(item);
        install.app = Manifest.validate(install.app);

        // Clean up out-of-date tickets as we go
        if (Manifest.expired(install.app)) {
          throw "application has expired";
        }

        if (applicationMatchesDomain(install.app, origin)) {      
          result.push(install.app);
        }

      } catch(e) {
        logError(requestObj, 'Purging application: ' + e, originHostname);        
        toRemove.push(key);
      }
    }

    // Clean up
    if (toRemove.length > 0) {
      for (var i=0;i<toRemove.length;i++) {
        storage.removeItem(toRemove[i]);
      }
    }

    return result;
  }
  
  // Set up the API
  var WalletAPI = {
    /**
    Request object will look like:
    {
      cmd:'wallet::install',
      id:1,
      manifest: MANIFEST_DATA,
      expire: JS date timestamp number,
    }
    **/
  
    'wallet::install': function(originHostname, requestObj, origin) {
      // Validate and clean the request
      var manf;
      try {
        manf = Manifest.validate(requestObj.manifest);
      } catch(e) {
        logError(requestObj, e, originHostname);
        return null;
      }

      // cache the installOrigin
      installOrigin = origin;

      // cause the UI to display a prompt to the user
      displayInstallPrompt(originHostname, manf, function (allowed) {
        if (allowed) {
          var key = manf.app.launch.web_url;

          // Create installation data structure
          var installation = {
            app: manf,
            installTime: new Date().getTime(),
            installURL: origin
          }

          if (requestObj.authorization_url) {
            installation.authorizationURL = requestObj.authorization_url;
          }

          // Save - blow away any existing value
          storage.setItem(key, JSON.stringify(installation));
          
          // Send Response Object
          sendResponse({
            cmd: requestObj.cmd,
            id: requestObj.id
          }, origin);
        } else {
          logError(requestObj, 'User denied installation request', originHostname);
        }
      });
    },

    /**
    Request object will look like:
    {
      cmd:'wallet::verify',
      id:1
    }
    **/
    'wallet::verify': function(originHostname, requestObj, origin) {

      // We will look for manifests whose app.url filter matches the origin.
      // If we find one, we will initiate verification of the user
      // by contacting the identity server defined in the manifest.

      // If we find two... well, for now, we take the first one.
      // Perhaps we should find the first one that has an authorization URL.

      logError(requestObj, 'In the verify method', originHostname);

      var result = getApplicationsForOrigin(originHostname, requestObj, origin);      

      logError(requestObj, 'Found application list ' + result.length, originHostname);

      if (result.length == 0) return null;

      var install = result[0];
      logError(requestObj, 'Found install ' + JSON.stringify(install), originHostname);
      
      // Must have authorizationURL
      if (!install.authorizationURL)
      {
        logError(requestObj, 'No authorization URL', originHostname);
        return null;
      }
      
      // TODO Could optionally have a returnto
      // win.parent.location = install.authorizationURL;

      return {
        cmd: requestObj.cmd,
        id: requestObj.id,
        target: install.authorizationURL
      };
    },

    /**
    Determines which applications are installed for the origin domain.
    
    Request object will look like:
    {
      cmd:'wallet::getInstalled',
      id:1
    }
    **/
    'wallet::getInstalled': function(originHostname, requestObj, origin) {
      //dump("TRACE wallet::getInstalled\n");
      var result = getApplicationsForOrigin(originHostname, requestObj, origin);
      return {
        cmd: requestObj.cmd,
        id: requestObj.id,
        installed: result
      };
    }
  }

  /**
    help with debugging issues
    We can eventually toggle this using a debug.myapps.org store
  **/
  function logError(requestObj, message, originHostname) {
    if (dump) dump(message + "\n");
    if(!requestObj || (typeof requestObj.id != 'number') ) {
      return;
    }
    if(win.console && win.console.log) {
      win.console.log(requestObj.cmd + ' Error: ' + message);
    }
  }
  
  // Make sure response message has an id and send it on to parent window
  // origin is the URI of the window we're postMessaging to
  function sendResponse(responseObj, origin) {
    if(!responseObj || (typeof responseObj.id != 'number') ) {
      return;
    }
    win.parent.postMessage(JSON.stringify(responseObj), origin);
  }
  
  // Dynamically called since the user can open up xauth.org and disable
  // the entire thing while another browser tab has an xauth.org iframe open
  function checkDisabled() {
    return (storage.getItem('disabled.myapps.org') == '1');
  }
  
  // Listener for window message events, receives messages from parent window
  function onMessage(event) {
    // event.origin will always be of the format scheme://hostname:port
    // http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#dom-messageevent-origin

    //dump("TRACE onMessage\n");
    var requestObj = JSON.parse(event.data);
    var originHostname = event.origin.split('://')[1].split(':')[0];

    /**
    message generally looks like
    {
      cmd: wallet::command_name,
      id: request_id,
      other parameters
    }
    **/

    if(!requestObj || typeof requestObj != 'object' 
      || !requestObj.cmd || requestObj.id == undefined
      || checkDisabled()) {
      // A post message we don't understand
      return;
    }
    
    if(WalletAPI[requestObj.cmd]) {
      // A command we understand, send the response on back to the posting window
      var result = WalletAPI[requestObj.cmd](originHostname, requestObj, event.origin);
      sendResponse(result, event.origin);
    }
  }

  // Setup postMessage event listeners
  if (win.addEventListener) {
    win.addEventListener('message', onMessage, false);
  } else if(win.attachEvent) {
    win.attachEvent('onmessage', onMessage);
  }

  // Finally, tell the parent window we're ready.
 // dump("Posting ready\n");
  win.parent.postMessage(JSON.stringify({cmd: 'wallet::ready'}),"*");

  return {
    showDialog: function() { sendResponse( { id: -1, cmd: "wallet::showme" }, installOrigin); },
    hideDialog: function() { sendResponse( { id: -1, cmd: "wallet::hideme" }, installOrigin); }
  }
})();