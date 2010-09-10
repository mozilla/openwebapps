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

// Reference shortcut so minifier can save on characters
var win = window;

// Check for browser capabilities
var unsupported = !(win.postMessage && win.localStorage && win.JSON);

// Only process messages from the dashboard
var DashboardOrigin = "https://myapps.mozillalabs.com";

function AppConduit(appKey, conduitTargetURL) {
  this.appKey = appKey;
  this.conduitTargetURL = conduitTargetURL;
  this.iframe = null;
  this.postWindow = null;

  // All requests made before the iframe is ready are queued (referenced by
  // request id) in the requestQueue array and then called in order after
  // the iframe has messaged to us that it's ready for communication
  this.requestQueue = [];

  // Requests are done asynchronously so we add numeric ids to each
  // postMessage request object. References to the request objects
  // are stored in the openRequests object keyed by the request id.
  this.openRequests = {};
  this.requestId = 0;

}

AppConduit.prototype = {

  // Called once on first command to create the iframe to conduitTargetURL
  setupWindow: function setupWindow() {
    dump("setting up window\n");
    if(this.iframe || this.postWindow) { return; }

    // Create hidden iframe dom element
    var doc = win.document;
    this.iframe = document.createElement("iframe");
    this.iframe.style.position = "absolute";
    this.iframe.style.left = "-999px";
    this.iframe.style.top = "-999px";
    this.iframe.style.display = "none";
    dump("made the iframe\n");
    
    // Setup postMessage event listeners
    var that = this;
    if (win.addEventListener) {
      win.addEventListener('message', function(event) {dump("event1\n");that.onMessage(event);}, false);
      dump("add event listener 1\n");
    } else if(win.attachEvent) {
      win.attachEvent('onmessage', function(event) {dump("event2\n");that.onMessage(event);});
      dump("add event listener 2\n");
    }
    // Append iframe to the dom and load up target conduit inside
    doc.body.appendChild(this.iframe);
    this.iframe.src = this.conduitTargetURL;
    dump("Created conduit to " + this.conduitTargetURL + "\n");
  },

  // We will listen for messages from our target domain
  onMessage: function onMessage(event) {
    // event.origin will always be of the format scheme://hostname:port
    // http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#dom-messageevent-origin
  
    dump("got message - origin is " + event.origin + "\n");
  
    // We will only process messages from our target origin(s)
    if(this.conduitTargetURL.indexOf(event.origin) != 0) {
      dump("Mismatched conduit URL: return\n");
      return;
    }
    
    // unfreeze request message into object
    var msg = JSON.parse(event.data);
    if(!msg) {
      return;
    }

    // Check for special iframe ready message and call any pending
    // requests in our queue made before the iframe was created.
    var that = this;
    if(msg.cmd === 'conduit::ready') {
      // Cache the reference to the iframe window object
      this.postWindow = this.iframe.contentWindow;
      setTimeout(function() {that.makePendingRequests()}, 0);
      return;
    }

    // Look up saved request object and send response message to callback
    var request = this.openRequests[msg.id];
    if(request) {
      if(request.callback) {
        request.callback(msg);
      }
      delete this.openRequests[msg.id];
    }
  },

  // Called immediately after iframe has told us it's ready for communication
  makePendingRequests: function makePendingRequests() {
    dump("making pending requests\n");
    for(var i=0; i<this.requestQueue.length; i++) {
      this.makeRequest(this.openRequests[this.requestQueue.shift()]);
    }
  },

  // Post the message to the target conduit
  makeRequest: function makeRequest(requestObj) {
    dump("posting message " + JSON.stringify(requestObj) + "\n");
    this.postWindow.postMessage(JSON.stringify(requestObj), this.conduitTargetURL);
  },

  // All requests funnel thru queueRequest which assigns it a unique
  // request Id and either queues up the request before the iframe
  // is created or makes the actual request
  queueRequest: function(requestObj) {
    if(unsupported) { return; }
    requestObj.id = this.requestId;
    this.openRequests[this.requestId++] = requestObj;

    // If window isn't ready, add it to a queue
    if(!this.iframe || !this.postWindow) {
      this.requestQueue.push(requestObj.id);
      this.setupWindow(); // must happen after we've added to the queue
    } else {
      this.makeRequest(requestObj);
    }
  },
  
  //--------------------------------------------
  // BEGIN SERVICE APIS:
  //--------------------------------------------
  search: function(term, callback) {
    if (!term || !callback) return;
    
    var callbackShim = function(result) {
      callback(result.result, this.appKey);
    }
    
    var requestObj = {
      cmd: 'conduit::search',
      term: term,
      callback: callbackShim
    }
    this.queueRequest(requestObj);
  }
}
