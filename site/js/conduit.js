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
 *   Lloyd Hilaiel <lloyd@mozilla.com>
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

function AppConduit(appKey, conduitTargetURL) {
    console.log("AppConduit called (" + appKey + " | " + conduitTargetURL + ")");

    this.appKey = appKey;

    // First, we'll create an iframe
    var doc = win.document;
    this.iframe = document.createElement("iframe");
    this.iframe.style.position = "absolute";
    this.iframe.style.left = "-999px";
    this.iframe.style.top = "-999px";
    this.iframe.style.display = "none";

    // Append iframe to the dom and load up target conduit inside
    doc.body.appendChild(this.iframe);
    this.iframe.src = this.conduitTargetURL;

    // now create a Channel
    this.chan = Channel.build(this.iframe.contentWindow, conduitTargetURL, "conduit");
}

AppConduit.prototype = {
    destroy: function destroy() {
        if (this.chan) {
            this.chan.destroy();
            delete this.chan;
        }
        if (this.iframe) {
            win.document.body.removeChild(this.iframe);
            delete this.iframe;
        }
    },


    //--------------------------------------------
    // BEGIN SERVICE APIS:
    //--------------------------------------------
    search: function(term, callback) {
        if (!term || !callback) return;

        this.chan.query({
            method: "search",
            params: {
                term: term,
                results: function(r) {
                    dump("incremental search results: " + JSON.stringify(r));
                }
            },
            error: function(e) {
                dump("GOT ERROR from search query: " + JSON.stringify(e));
            },
            success: function(result) {
                callback(result.result, this.appKey);
            }
        });
    },


    notifications: function(callback) { // maybe "since"?
        dump("XXX: write me");  
    }
}


function ConduitDebugger(outputDiv) {
  this.outputDiv = outputDiv;
}

ConduitDebugger.prototype = {
  record: function(conduit, message, isResponse) {
      dump("XXX: [record] write me");  

    this.messages.push({time:new Date(), message: message, conduit:conduit, response:isResponse});

/*  if (this.timer) window.clearTimeout(this.timer);
    this.timer = */
    var that = this;
    window.setTimeout(function() {that.render()}, 0); 
  },
  
  render: function() {
      dump("XXX: [render] write me");  
      return;
    function zf(v) {
      if (v < 10) return "0" + v;
      return v;
    }

    function col(t, v) {
      var column = document.createElement("div");
      column.setAttribute("class", t);
      column.appendChild(document.createTextNode(v));
      return column;
    }
  
    this.outputDiv.innerHTML = "";
    for (var i=0;i<this.messages.length;i++) {
      var msg = this.messages[i];
      var aDiv = document.createElement("div");
      aDiv.setAttribute("class", "dbgrow");
      aDiv.appendChild(col("time", msg.time.getHours() + ":" + zf(msg.time.getMinutes()) + ":" + zf(msg.time.getSeconds())));
      aDiv.appendChild(col("app", gApps.getInstall(msg.conduit.appKey).app.name));
      
      var aHover = document.createElement("div");
      aHover.setAttribute("class", "detail");
      aHover.appendChild(document.createTextNode(JSON.stringify(msg.message)));
      aDiv.appendChild(aHover);

      aDiv.appendChild(col("msg", msg.message.cmd + (msg.response ? " response" : "")));
      this.outputDiv.appendChild(aDiv);
    }
  }
}
var gDebugger;
if (document.getElementById("debugger")) {
  gDebugger = new ConduitDebugger(document.getElementById("debugger"));
}