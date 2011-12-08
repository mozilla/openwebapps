/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
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
 *     Michael Hanson <mhanson@mozilla.com>
 *     Anant Narayanan <anant@kix.in>
 *     Tim Abraldes <tabraldes@mozilla.com>
 *     Dan Walkowski <dwalkowski@mozilla.com>
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

const {components, Cc, Cu, Ci} = require("chrome");
const file = require("file");
const self = require("self");
const url = require("url");

//used for several things
Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

NativeShell = (function() {
  function CreateNativeShell(app)
  {
    let os = Cc["@mozilla.org/xre/app-info;1"]
             .getService(Ci.nsIXULRuntime).OS;
    let nativeShell;
    if("WINNT" === os) {
      nativeShell = new WinNativeShell();
    } else if("Darwin" === os) {
      nativeShell = new MacNativeShell();
    }
    if(nativeShell) {
      createAppNativeLauncher(app, nativeShell);
    } else {
      console.log("APPS | CreateNativeShell | "
                  + "No OS-specific native shell could be created");
    }
  }

  return {
    CreateNativeShell: CreateNativeShell
  }
})();

function makeJSString(str) {
  // Replace double-quotes (") and slashes (\)
  // with escaped versions of each
  let escapeRE = new RegExp("([\"\\\\])", "gi");
  return "\"" + str.replace(escapeRE, "\\$&") + "\"";
}

function makeXMLString(str) {
  // There are 5 items that need to be escaped
  // in XML strings
  let quoteRE = new RegExp("\"", "gi");
  let aposRE = new RegExp("\\'", "gi");
  let ltRE = new RegExp("\\<", "gi");
  let gtRE = new RegExp("\\>", "gi");
  let ampRE = new RegExp("&", "gi");
  // Just be sure to replace ampersand before replacing
  // the others
  return str.replace(ampRE, "&amp;")
            .replace(quoteRE, "&quot;")
            .replace(aposRE, "&apos;")
            .replace(ltRE, "&lt;")
            .replace(gtRE, "&gt;");
}

function substituteStrings(inputString, substituteStrings)
{
  try {
    let working = inputString;
    for (let key in substituteStrings) {
      if(substituteStrings.hasOwnProperty(key)) {
        re = new RegExp(key, "gi");
        working = working.replace(re, substituteStrings[key]);
      }
    }
    return working;
  } catch(e) {
    throw("Failure in substituteStrings (" + e + ")");
  }
}

/* Creates a UTI for use in a BundleIdentifier on MacOS from
 * domain name; see
 * http://developer.apple.com/library/mac/#documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html
 *
 * The bare inverted domain name is used for standard-port HTTP
 * An inverted domain name suffixed with "https" is used for standard-port
 * HTTPS.
 * A port number is added to the tuple, at the end, but before
 *   the scheme, if the port number is non-standard.
 */
function createInvertedDNSIdentifier(uri)
{
  try {
    var nameSplit = uri.host.split(".");

    var s = "";
    for (var i=nameSplit.length-1; i>=0; i--)
    {
      if (s.length > 0) s += ".";
      s += nameSplit[i];
    }
    if(uri.port !== -1) {
      s += "." + uri.port;
    }
    if(uri.scheme !== "http") {
      s += "." + uri.scheme;
    }
    return s;
  } catch (e) {
    return "generic.webapp";
  }
}

function getBiggestIcon(icons) {
  let icon = 0;
  if (icons) {
    for (z in icons) {
      let size = parseInt(z, 10);
      if (size > icon) {
        icon = size;
      }
    }
  }
  if (icon === 0) {
    return null;
  } else {
    return icons[icon];
  }
}

function getIconFromURI(nativeShell) {
  if(!nativeShell.iconURI) {
    throw("getIconFromURI - "
        + "Invalid URI");
  }

  let mimeService = Cc["@mozilla.org/mime;1"]
                    .getService(Ci.nsIMIMEService)

  let mimeType;
  try {
    if("data" === nativeShell.iconURI.scheme) {
      let tIndex = nativeShell.iconURI.path.indexOf(";");
      mimeType = nativeShell.iconURI.path.substring(tIndex);
    } else {
      mimeType = mimeService.getTypeFromURI(nativeShell.iconURI);
    }
  } catch(e) {
    throw("getIconFromURI - "
        + "Failed to determine MIME type");
  }

  try {
    let listener;
    if(nativeShell.useTmpFileForIcon) {
      let downloadObserver = {
        onDownloadComplete: function(nativeShell,
                                     mimeType,
                                     downloader,
                                     request,
                                     cx,
                                     aStatus,
                                     file) {
                              onIconDownloaded(nativeShell,
                                               mimeType,
                                               aStatus,
                                               file,
                                               downloader);
            }.bind(undefined, nativeShell, mimeType)
      };

      tmpIcon = Cc["@mozilla.org/file/directory_service;1"]
                .getService(Ci.nsIProperties)
                .get("TmpD", Ci.nsIFile);
      tmpIcon.append("tmpicon."
                   + mimeService.getPrimaryExtension(mimeType, ""));
      tmpIcon.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
      listener = Cc["@mozilla.org/network/downloader;1"]
                 .createInstance(Ci.nsIDownloader);
      listener.init(downloadObserver, tmpIcon);
    } else {
      let pipe = Cc["@mozilla.org/pipe;1"]
                 .createInstance(Ci.nsIPipe);
      pipe.init(true, true, 0, 0xffffffff, null);

      listener = Cc["@mozilla.org/network/simple-stream-listener;1"]
                 .createInstance(Ci.nsISimpleStreamListener);
      listener.init(pipe.outputStream, {
          onStartRequest: function(aRequest, aContext) {},
          onStopRequest: function(nativeShell,
                                  mimeType,
                                  aRequest,
                                  aContext,
                                  aStatusCode) {
                            pipe.outputStream.close();
                            onIconDownloaded(nativeShell,
                                             mimeType,
                                             aStatusCode,
                                             pipe.inputStream);
                         }.bind(undefined, nativeShell, mimeType)
      });
    }

    let channel = NetUtil.newChannel(nativeShell.iconURI);
    let CertUtils = { };
    Cu.import("resource://gre/modules/CertUtils.jsm", CertUtils);
    // Pass true to avoid optional redirect-cert-checking behavior.
    channel.notificationCallbacks = new CertUtils.BadCertHandler(true);

    channel.asyncOpen(listener, null);
  } catch(e) {
    throw("getIconFromURI - "
        + "Failure getting icon (" + e + ")");
  }
}

function onIconDownloaded(nativeShell, mimeType, aStatusCode, icon) {
  if(nativeShell.isInstallAborted) {
    nativeShell.removeInstallation();
    return;
  }
  if (!components.isSuccessCode(aStatusCode)) {
    console.log("Attempt to retrieve icon returned result code "
              + aStatusCode);
    nativeShell.postIconProcessing();
    return;
  }
  try {
    nativeShell.processIcon(mimeType, icon);
  } catch(e) {
    console.log("Failure processing icon (" + e + ")");
    nativeShell.postIconProcessing();
  }
}

function embedInstallRecord(app, destination) {
  //write the contents of the app (install record), json-ified, into
  //the specified file.
  let theDestination = destination.clone();
  theDestination.append("installrecord.json");
  try {
    let installRecString = JSON.stringify(app);
    writeFile(installRecString, theDestination.path);
  } catch (e) {
    console.log("error writing installrecord : " + e + "\n");
  }
}


//used to copy in the necessary js files to include so we can call the
//MozApps api to do browserID stuff.
// turns out that we only really need injector.js for now
//FUTURE: might it be possible to get a nice reference to /lib/injector.js
//using the same scheme as self.data?
function embedMozAppsAPIFiles(destDir)
{
  //this is slightly sketchy, going up out of the data dir and into the lib dir to fetch a file...
  let dataURL = self.data.url(".");
  let dataPath = url.toFilename(dataURL);
  let injectorSrc = Cc['@mozilla.org/file/local;1']
                    .createInstance(Ci.nsILocalFile);
  injectorSrc.initWithPath(dataPath);
  injectorSrc = injectorSrc.parent;
  injectorSrc.append("lib");
  injectorSrc.append("injector.js");

  var injectorDest = destDir.clone();
  injectorDest.append("injector.js");

  copyFile(injectorSrc.path, injectorDest.path);
}

function copyFile(srcFile, destFile, fileProperties, substitutions) {
  try {
    //open the source file and read in the contents
    var openProps = fileProperties?fileProperties["mode"]:"";
    let inputStream = file.open(srcFile, openProps);
    let fileContents = inputStream.read();
    inputStream.close();

    writeFile(fileContents, destFile, fileProperties, substitutions);

  } catch(e) {
    throw("copyFile - "
        + "Failed copying file from "
        + srcFile
        + " to "
        + destFile
        + " (" + e + ")");
  }
}

/* TODO: Convert all file operations to be async */
function writeFile(fileContents, destFile, fileProperties, substitutions) {
  try {
    var openProps = fileProperties?fileProperties["mode"]:"";
    //do string substitutions if necessary
    let finalContents;
    if(fileProperties && fileProperties["substituteStrings"]) {
      finalContents = substituteStrings(fileContents, substitutions);
    } else {
      finalContents = fileContents;
    }
    //write out the (possibly altered) file to the new location
    let outputStream = file.open(destFile, "w" + openProps);
    outputStream.write(finalContents);
    outputStream.close();

  } catch(e) {
    throw("writeFile - "
        + "Failed writing file to "
        + destFile
        + " (" + e + ")");
  }
}

function recursiveFileCopy(srcDir,
                           leaf,
                           dstDir,
                           separator,
                           substitutions,
                           specialFiles)
{
  if(!specialFiles) {
    specialFiles = {};
  }
  try {
    let srcCompletePath = srcDir;
    var dest = dstDir;
    if(leaf) {
      srcCompletePath += "/" + leaf;
      dest += separator + leaf;
    }
    let srcURL = self.data.url(srcCompletePath);
    var srcFile = url.toFilename(srcURL);
    //console.log(srcFile);
  } catch(e) {
    throw("recursiveFileCopy - "
          + "Failure while setting up paths (" + e +")");
  }

  try {
    var fileExists = file.exists(srcFile);
    if(fileExists) {
      // file doesn't expose an isDirectory function yet
      // so we negate file.isFile
      var isDir = !file.isFile(srcFile);
    }
  } catch(e) {
    throw("recursiveFileCopy - "
          + "Failure obtaining information about file "
          + srcFile
          + " (" + e + ")");
  }

  if(!fileExists) {
    throw("recursiveFileCopy - "
          + "Tried to copy file but source file doesn't exist ("
          + srcFile + ")");
  }

  if (isDir)
  {
    let newSpecialFiles = Object.create(specialFiles);
    try {
      var dirContents = file.list(srcFile);
      file.mkpath(dest);
    } catch(e) {
      throw("recursiveFileCopy - "
            + "Failure setting up directory copy from "
            + srcFile
            + " to "
            + dest
            + " (" + e + ")");
    }

    let manifestPath = srcFile + separator + "specialfiles.json";
    try {
      if(file.exists(manifestPath)) {
        let manifestStream = file.open(manifestPath);
        let fileContents = manifestStream.read();
        manifestStream.close();

        let parsedManifest = JSON.parse(fileContents);
        for(let specialFile in parsedManifest) {
          if(parsedManifest.hasOwnProperty(specialFile)) {
            if(!(specialFile in newSpecialFiles)) {
              newSpecialFiles[specialFile] = {};
            }
            for(let property in parsedManifest[specialFile]) {
              if(parsedManifest[specialFile].hasOwnProperty(property)) {
                newSpecialFiles[specialFile][property] =
                                    parsedManifest[specialFile][property];
              }
            }
          }
        }
      }
    } catch(e) {
      throw("Failure reading/parsing specialFiles manifest "
            + manifestPath
            + " (" + e + ")");
    }

    for (let i=0; i < dirContents.length; i++)
    {
      recursiveFileCopy(
                        // Use "/" instead of separator; this is a URI
                        srcDir + "/" + leaf,
                        dirContents[i],
                        dest,
                        separator,
                        substitutions,
                        newSpecialFiles);
    }
  } else {
    let fileProperties = {"ignore": false,
                          "rename": leaf,
                          "isExecutable": false,
                          "mode": "",
                          "substituteStrings": true};
    if(leaf in specialFiles) {
      for(let property in fileProperties) {
        if(fileProperties.hasOwnProperty(property)) {
          if(property in specialFiles[leaf]) {
            fileProperties[property] = specialFiles[leaf][property];
          }
        }
      }
    }

    if(!(fileProperties["ignore"])) {
      for(let property in fileProperties) {
        if(fileProperties.hasOwnProperty(property)
            && (typeof(fileProperties[property]) === "string")) {
          fileProperties[property] =
                substituteStrings(fileProperties[property],
                substitutions);
        }
      }

      dest = dstDir + separator + fileProperties["rename"];

      if(fileProperties["isExecutable"])
      {
        try {
          // Some shenanigans here to set the executable bit:
          let aNsLocalFile = Cc['@mozilla.org/file/local;1']
                             .createInstance(Ci.nsILocalFile);
          aNsLocalFile.initWithPath(dest);
          aNsLocalFile.create(aNsLocalFile.NORMAL_FILE_TYPE,
                              0x1ed); // octal 755
        } catch(e) {
          throw("recursiveFileCopy - "
              + "Failed creating executable file "
              + dest
              + " (" + e + ")");
        }
      }

      //actually do the copy
      copyFile(srcFile, dest, fileProperties, substitutions);
    }
  }
}

function abortInstallation(nativeShell) {
  nativeShell.isInstallAborted = true;
  nativeShell.removeInstallation();
}

function setUpSharedVariables(app, out) {
   let ios = Cc["@mozilla.org/network/io-service;1"]
             .getService(Ci.nsIIOService);
   let originURI = ios.newURI(app.origin, null, null);
   out.launchURI = originURI.clone();
   if (app.manifest.launch_path) {
     out.launchURI.spec =
             originURI.resolve(app.manifest.launch_path);
   }
   let biggestIcon = getBiggestIcon(app.manifest.icons);
   if(biggestIcon) {
     if(0 !== biggestIcon.indexOf("/")) {
       out.iconURI = ios.newURI(biggestIcon, null, null);
     } else {
       out.iconURI = originURI.clone();
       out.iconURI.spec = originURI.resolve(biggestIcon);
     }
   }

   let unprintableRE = new RegExp("["
                                + "\\x00-\\x1F"
                                + "\\x7F"
                                + "]"
                                ,"gi");
   out.appName = app.manifest.name.replace(unprintableRE, "");

   if(app.developer) {
     if(app.developer.name) {
       out.developerName =
                app.manifest.developer.name
                                      .substring(0, 128)
                                      .replace(unprintableRE, "");
     }
   }

   out.shortDescription = "";
   if(!app.manifest.description) {
     out.shortDescription = out.appName;
   } else {
     if(app.manifest.description.length <= 256) {
       out.shortDescription = app.manifest.description;
     } else {
       let index = app.manifest.description.indexOf("\n");
       if(index != -1 && index < 256) {
         out.shortDescription = app.manifest.description.substring(0,index);
       } else {
         out.shortDescription = app.manifest.description.substring(0,253) + "...";
       }
     }
   }
   out.shortDescription = out.shortDescription.replace(unprintableRE, "");

   out.versionStr = "Developer Preview";

   out.substitutions = {
     "\\$NAME_AS_XUL_APP_PROPERTY": out.appName,

     "\\$VERSION_AS_XUL_APP_PROPERTY": out.versionStr,
     "\\$ORIGIN_AS_XUL_APP_PROPERTY": out.launchURI.prePath,

     "\\$NAME_AS_JS_STRING": makeJSString(out.appName),

     "\\$NAME_AS_XML_STRING": makeXMLString(out.appName),
     "\\$LAUNCH_PATH_AS_XML_STRING": makeXMLString(out.launchURI.spec)
   }
}

function createAppNativeLauncher(app, nativeShell) {
  try {
    nativeShell.isInstallAborted = false;
    nativeShell.setUpVariables(app);
  } catch(e) {
    throw("createAppNativeLauncher - Failure initializing native install "
        + "(" + e + ")");
  }

  try {
    nativeShell.removeInstallation();
    nativeShell.installDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
  } catch(e) {
    throw("createAppNativeLauncher - Failure setting up installation directory "
        + "(" + e + ")");
  }

  try {
    getIconFromURI(nativeShell);
  } catch(e) {
    console.log("Failed to retrieve icon (" + e + ")");
    nativeShell.postIconProcessing();
  }

  try {
    nativeShell.copyInstallationFiles();

    //add the install record to the native app bundle
    embedInstallRecord(app, nativeShell.XULDir);

    //add injector.js, which we need to inject some apis
    //into the webapp content page
    let contentDir = nativeShell.XULDir.clone();
    contentDir.append("content");
    embedMozAppsAPIFiles(contentDir);
  } catch(e) {
    abortInstallation(nativeShell);
    throw("createAppNativeLauncher - "
        + "Failure copying files (" + e + ")");
  }
}

// Windows implementation
function WinNativeShell() {
}

WinNativeShell.prototype = {
  setUpVariables : function(app) {
    setUpSharedVariables(app, this);

    let filenameRE = new RegExp("["
                              + "<"
                              + ">"
                              + ":"
                              + "\""
                              + "/"
                              + "\\\\"
                              + "|"
                              + "\\?"
                              + "\\*"
                              + "]"
                              ,"gi");

    this.appNameAsFilename = this.appName.replace(filenameRE, "");

    let directoryService = Cc["@mozilla.org/file/directory_service;1"]
                           .getService(Ci.nsIProperties);
    this.installDir = directoryService.get("AppData", Ci.nsIFile);
    this.installDir.append(this.launchURI.host + ";"
                        +  this.launchURI.scheme + ";"
                        +  this.launchURI.port);
    this.installDir.append(this.appNameAsFilename);

    this.XULDir = this.installDir.clone();

    this.uninstallerFile = this.installDir.clone();
    this.uninstallerFile.append("uninstall.exe");

    this.iconFile = this.installDir.clone();
    this.iconFile.append("chrome");
    this.iconFile.append("icons");
    this.iconFile.append("default");
    this.iconFile.append(this.appNameAsFilename + ".ico");

    this.installerDir = directoryService.get("TmpD", Ci.nsIFile);
    this.installerDir.append(this.appNameAsFilename);
    this.installerDir.createUnique(Ci.nsIFile.DIRECTORY_TYPE, 0777);

    this.firefoxFile = directoryService.get("CurProcD", Ci.nsIFile);
    // TODO: Is there a way to get the currently running process?
    this.firefoxFile.append("firefox.exe");

    this.desktopShortcut = directoryService.get("Desk", Ci.nsIFile);
    this.desktopShortcut.append(this.appNameAsFilename + ".lnk");

    this.startMenuShortcut = directoryService.get("Progs", Ci.nsIFile);
    this.startMenuShortcut.append(this.appNameAsFilename + ".lnk");

    this.uninstallSubkeyStr = this.launchURI.scheme
                            + "://"
                            + this.launchURI.host
                            + ":"
                            + this.launchURI.port;

    this.substitutions["\\$PROFILE_DIR"] = this.installDir.parent.leafName;
    // Slashes in the app name cause the XUL app to fail to launch :(
    this.substitutions["\\$NAME_AS_XUL_APP_PROPERTY"] =
                                 this.appName.replace("\\", "");
  },

  copyInstallationFiles : function() {
    recursiveFileCopy("native-install/windows/app",
                      "",
                      this.installDir.path,
                      "\\",
                      this.substitutions,
                      undefined);

    recursiveFileCopy("native-install/XUL",
                      "",
                      this.installDir.path,
                      "\\",
                      this.substitutions,
                      undefined);
  },

  writeRegKeys : function() {
    let uninstallKey;
    let subKey;

    try {
      uninstallKey = Cc["@mozilla.org/windows-registry-key;1"]
                     .createInstance(Ci.nsIWindowsRegKey);
      uninstallKey.open(uninstallKey.ROOT_KEY_CURRENT_USER,
                        "SOFTWARE\\Microsoft\\Windows\\"
                      + "CurrentVersion\\Uninstall",
                        uninstallKey.ACCESS_WRITE);
    } catch(e) {
      throw("Failure opening uninstall key (" + e + ")");
    }

    try {
      try {
        subKey = uninstallKey.createChild(this.uninstallSubkeyStr,
                                          uninstallKey.ACCESS_WRITE);
      } catch(e) {
        throw("Failure opening uninstall subkey (" + e + ")");
      }

      try {
        subKey.writeStringValue("DisplayName", this.appName);
        subKey.writeStringValue("ShortcutName", this.appNameAsFilename);
        if(this.iconFile) {
          subKey.writeStringValue("DisplayIcon", this.iconFile.path);
        }
        subKey.writeStringValue("UninstallString",
                                this.uninstallerFile.path
                              + " /ORIGIN_SCHEME="
                              + " \"" + this.launchURI.scheme + "\""
                              + " /ORIGIN_HOST="
                              + " \"" + this.launchURI.host + "\""
                              + " /ORIGIN_PORT="
                              + " \"" + this.launchURI.port + "\"");
        subKey.writeStringValue("InstallLocation", this.installDir.path);
        subKey.writeIntValue("NoModify", 1);
        subKey.writeIntValue("NoRepair", 1);
        // TODO: Maybe grab info from BrowserID for this?
        subKey.writeStringValue("RegOwner", "Your name here");
        //subKey.writeStringValue("ProductID", "");
        subKey.writeStringValue("UrlUpdateInfo",
                                "http://apps.mozillalabs.com");
        if(this.developerName) {
          subKey.writeStringValue("Publisher",
                                  this.developerName);
        }
        subKey.writeStringValue("DisplayVersion",
                                this.versionStr);
        // TODO: Can we figure out what store we're installing from?
        subKey.writeStringValue("InstallSource", "");
        subKey.writeStringValue("Comments",
                                this.shortDescription);
        subKey.writeStringValue("HelpLink",
                                      "http://apps.mozillalabs.com");
        subKey.writeStringValue("URLInfoAbout",
                                this.launchURI.prePath);
        subKey.writeStringValue("Contact", "http://apps.mozillalabs.com");
        // TODO: Maybe link to the description in the store here?
        //subKey.writeStringValue("Readme", "http://apps.mozillalabs.com");
      } catch(e) {
        throw("Failure writing uninstall key value (" + e + ")");
      } finally {
        subKey.close();
      }
    } finally {
      uninstallKey.close();
    }
  },

  removeInstallation : function() {
    let uninstallKey;
    try {
      uninstallKey = Cc["@mozilla.org/windows-registry-key;1"]
                     .createInstance(Ci.nsIWindowsRegKey);
      uninstallKey.open(uninstallKey.ROOT_KEY_CURRENT_USER,
                        "SOFTWARE\\Microsoft\\Windows\\"
                      + "CurrentVersion\\Uninstall",
                        uninstallKey.ACCESS_WRITE);
    } catch(e) {
      console.log("Failed to open uninstall key (" + e + ")");
      uninstallKey = null;
    }

    if(uninstallKey) {
      try {
        if(uninstallKey.hasChild(this.uninstallSubkeyStr)) {
          uninstallKey.removeChild(this.uninstallSubkeyStr);
        }
      } catch(e) {
        console.log("Failed to remove uninstall entries (" + e +")");
      } finally {
        uninstallKey.close();
      }
    }

    try {
      if(this.installDir.exists()) {
        this.installDir.remove(true);
      }
    } catch(e) {
      console.log("Failed to clean up installation directory (" + e +")");
    }

    try {
      if(this.desktopShortcut.exists()) {
        this.desktopShortcut.remove(false);
      }
    } catch(e) {
      console.log("Failed to remove desktop shortcut (" + e +")");
    }

    try {
      if(this.startMenuShortcut.exists()) {
        this.startMenuShortcut.remove(false);
      }
    } catch(e) {
      console.log("Failed to remove start menu shortcut (" + e +")");
    }
  },

  processIcon : function(mimeType, imageStream)
  {
      let iconStream;
      try {
        let imgTools = Cc["@mozilla.org/image/tools;1"]
                       .createInstance(Ci.imgITools);
        let imgContainer = { value: null };

        imgTools.decodeImageData(imageStream, mimeType, imgContainer);

        iconStream =
            imgTools.encodeImage(imgContainer.value,
                                 "image/vnd.microsoft.icon",
                                 "format=bmp");
      } catch (e) {
        throw("processIcon - "
            + "Failure converting icon"
            + " (" + e + ")");
      }

      try {
        this.iconFile.parent.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
        let outputStream =
                FileUtils.openSafeFileOutputStream(this.iconFile);
        NetUtil.asyncCopy(iconStream,
                          outputStream,
                          this.postIconProcessing.bind(this));
      } catch(e) {
        throw("processIcon - "
            + "Failure writing icon"
            + " (" + e + ")");
      }
  },

  postIconProcessing : function() {
    if(this.isInstallAborted) {
      this.removeInstallation();
      return;
    }
    try {
      this.writeRegKeys();
    } catch(e) {
      console.log("APPS | nativeshell.win | writeRegKeys - "
                + "Failure writing reg keys (" + e + ")");
      abortInstallation(this);
      return;
    }

    try {
      recursiveFileCopy("native-install/windows/installer",
                        "",
                        this.installerDir.path,
                        "\\",
                        this.substitutions,
                        undefined);

      let process = Cc["@mozilla.org/process/util;1"]
                    .createInstance(Ci.nsIProcess);

      let installerFile = this.installerDir.clone();
      installerFile.append("install.exe");

      process.init(installerFile);
      process.run(true, ["/S",
                         "/FIREFOX_PATH=",
                         this.firefoxFile.path,
                         "/ORIGIN_SCHEME=",
                         this.launchURI.scheme,
                         "/ORIGIN_HOST=",
                         this.launchURI.host,
                         "/ORIGIN_PORT=",
                         this.launchURI.port], 9);
      if(0 !== process.exitValue) {
        console.log("Installer returned " + process.exitValue);
        abortInstallation(this);
        return;
      }

      let shortcut = this.installDir.clone();
      shortcut.append(this.appNameAsFilename + ".lnk");

      // TODO: Only create these if the user wants us to
      shortcut.copyTo(this.desktopShortcut.parent, "");
      shortcut.copyTo(this.startMenuShortcut.parent, "");
    } catch (e) {
      console.log("Failure running installer (" + e + ")");
      abortInstallation(this);
    } finally {
      try {
        this.installerDir.remove(true);
      } catch(e) {
        console.log("Failure cleaning up installer (" + e + ")");
      }
    }
  }
};

// Mac implementation
//
// Our Mac strategy for now is to synthesize a bundle containing
// a small executable in the Applications directory of the user.
// The executable finds the Firefox executable and creates a 
// symlink to it inside the bundle.  This seems to make
// MacOS 10.6 and later happy, and also recovers gracefully
// if the bundle is moved to another machine or the Firefox
// executable moves or changes.
//
// This does _not_ give us document opening (boo) but it will
// interact reasonably with the Finder and the Dock

function MacNativeShell() {

}

MacNativeShell.prototype = {
  removeInstallation : function() {
    if(this.installDir.exists()) {
      this.installDir.remove(true);
    }
  },

  copyInstallationFiles : function() {
    recursiveFileCopy("native-install/mac",
                      "",
                      this.installDir.path,
                      "/",
                      this.substitutions);

    recursiveFileCopy("native-install/XUL",
                      "",
                      this.XULDir.path,
                      "/",
                      this.substitutions);
  },

  setUpVariables : function(app) {
    setUpSharedVariables(app, this);

    this.useTmpFileForIcon = true;

    let filenameRE = new RegExp("["
                              + ":"
                              + "/"
                              + "]"
                              ,"gi");
    this.appNameAsFilename = this.appName
                                 .replace(filenameRE, "-");

    this.installDir = Cc['@mozilla.org/file/local;1']
                      .createInstance(Ci.nsILocalFile);
    this.installDir.initWithPath("~/Applications");
    this.installDir.append(this.appNameAsFilename + ".app");

    this.XULDir = this.installDir.clone();
    this.XULDir.append("XUL");

    this.iconFile = this.installDir.clone();
    this.iconFile.append("Contents");
    this.iconFile.append("Resources");
    this.iconFile.append("appicon.icns");

    this.substitutions["\\$REVERSED_APPDOMAIN"] =
                            createInvertedDNSIdentifier(this.launchURI);
    this.substitutions["\\$PROFILE_DIR"] = this.installDir.leafName;
    this.substitutions["\\$NAME_AS_FILENAME"] = this.appNameAsFilename;
    this.substitutions["\\$FILENAME_AS_XML"] =
                  makeXMLString(this.appNameAsFilename;
  },

  processIcon : function(mimeType, icon) {
    try {
      var process = Cc["@mozilla.org/process/util;1"]
                    .createInstance(Ci.nsIProcess);
      var sipsFile = Cc["@mozilla.org/file/local;1"]
                    .createInstance(Ci.nsILocalFile);
      sipsFile.initWithPath("/usr/bin/sips");

      process.init(sipsFile);
      process.run(["-s",
                   "format", "icns",
                   icon.path,
                   "--out", this.iconFile.path,
                   "-z", "128", "128"],
                   9);
    } catch(e) {
      throw(e);
    }
  },

  postIconProcessing : function() {

  }
}

/* Jetpack specific export */
if (typeof exports !== "undefined")
    exports.NativeShell = NativeShell;
