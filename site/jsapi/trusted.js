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
  
  // Returns whether the given URL belongs to the specified domain (scheme://hostname[:nonStandardPort])
  function urlMatchesDomain(url, domain)
  {
    try {
      var parsedDomain = Manifest.parseUri(domain);
      var parsedURL = Manifest.parseUri(url);
    
      if (parsedDomain.protocol.toLowerCase() == parsedURL.protocol.toLowerCase() &&
        parsedDomain.host.toLowerCase() == parsedURL.host.toLowerCase())
      {
        var inputPort = parsedDomain.port ? parsedDomain.port : (parsedDomain.protocol.toLowerCase() == "https" ? 443 : 80);
        var testPort = parsedURL.port ? parsedURL.port : (parsedURL.protocol.toLowerCase() == "https" ? 443 : 80);        
        if (inputPort == testPort) return true;
      }
    } catch (e) {
    }
    return false;  
  }
  
  // Returns whether this application runs in the specified domain (scheme://hostname[:nonStandardPort])
  function applicationMatchesDomain(application, domain)
  {
    for (var i=0;i<application.app_urls.length;i++)
    {
      var testURL = application.app_urls[i];
      if (urlMatchesDomain(testURL, domain)) return true;
    }
    return false;
  }
  
  // Return all installations that belong to the given origin domain
  function getInstallsForOrigin(originHostname, requestObj, origin)
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

        if (applicationMatchesDomain(install.app, origin)) {      
          result.push(install);
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
  
  // Return all installations that were installed by the given origin domain 
  function getInstallsByOrigin(originHostname, requestObj, origin)
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

        if (urlMatchesDomain(install.installURL, origin)) {
          result.push(install);
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
  var AppAPI = {
    /**
    Request object will look like:
    {
      cmd:'app::install',
      id:1,
      manifest: MANIFEST_DATA,
      expire: JS date timestamp number,
    }
    **/
  
    'app::install': function(originHostname, requestObj, origin) {
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
          var key = manf.base_url;

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
      cmd:'app::verify',
      id:1
    }
    **/
    'app::verify': function(originHostname, requestObj, origin) {

      // We will look for manifests whose app_urls filter matches the origin.
      // If we find one, we will initiate verification of the user
      // by contacting the authorizationURL defined in the installation record.

      // If we find two... well, for now, we take the first one.
      // Perhaps we should find the first one that has an authorization URL.

      var result = getInstallsForOrigin(originHostname, requestObj, origin);      
      if (result.length == 0) return null;
      var install = result[0];
      
      // Must have authorizationURL
      if (!install.authorizationURL)
      {
        return null;
      }
      
      // TODO Could optionally have a returnto
      win.parent.location = install.authorizationURL;

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
      cmd:'app::getInstalled',
      id:1
    }
    **/
    'app::getInstalled': function(originHostname, requestObj, origin) {
      var installsResult = getInstallsForOrigin(originHostname, requestObj, origin);

      // Caller doesn't get to see installs, just apps:
      var result = [];
      for (var i=0;i<installsResult.length;i++)
      {
        result.push(installsResult[i].app);
      }
      
      return {
        cmd: requestObj.cmd,
        id: requestObj.id,
        installed: result
      };
    },
    
    /**
    Determines which applications were installed by the origin domain.
    
    Request object will look like:
    {
      cmd:'app::getInstalledBy',
      id:1
    }
    
    Response object will look like:
    {
      id:1,
      installs: [
        {
          installURL: 'http://something',
          installTime: 1286222924782, // return from new Date().getTime()
          manifest: {
            <a manifest>
          }
        },
        (more installs)
      ]
    }
    **/
    'app::getInstalledBy': function(originHostname, requestObj, origin) {
      var installsResult = getInstallsByOrigin(originHostname, requestObj, origin);

      // Caller gets to see installURL, installTime, and manifest
      var result = [];
      for (var i=0;i<installsResult.length;i++)
      {
        result.push({
          installURL: installsResult[i].installURL,
          installTime: installsResult[i].installTime,
          manifest: installsResult[i].app,
        });
      }
      
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
  
  // Listener for window message events, receives messages from parent window
  function onMessage(event) {
    // event.origin will always be of the format scheme://hostname:port
    // http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#dom-messageevent-origin

    var requestObj = JSON.parse(event.data);
    var originHostname = event.origin.split('://')[1].split(':')[0];

    /**
    message generally looks like
    {
      cmd: app::command_name,
      id: request_id,
      other parameters
    }
    **/

    if(!requestObj || typeof requestObj != 'object' 
      || !requestObj.cmd || requestObj.id == undefined
    ) {
      // A post message we don't understand
      return;
    }
    
    if(AppAPI[requestObj.cmd]) {
      // A command we understand, send the response on back to the posting window
      var result = AppAPI[requestObj.cmd](originHostname, requestObj, event.origin);
      sendResponse(result, event.origin);
    } else {
      logError(requestObj, "Unknown AppClient call " + requestObj.cmd, originHostname); 
    }
  }

  // Setup postMessage event listeners
  if (win.addEventListener) {
    win.addEventListener('message', onMessage, false);
  } else if(win.attachEvent) {
    win.attachEvent('onmessage', onMessage);
  }

  // Finally, tell the parent window we're ready.
  win.parent.postMessage(JSON.stringify({cmd: 'app::ready'}),"*");

  return {
    showDialog: function() { sendResponse( { id: -1, cmd: "app::showme" }, installOrigin); },
    hideDialog: function() { sendResponse( { id: -1, cmd: "app::hideme" }, installOrigin); }
  }
})();