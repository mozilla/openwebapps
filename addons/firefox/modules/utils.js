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
 * The Original Code is Open Web Apps for Firefox.
 *
 * The Initial Developer of the Original Code is The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Ben Adida <benadida@mozilla.com>
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
 
const Cu = Components.utils;
const Cc = Components.classes;
const Ci = Components.interfaces;

const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

utils = (function() {
    // expects a top-level XUL window into from which an IFRAME can be created
    // on_ready fires when the iframe is ready to go, with params:
    // - iframe object
    // - messagechannel to post messages to
    //
    // by default, this is an invisible iframe
    function create_iframe(win, url, on_ready, on_error) {
        let doc = win.document;
        let frame = doc.createElementNS(XUL_NS, "iframe");
        frame.setAttribute("type", "content");
        frame.setAttribute("collapsed", true);
        frame.setAttribute("src",url);

        // add a close function
        frame.close = function() {
            dump("closing");
            win.document.documentElement.removeChild(frame);
        };

        let ready_fired_p = false;
        frame.addEventListener("DOMContentLoaded", function(event) {
            if (event.target.location == url)
                on_ready(frame, null);
            ready_fired_p = true;
        }, true);

        doc.documentElement.appendChild(frame);
    }

    return {
        create_iframe: create_iframe,
    };
})();;

var EXPORTED_SYMBOLS = ["utils"];

