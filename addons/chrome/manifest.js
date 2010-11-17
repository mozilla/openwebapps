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
 * The Original Code is manifest.js; substantial portions derived
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

  // parseUri 1.2.2
  // (c) Steven Levithan <stevenlevithan.com>
  // MIT License
  function parseUri (str) {
    var	o   = parseUri.options,
      m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
      uri = {},
      i   = 14;
    while (i--) uri[o.key[i]] = m[i] || "";
    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
      if ($1) uri[o.q.name][$1] = $2;
    });
    return uri;
  };

  parseUri.options = {
    strictMode: false,
    key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
    q:   {
      name:   "queryKey",
      parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
    parser: {
      strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
      loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
  };
  // end parseUri

  function applicationMatchesURL(application, url)
  {
    if (application.app_urls)
    {
      var inputURL = parseUri(url);
      for (var i=0;i<application.app_urls.length;i++)
      {
        var testURL = application.app_urls[i];
        if (url.indexOf(testURL) == 0) {
          // prefix matched: now make sure the domain is an exact match
          var testParse = parseUri(testURL);
          if (testParse.protocol == inputURL.protocol &&
            testParse.host == inputURL.host)
          {
            var requiredPort = inputURL.port ? inputURL.port : (inputURL.scheme == "https" ? 443 : 80);
            var testPort = testParse.port ? testParse.port : (testParse.scheme == "https" ? 443 : 80);
            if (requiredPort == testPort) return true;
          }
        }
      }
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

    if (!manf.name) {
      throw('Invalid manifest: missing application name');
    }
    if (!manf.base_url) {
      throw('Invalid manifest: missing "base_url" property');
    }
    if (!manf.app_urls) {
      throw('Invalid request: missing "app_urls" property');
    }
    if (manf.app_urls.length == 0) {
      throw('Invalid request: "app_urls" property must not be empty');
    }
    if (manf.launch_path == undefined) { // empty string is legal
      throw('Invalid request: missing "launch_path" property');
    }

    // '..' is forbidden in all paths
    if (manf.launch_path.indexOf("..") >= 0)
      throw('Invalid request: ".." is forbidden in launch_path');
    if (manf.update_path && manf.update_path.indexOf("..") >= 0)
      throw('Invalid request: ".." is forbidden in update_path');
    if (manf.icons) 
    {
      for (var size in manf.icons) 
      {
        if (manf.icons[size].indexOf("..") >= 0)
          throw('Invalid request: ".." is forbidden in icons');
      }
    }

    // Base URL must be part of the set of app_urls
    if (!applicationMatchesURL(manf, manf.base_url)) 
      throw('Invalid request: base_url property must be a subset of app_urls.');

    // Launch URL must be part of the set of app_urls
    if (!applicationMatchesURL(manf, manf.base_url + manf.launch_path)) {
      throw('Invalid request: base_url + launch_path property must be a subset of app_urls.');
    } 
    return manf;
  }

  return {
    validate: validate,
    parseUri: parseUri
  }
})();
