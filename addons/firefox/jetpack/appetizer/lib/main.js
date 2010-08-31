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
 * The Original Code is Apps.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
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

var self = require("self");
var panels = require("panel");
var tabs = require("tabs");
var tabBrowser = require("tab-browser");
var windowUtils = require("window-utils");
var apps = require("apps");
var {Cc, Ci, Cu} = require("chrome");

exports.main = function(options, callbacks) {
  // Don't need to quit right away: no callbacks.quit();
  apps.init();
  registerCustomAppsProtocol();
  tabs.open({
    url: self.data.url("apps://apps/dashboard.html")
  });
}
exports.unload = function(reason)
{
  apps.unload();
}

const APPS_PROTOCOL = "apps";
const APPS_HOST = "apps";
const APPS_URL = APPS_PROTOCOL + "://" + APPS_HOST + "/dashboard.html";
// TODO: We want to localize this string.
const APPS_TITLE = "Cuddlefish Lab";


function injectLabVars(window) {
  window.wrappedJSObject.packaging = packaging;
}

function registerCustomAppsProtocol()
{
  var protocol = require("custom-protocol").register(APPS_PROTOCOL);

  // TODO: Eventually we want to have this protocol not run
  // as the system principal.
  protocol.setHost(APPS_HOST, packaging.getURLForData("/"), "system");

  var openLab;

/*  if (tabBrowser.isAppSupported()) {
    tabBrowser.whenContentLoaded(function(window) {
      if (window.location == APPS_URL) {
      injectLabVars(window);
      require("window-utils").closeOnUnload(window);
      }
    });
    openLab = function openLabInTab() {
      tabBrowser.addTab(APPS_URL);
    };
  } else*/
    openLab = function openLabInWindow() {
      var contentWindow = require("content-window");
      var window = new contentWindow.Window({url: APPS_URL,
                                             width: 800,
                                             height: 600,
                                             onStartLoad: injectLabVars});
    };

/*  if (simpleFeature.isAppSupported())
    simpleFeature.register(APPS_TITLE, openLab);
  else
    // No other way to allow the user to expose the functionality
    // voluntarily, so just open the lab now.
    openLab();*/
};

