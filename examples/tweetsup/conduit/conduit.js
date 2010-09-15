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
 * The Original Code is AppConduit; substantial portions derived
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

;ConduitBridge = (function() {
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

  // Set up the API
  var ConduitAPI = {

    /**
    Request object will look like:
    {
      cmd:'conduit::search',
      id:1,
      term: <TERM>
    }
    **/
    'conduit::search': function(originHostname, requestObj, origin) {
      console.log("searching for: " + requestObj.term);
      var r = {
	title: 'search results',
	results: [ ]
      };

      Search.run(requestObj.term, function(t) {
	var user = t.user ? t.user : t.sender;
	var link = "http://twitter.com/" + user.screen_name + "/status/" + t.id;
	r.results.push({
	  link: link,
	  title: user.screen_name + ": " + t.text.substr(0,40) + "...",
	  summary: t.text,
	  updated: t.created_at
	});
      }, function (res) {
	console.log(res);
	sendResponse({
	  result: r,
	  cmd: requestObj.cmd,
	  id: requestObj.id
	}, origin);
      });
    },

  /**
    Request object will look like:
    {
      cmd:'conduit::notifications',
      id:1,
      term: <TERM>
    }
    **/
    'conduit::notifications': function(originHostname, requestObj, origin) {
      // TODO check origin to make sure it's one we feel good about
      // TODO authenticate user somehow?  we'll get the user's cookie if they have a session already.
      // TODO: implement
    }

    // other APIs go here...
  }

  /**
    help with debugging issues
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

    try {
    var requestObj = JSON.parse(event.data);
    var originHostname = event.origin.split('://')[1].split(':')[0];

    /**
    message generally looks like
    {
      cmd: conduit::command_name,
      id: request_id,
      other parameters
    }
    **/

    if(!requestObj || typeof requestObj != 'object'
      || !requestObj.cmd || requestObj.id == undefined)
    {
      // A post message we don't understand
      return;
    }

    if(ConduitAPI[requestObj.cmd]) {
      // A command we understand, send the response on back to the posting window
      var result = ConduitAPI[requestObj.cmd](originHostname, requestObj, event.origin);
      sendResponse(result, event.origin);
    }
    } catch (e) {
    }
  }

  // Setup postMessage event listeners
  if (win.addEventListener) {
    win.addEventListener('message', onMessage, false);
  } else if(win.attachEvent) {
    win.attachEvent('onmessage', onMessage);
  }

  // Finally, tell the parent window we're ready.
  win.parent.postMessage(JSON.stringify({cmd: 'conduit::ready'}),"*");
})();