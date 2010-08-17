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
	First version of wallet server code
	-Michael Hanson. Mozilla
**/

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
	
	// To allow for session-based wallet tickets (tickets that expire immediately
	// after the browser session ends), we piggyback off of traditional
	// browser cookies. This cookie is set the first time the wallet is loaded
	// and any session-based tickets will be marked with this unique
	// key. The next time the browser is started, a new unique key is created
	// thereby invalidating any previous session-based tickets
	var currentSession = null;
	var match = document.cookie.match(/(?:^|;)\s*session=(\d+)(?:;|$)/);
	if (match && match.length) {
		currentSession = match[1];
	}
	if(!currentSession) {
		currentSession = new Date().getTime();
		document.cookie = ('session=' + currentSession + "; ");
	}
	
	// Set up the API
	var WalletAPI = {
		/**
		Request object will look like:
		{
			cmd:'wallet::install',
			id:1,
			ticket:TICKET_DATA,
			expire: JS date timestamp number,
			session: true or false boolean indicating if this ticket is browser-session based
		}
		**/
	
		'wallet::install': function(originHostname, requestObj) {
    
      //dump("Wallet Install: " + JSON.stringify(requestObj) + "\n");
		
			// Validate and clean token
			if(!requestObj.ticket) {
				logError(requestObj, 'Invalid request', originHostname);
				return null;
			}

			// Validate date
			requestObj.expire = Number(requestObj.expire); // Cast to numeric timestamp
			var dateCheck = new Date(requestObj.expire);
			if(dateCheck < new Date()) { // If you pass garbage into the date, this will be false
				logError(requestObj, 'Invalid Expiration', originHostname);
				return null;
			}
      
      // Validate ticket
      if (!requestObj.ticket.user) {
        logError(requestObj, 'Invalid ticket: missing user', originHostname);
        return null;
      }
      if (!requestObj.ticket.server) {
        logError(requestObj, 'Invalid ticket: missing server', originHostname);
        return null;
      }
      if (!requestObj.ticket.domain) {
        logError(requestObj, 'Invalid ticket: missing domain', originHostname);
        return null;
      }
      var domain = requestObj.ticket.domain;

			// Create installation data structure
			var installation = {
				ticket: requestObj.ticket,
			}
			
			// Check if this is requesting to be a session based installation
			if(requestObj.session === true) {
				installation.session = currentSession; // We check this on retrieve
			}
		
      // See if we already have an entry for this domain.
      // If we do, we'll concatenate.
      var currentValueStr = storage.getItem(domain);
      var newValue;
      if (currentValueStr) {
        var currentValue = JSON.parse(currentValueStr);
        
        // TODO check for too-long values
        currentValue.push(installation);
        newValue = JSON.stringify(currentValue);
      } else {
        // create new list for value
        newValue = JSON.stringify( [ installation ] );
      }
      
			// Save
			storage.setItem(domain, newValue);
		
      //dump("Wallet Install: setting " + domain + " to " + newValue + "\n");

    
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
		'wallet::verify': function(originHostname, requestObj) {
    
      // We will look for tickets whose domain matches the origin hostname.
      // If we find one, we will initiate verification of the ticket
      // by contacting the store defined in the ticket.
      
      // (Note that if we find more than one, we ignore everything but the
      // first for now).
      
      //dump("wallet::verify " + originHostname + "\n");
      
      var installList = storage.getItem(originHostname);
      if (!installList) {
        return null;
      }
      installList = JSON.parse(installList);
      
      // Clean up expired or previous-session tickets now
      var ticket;
      for (var i=installList.length-1;i>=0;i--) {
        var install = installList[i];
        if (install.session && install.session != currentSession) {
          //dump("wallet::verify removing install " + JSON.stringify(install) + " because session has expired.\n");
          installList.splice(i, 1);
        } else {
          var dateCheck = new Date(install.ticket.expire);
          if (dateCheck < new Date()) {
            //dump("wallet::verify removing install " + JSON.stringify(install) + " because install has expired.\n");
            installList.splice(i, 1); // expired
          }
        }
      }
      // Nothing left?  Cleanup and return
      if (installList.length == 0) {
        storage.removeItem(originHostname);
        return null;
      }

      //dump("wallet::verify found installations: " + JSON.stringify(installList) + "\n");

      // Otherwise take the first one (for now)
      var install = installList[0];
      var ticket = install.ticket;
      
      // Ticket contains user and server fields
      var server = ticket.server;
      
      // TODO: Needs a nonce generated by the site
      // TODO: Should require SSL
      if (server) {
        //dump("Redirecting to " + validationURL + "\n");
        var validationURL = server + "/verify?app=" + ticket.app + "&user=" + 
          ticket.user + "&domain=" + originHostname;

        // Someday: Cool background validation here
        win.parent.location = validationURL;
      } // else report error
      
			return {
				cmd: requestObj.cmd,
				id: requestObj.id
			};
		},

		/**
		Request object will look like:
		{
			cmd:'wallet::check',
			id:1
		}
		**/
		'wallet::check': function(originHostname, requestObj) {
      
      // We will look for tickets whose store matches the origin hostname,
      // and whose domain matches the "domain" parameter.
      // If we find one, we return success.
      // (Note that if we find more than one, we ignore everything but the
      // first for now).
      var installList = storage.getItem(requestObj.domain);
      var ret = {
        cmd: requestObj.cmd,
        id: requestObj.id,
        result: false
      };

      if (!installList) {
        return ret;
      }
      installList = JSON.parse(installList);
      
      // Clean up expired or previous-session tickets now
      var ticket;
      for (var i=installList.length-1;i>=0;i--) {
        var install = installList[i];
        if (install.session && install.session != currentSession) {
          installList.splice(i, 1);
        } else {
          var dateCheck = new Date(install.ticket.expire);
          if (dateCheck < new Date()) {
            installList.splice(i, 1); // expired
          }
        }
      }
      // Nothing left?  Cleanup and return
      if (installList.length == 0) {
        storage.removeItem(originHostname);
        return ret;
      }
      
      // Check for stores that match the origin hostname
      for (var i=0;i<installList.length;i++)
      {
        var install = installList[i];
        var ticket = install.ticket;
        var server = ticket.server;

        // NB TODO this assumes http, which is wrong.
        if (server == "http://" + originHostname) {
          ret.result = true;
          return ret;
        }
      }
      return ret;
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
		return (storage.getItem('disabled.xauth.org') == '1');
	}
	
	// Listener for window message events, receives messages from parent window
	function onMessage(event) {
		// event.origin will always be of the format scheme://hostname:port
		// http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#dom-messageevent-origin
		var originHostname = event.origin.split('://')[1].split(':')[0],
			requestObj = JSON.parse(event.data);

		/**
		message generally looks like
		{
			cmd: xauth::command_name,
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
			sendResponse(WalletAPI[requestObj.cmd](originHostname, requestObj), event.origin);
		}
	}

	// Setup postMessage event listeners
	if (win.addEventListener) {
		win.addEventListener('message', onMessage, false);
	} else if(win.attachEvent) {
		win.attachEvent('onmessage', onMessage);
	}

	// Finally, tell the parent window we're ready.
  dump("Posting ready\n");
	win.parent.postMessage(JSON.stringify({cmd: 'wallet::ready'}),"*");

})();