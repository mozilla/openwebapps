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

;(function() {
	// Reference shortcut so minifier can save on characters
	var win = window;

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
	
  function applicationMatchesURL(application, url)
  {
    // TODO look into optimizing this so we are not constructing
    // regexps over and over again, but make sure it works in IE
    for (var i=0;i<application.app.urls.length;i++)
    {
      var testURL = application.app.urls[i];
      var re = RegExp("^" + testURL.replace("*", ".*") + "$");
      if (re.exec(url) != null) return true;
    }
    return false;
  }
  
  function getApplicationsForOrigin(origin)
  {
    var result = [];
    var toRemove = [];
    
    for (var i =0;i<storage.length;i++)
    {
      var key = localStorage.key(i);
      var item = localStorage.getItem(key);
      var install = JSON.parse(item);

      // Clean up out-of-date tickets as we go
      if (install.app.expiration && new Date(install.app.expiration) < new Date())
      {
        toRemove.push(key);
      }
      else if (applicationMatchesURL(install.app, origin))
      {      
        result.push(install.app);
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
			if(!requestObj.manifest) {
				logError(requestObj, 'Invalid request: missing manifest', originHostname);
				return null;
			}
      var manf = requestObj.manifest;

      if (manf.expiration) {
        var numericValue = Number(manf.expiration); // Cast to numeric timestamp
        var dateCheck = new Date(numericValue);
        if(dateCheck < new Date()) { // If you pass garbage into the date, this will be false
          logError(requestObj, 'Invalid request: malformed expiration (' + manf.expiration + '; ' + dateCheck + ')', originHostname);
          return null;
        }
        manf.expiration = numericValue;
      }
      if (!manf.name) {
        logError(requestObj, 'Invalid request: missing application name', originHostname);
        return null;
      }
      if (!manf.app) {
        logError(requestObj, 'Invalid request: missing "app" property', originHostname);
        return null;
      }
      if (!manf.app.urls) {
        logError(requestObj, 'Invalid request: missing "urls" property of "app"', originHostname);
        return null;
      }
      if (!manf.app.launch) {
        logError(requestObj, 'Invalid request: missing "launch" property of "app"', originHostname);
        return null;
      }
      // Launch URL must be part of the set of app.urls
      // TODO perform check
      
      var key = manf.app.launch.web_url;

			// Create installation data structure
			var installation = {
				app: manf,
        installTime: new Date().getTime(),
        installURL: origin
			}
			// Save - blow away any existing value
			storage.setItem(key, JSON.stringify(installation));
		
			// Send Response Object
			return {
				cmd: requestObj.cmd,
				id: requestObj.id
			};
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
      // If we find one, we will initiate verification of the userid
      // by contacting the identity server defined in the manifest.

      // If we find two... well, for now, we take the first one.

      var result = getApplicationsForOrigin(origin);      
      if (result.length == 0) return null;

      var install = result[0];
      var app = install.app;
      
      // Must have userid and identity
      if (app.userid == null || app.identityprovider == null)
      {
        return null;
      }
      
      // TODO Could optionally have a returnto
      var validationURL = app.identityprovider + "?openid.returnto=" + origin + "&openid.claimedid=" + app.userid;
      win.parent.location = validationURL;

			return {
				cmd: requestObj.cmd,
				id: requestObj.id
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
      var result = getApplicationsForOrigin(origin); 
      return {
        cmd: requestObj.cmd,
        id: requestObj.id,
        installed: result
      };
    }
	}

	/**
		help with debugging issues
		We can eventually toggle this using a debug.wamwallet.org store
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
	
	// Dynamically called since the user can open up xauth.org and disable
	// the entire thing while another browser tab has an xauth.org iframe open
	function checkDisabled() {
		return (storage.getItem('disabled.myapps.org') == '1');
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

})();