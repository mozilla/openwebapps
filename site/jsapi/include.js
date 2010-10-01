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
  First version of wallet client code
  -Michael Hanson. Mozilla
**/

var AppClient = (function() {
  // Reference shortcut so minifier can save on characters
  var win = window;

  // Check for browser capabilities
  var unsupported = !(win.postMessage && win.localStorage && win.JSON);
  
  // TODO: https support. Needs CDN to have a proper cert
  var WalletOrigin = "https://myapps.mozillalabs.com";
  var WalletServerUrl = WalletOrigin + "/jsapi/include.html";

  // Cached references
  var iframe = null;
  var postWindow = null;

  // Requests are done asynchronously so we add numeric ids to each
  // postMessage request object. References to the request objects
  // are stored in the openRequests object keyed by the request id.
  var openRequests = {};
  var requestId = 0;

  // All requests made before the iframe is ready are queued (referenced by
  // request id) in the requestQueue array and then called in order after
  // the iframe has messaged to us that it's ready for communication
  var requestQueue = [];

  // Listener for window message events, receives messages from only
  // the wallet host:port that we set up in the iframe
  function onMessage(event) {
    // event.origin will always be of the format scheme://hostname:port
    // http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#dom-messageevent-origin

    if(event.origin != WalletOrigin) {
      // Doesn't match https://myapps.mozillalabs.com, reject
      return;
    }
    
    // unfreeze request message into object
    var msg = JSON.parse(event.data);
    if(!msg) {
      return;
    }

    // Check for special iframe ready message and call any pending
    // requests in our queue made before the iframe was created.
    if(msg.cmd === 'wallet::ready') {
      // Cache the reference to the iframe window object
      postWindow = iframe.contentWindow;
      setTimeout(makePendingRequests, 0);
      return;
    }
    // Check for special iframe requests to become visible/hidden and
    // do the right thing.
    else if(msg.cmd === 'wallet::showme') {
      // Cache the reference to the iframe window object
      showInstallDialog();
      return;
    }
    else if(msg.cmd === 'wallet::hideme') {
      // Cache the reference to the iframe window object
      hideInstallDialog();
      return;
    }

    // Look up saved request object and send response message to callback
    var request = openRequests[msg.id];
    if(request) {
      if(request.callback) {
        request.callback(msg);
      }
      delete openRequests[msg.id];
    }
  }

  var overlayId = "myappsOrgInstallOverlay";
  var dialogId = "myappsTrustedIFrame";

  function showInstallDialog() {
    try { hideInstallDialog() } catch(e) { };
    // create a opacity overlay to focus the users attention 
    var od = document.createElement("div");
    od.id = overlayId;
    od.style.background = "#000";
    od.style.opacity = ".66";
    od.style.filter = "alpha(opacity=66)";
    od.style.position = "fixed";
    od.style.top = "0";
    od.style.left = "0";
    od.style.height = "100%";
    od.style.width = "100%";
    od.style.zIndex ="998";
    document.body.appendChild(od);
    document.getElementById(dialogId).style.display = "inline";
  }

  function hideInstallDialog() {
    document.getElementById(dialogId).style.display = "none";
    document.body.removeChild(document.getElementById(overlayId));
  }

  // Called once on first command to create the iframe to myapps.mozillalabs.com
  function setupWindow() {
    if(iframe || postWindow) { return; }

    // Create hidden iframe dom element
    var doc = win.document;
    iframe = document.createElement("iframe");
    iframe.id = dialogId;
    iframe.style.position = "absolute";
    iframe.style.left = "200px";
    iframe.style.top = "100px";
    iframe.style.width = "400px";
    iframe.style.height = "250px";
    iframe.style.zIndex ="999";
    iframe.style.opacity = "1";
    iframe.style.border = "0";
    iframe.style.MozBorderRadius = "8px";
    iframe.style.WebkitBorderRadius = "8px";
    iframe.style.borderRadius = "8px";
    iframe.style.border = "8px solid black";

    // the "hidden" part
    iframe.style.display = "none";

    // Setup postMessage event listeners
    if (win.addEventListener) {
      //dump("Setting event listener\n");
      win.addEventListener('message', onMessage, false);
    } else if(win.attachEvent) {
      win.attachEvent('onmessage', onMessage);
    }
    // Append iframe to the dom and load up myapps.mozillalabs.com inside
    doc.body.appendChild(iframe);
    iframe.src = WalletServerUrl;
  }
  
  // Called immediately after iframe has told us it's ready for communication
  function makePendingRequests() {
    for(var i=0; i<requestQueue.length; i++) {
      makeRequest(openRequests[requestQueue.shift()]);
    }
  }

  // Simple wrapper for the postMessage command that sends serialized requests
  // to the myapps.mozillalabs.com iframe window
  function makeRequest(requestObj) {
    //dump("postMessage: " + JSON.stringify(requestObj) + "\n");
    postWindow.postMessage(JSON.stringify(requestObj), WalletServerUrl);
  }

  // All requests funnel thru queueRequest which assigns it a unique
  // request Id and either queues up the request before the iframe
  // is created or makes the actual request
  function queueRequest(requestObj) {
    if(unsupported) { return; }
    requestObj.id = requestId;
    openRequests[requestId++] = requestObj;

    // If window isn't ready, add it to a queue
    if(!iframe || !postWindow) {
      requestQueue.push(requestObj.id);
      setupWindow(); // must happen after we've added to the queue
    } else {
      makeRequest(requestObj);
    }
  }
  
  // Following three functions are just API wrappers that clean up the
  // the arguments passed in before they're sent and attach the
  // appropriate command strings to the request objects
  function callInstall(args) {
    if(!args) { args = {}; }
    var requestObj = {
      cmd: 'wallet::install',
      manifest: args.manifest || {},
      authorization_url: args.authorization_url || null,
      session: args.session || false,
      callback: args.callback || null
    }
    queueRequest(requestObj);
  }
  
  function callVerify(args) {
    if(!args) { args = {}; }
    var requestObj = {
      cmd: 'wallet::verify',
      callback: args.callback || null
    }
    queueRequest(requestObj);
  }

  function callGetInstalled(args) {
    if(!args) { args = {}; }
    var requestObj = {
      cmd: 'wallet::getInstalled',
      callback: args.callback || null
    }
    queueRequest(requestObj);
  }

  // Return AppClient object with exposed API calls
  return {
    install: callInstall,
    verify: callVerify,
    getInstalled: callGetInstalled
  };
})();
