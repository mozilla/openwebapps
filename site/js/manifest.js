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

/**
  2010-07-14
  First version of server code
  -Michael Hanson. Mozilla

  2010-08-27
  Manifest validation code broken out into a separate file.
**/

;var Manifest = (function() {
  function applicationMatchesURL(application, url)
  {
    // TODO look into optimizing this so we are not constructing
    // regexps over and over again, but make sure it works in IE
    for (var i=0;i<application.app.urls.length;i++)
    {
      var testURL = application.app.urls[i];
      var re = RegExp("^" + testURL.replace("*", ".*"));// no trailing $
      if (re.exec(url) != null) return true;
    }
    return false;
  }

  // initialize a manifest object from a javascript manifest representation,
  // validating as we go.
  // throws a developer readable string upon discovery of an invalid manifest.
  function validate(manf) {
    // Validate and clean the request
    if(!manf) {
      throw('Invalid manifest: null');
    }

    if (manf.expiration) {
      var numericValue = Number(manf.expiration); // Cast to numeric timestamp
      var dateCheck = new Date(numericValue);
      if(dateCheck < new Date()) { // If you pass garbage into the date, this will be false
        throw('Invalid request: malformed expiration (' + manf.expiration + '; ' + dateCheck + ')');
      }
      manf.expiration = numericValue;
    }
    if (!manf.name) {
      throw('Invalid manifest: missing application name');
    }
    if (!manf.app) {
      throw('Invalid manifest: missing "app" property');
    }
    if (!manf.app.urls) {
      throw('Invalid request: missing "urls" property of "app"');
    }
    if (!manf.app.launch) {
      throw('Invalid request: missing "launch" property of "app"');
    }
    if (!manf.app.launch.web_url) {
      throw('Invalid request: missing "web_url" property of "app.launch"');
    }

    // Launch URL must be part of the set of app.urls
    if (!applicationMatchesURL(manf, manf.app.launch.web_url)) {
      throw('Invalid request: "web_url" ('+ manf.app.launch.web_url +
            ') property of "app.launch" must be a subset of app.urls.');
    } 
    //if (console && console.log) console.log("returning manifest");
    return manf;
  }

  function expired(manf) {
    return (manf.app.expiration && new Date(manf.app.expiration) < new Date());
  }

  return {
    validate: validate,
    expired: expired
  }
})();
