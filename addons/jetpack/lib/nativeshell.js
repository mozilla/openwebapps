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
      nativeShell.createAppNativeLauncher(app);
    } else {
      console.log("APPS | CreateNativeShell | "
                  + "No OS-specific native shell could be created");
    }
  }

  return {
    CreateNativeShell: CreateNativeShell
  }
})();

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

function reverseDNS(domain)
{
  var d = domain.split(".");
  var s = "";
  for (var i=d.length-1;i--;i>=0)
  {
    if (s.length > 0) s += ".";
    s += d[i];
  }
  return s;
}

function getBiggestIcon(app, callback) {
  let icon = 0;
  if (app.manifest.icons) {
    for (z in app.manifest.icons) {
      let size = parseInt(z, 10);
      if (size > icon) {
        icon = size;
      }
    }
  }
  if (icon === 0) {
    return null;
  } else {
    icon = app.manifest.icons[icon];
  }

  if (icon.indexOf("data:") === 0) {
    let tIndex = icon.indexOf(";");
    mimeType = icon.substring(5, tIndex);

    let base64 = icon.indexOf("base64,");
    if (base64 < 0) {
      throw("getBiggestIcon - "
            + "Found a data URL but it appears not to be base64 encoded");
    }

    let binaryStream;
    try {
      let base64Data = icon.substring(base64 + 7);

      const AppShellService =
            Cc["@mozilla.org/appshell/appShellService;1"]
            .getService(Ci.nsIAppShellService);
      let binaryData =
            AppShellService.hiddenDOMWindow.atob(String(base64Data));
      let stringStream = Cc["@mozilla.org/io/string-input-stream;1"]
                         .createInstance(Ci.nsIStringInputStream);
      stringStream.setData(binaryData, binaryData.length);
      binaryStream = Cc["@mozilla.org/binaryinputstream;1"]
                     .createInstance(Ci.nsIObjectInputStream);
      binaryStream.setInputStream(stringStream);
    } catch(e) {
      throw("getBiggestIcon - "
            + "Failure converting base64 data "
            + "(" + e + ")");
    }

    try {
      callback(0, mimeType, binaryStream);
    } catch(e) {
      throw("getBiggestIcon - "
            + "Failure in callback "
            + "(" + e + ")");
    }
  } else {
    // TODO: Come up with a smarter way to determine MIME type
    try {
      if (icon.indexOf(".png") > 0) {
        mimeType = "image/png";
      } else if ((icon.indexOf(".jpeg") > 0)
                || (icon.indexOf(".jpg") > 0)) {
        mimeType = "image/jpeg";
      }
    } catch(e) {
      throw("getBiggestIcon - "
            + "Failure determining MIME type of " + icon
            + " (" + e + ")");
    }

    let iconPath = app.origin + icon;
    NetUtil.asyncFetch(iconPath,
                       function(inputStream, resultCode, request) {
        try {
          callback(resultCode, mimeType, inputStream);
        } catch (e) {
          console.log("getBiggestIcon - "
            + "Failure in callback function"
            + " (" + e + ")");
        }
    });
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
  //find where the jetpack addon is, and where it is keeping the necessary
  //js files we need to copy into the native app
  var mozappsD = Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties)
                 .get("ProfD", Ci.nsIFile);
  mozappsD.append("extensions");
  mozappsD.append(self.id);
  mozappsD.append("resources");
  mozappsD.append("openwebapps-at-mozillalabs-dot-com-openwebapps-lib");

  var injectorSrc = mozappsD.clone();
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

//ASYNC file reading/writing/copying code.  unable to evaluate the issues that might occur during a file
// tree copy, so putting on hold for now.
// function asyncReadFile(inFile, callback) {
//   //passes the string contents of the file to the callback for you to do with as you like.

//   NetUtil.asyncFetch(inFile, function(inputStream, status) {  
//     if (!Components.isSuccessCode(status)) {  
//       // should probably throw instead  
//       console.log("ERROR: " + status + " failed to read file: " + inFile);
//       return;  
//     }  
//     var data = NetUtil.readInputStreamToString(inputStream, inputStream.available());  
//     inputStream.close();
//     callback(data);
//   });
// }

// //make it into an inputstream and then send it to copy
// function asyncWriteFile(strData, outFile) {
//   var outStream = FileUtils.openSafeFileOutputStream(outFile);
//   var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);  
//   converter.charset = "UTF-8";  
//   var inStream = converter.convertToInputStream(strData);  
    
//   // The last argument (the callback) is optional.  
//   NetUtil.asyncCopy(inStream, outStream, function(status) {  
//     if (!Components.isSuccessCode(status)) {  
//       // should probably throw instead  
//       console.log("ERROR: " + status + " failed to write file: " + outFile.path);  
//       return;  
//     }  
//   });
// }

// // NOTE: both inFile and outFile are nsIFile objects
// // NOTE: this code should probably throw, and get caught up at the top, where we can cancel the creation of the native app
// function asyncCopyFile(inFile, outFile, options) {
        
//   NetUtil.asyncFetch(inFile, function(inputStream, status) {  
//       if (!Components.isSuccessCode(status)) {  
//         // should probably throw instead  
//         console.log("ERROR: " + status + " failed to read file: " + inFile.path);
//         return;  
//       }  
      
//     var outputStream = FileUtils.openSafeFileOutputStream(outFile);

//     NetUtil.asyncCopy(inputStream, outputStream, function(status) {
//       if (!Components.isSuccessCode(status)) {  
//         // should probably throw instead  
//         console.log("ERROR: " + status + " failed to write file: " + outFile.path);
//         return;  
//       } 
//     });        
//   });  
// }

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

// Windows implementation
function WinNativeShell() {
}

WinNativeShell.prototype = {
  createAppNativeLauncher : function(app)
  {
    this.createExecutable(app);
  },

  setUpPaths : function(app) {
      this.appName = app.manifest.name;

      let directoryService = Cc["@mozilla.org/file/directory_service;1"]
                             .getService(Ci.nsIProperties);
      this.installDir = directoryService.get("AppData", Ci.nsIFile);
      this.installDir.append(this.appName);

      this.launchPath = app.origin;
      if (app.manifest.launch_path) {
        this.launchPath += app.manifest.launch_path;
      }

      this.iconFile = this.installDir.clone();
      this.iconFile.append("chrome");
      this.iconFile.append("icons");
      this.iconFile.append("default");
      this.iconFile.append(this.appName + ".ico");

      this.installerDir = directoryService.get("TmpD", Ci.nsIFile);
      this.installerDir.append(this.appName);
      this.installerDir.createUnique(Ci.nsIFile.DIRECTORY_TYPE, 0777);

      this.firefoxFile = directoryService.get("CurProcD", Ci.nsIFile);
      // TODO: What if FF has been renamed?
      this.firefoxFile.append("firefox.exe");
  },

  // TODO: Ask user whether to create desktop/start menu shortcuts
  // TODO: Support App descriptions
  createExecutable : function(app)
  {
    try {
      this.setUpPaths(app);
    } catch(e) {
      throw("createExecutable - Failure setting up paths (" + e + ")");
    }

    let substitutions;
    try {
      substitutions = {
        "\\$APPNAME": this.appName,
        "\\$APPDOMAIN": app.origin,
        "\\$APPDESC": "App descriptions are not yet supported",
        "\\$FFPATH": this.firefoxFile.path,
        "\\$LAUNCHPATH": this.launchPath,
        "\\$INSTALLDIR": this.installDir.path,
        "\\$ICONPATH": this.iconFile.path,
        "\\$DESKTOP_SHORTCUT": "y",
        "\\$SM_SHORTCUT": "y"
      }
    } catch(e) {
      throw("createExecutable - "
          + "Failure setting up substitutions");
    }

    try {
      recursiveFileCopy("native-install/windows/installer",
                        "",
                        this.installerDir.path,
                        "\\",
                        substitutions,
                        undefined);
    } catch (e) {
      throw("createExecutable - "
            + "Failure copying installer to temporary location "
            + this.installerDir.path
            + " (" + e + ")");
    }

    try {
      this.removeInstallation();
      this.installDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
      this.iconFile.parent.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
    } catch(e) {
      throw("createExecutable - "
            + "Failure setting up target location (" + e + ")");
    }

    try {
      this.synthesizeIcon(app);
    } catch(e) {
      // Don't fail the installation on icon failures
      console.log("createExecutable - "
          + "Error synthesizing icon: " + e);
    }

    try {
      let process = Cc["@mozilla.org/process/util;1"]
                  .createInstance(Ci.nsIProcess);

      let installerFile = this.installerDir.clone();
      installerFile.append("install.exe");

      process.init(installerFile);
      // TODO: Run this asynchronously
      process.run(true, ["/S"], 1);
      if(0 !== process.exitValue) {
        throw("Installer returned " + process.exitValue);
      }
    } catch (e) {
      throw("createExecutable - "
            + "Failure running installer (" + e + ")");
    }

    try {
      recursiveFileCopy("native-install/windows/app",
                        "",
                        this.installDir.path,
                        "\\",
                        substitutions,
                        undefined);

      recursiveFileCopy("native-install/XUL",
                        "",
                        this.installDir.path,
                        "\\",
                        substitutions,
                        undefined);

      //add the install record to the native app bundle
      embedInstallRecord(app, this.installDir);

      //add injector.js, which we need to inject some apis
      //into the webapp content page
      let contentDir = this.installDir.clone();
      contentDir.append("content");
      embedMozAppsAPIFiles(contentDir);
    } catch(e) {
      this.removeInstallation();
      throw("createExecutable - "
          + "Failure copying files (" + e + ")");
    }
  },

  removeInstallation : function() {
    try {
      if(this.installDir.exists()) {
        let uninstallerFile = this.installDir.clone();
        uninstallerFile.append("uninstall.exe");

        if (uninstallerFile.exists()) {
          let process = Cc["@mozilla.org/process/util;1"]
                        .createInstance(Ci.nsIProcess);
          process.init(uninstallerFile);
          // TODO: Run this asynchronously
          process.run(true, ["/S"], 1);
        }
      }
    } catch(e) {

    }

    try {
      if(this.installDir.exists()) {
        this.installDir.remove(true);
      }
    } catch(e) {

    }
  },

  synthesizeIcon : function(app)
  {
    try {
      getBiggestIcon(app,
                     this.onIconRetrieved.bind(this));
    } catch(e) {
      throw("synthesizeIcon - Failure reading icon information (" + e + ")");
    }
  },

  onIconRetrieved : function(resultCode,
                             mimeType,
                             imageStream)
  {
    if (!components.isSuccessCode(resultCode)) {
      console.log("APPS | nativeshell.win | synthesizeIcon - "
                  + "Attempt to retrieve icon returned result code "
                  + resultCode);
      return;
    }

    let iconStream;
    try {
      let imgTools = Cc["@mozilla.org/image/tools;1"]
                     .createInstance(Ci.imgITools);
      let imgContainer = { value: null };

      imgTools.decodeImageData(imageStream, mimeType, imgContainer);

      iconStream =
          imgTools.encodeImage(imgContainer.value,
                               "image/vnd.microsoft.icon");
    } catch (e) {
      console.log("APPS | nativeshell.win | synthesizeIcon - "
                  + "Failure converting icon"
                  + " (" + e + ")");
      return;
    }

    try {
      let outputStream = FileUtils.openSafeFileOutputStream(this.iconFile);
      NetUtil.asyncCopy(iconStream,
                        outputStream,
                        function(result) {
            if (!Components.isSuccessCode(result)) {
              console.log("APPS | nativeshell.win | synthesizeIcon - "
                          + "Failure writing icon file "
                          + " (" + result + ")");
            }
          });
    } catch (e) {
      console.log("APPS | nativeshell.win | synthesizeIcon - "
                  + "Failure writing icon file "
                  + " (" + e + ")");
      return;
    }
  }
};

// Mac implementation
//
// Our Mac strategy for now is to create a .webloc file and
// to put the app icon on it. We also create a "Web Apps"
// subfolder in the Applications folder.
//
// This does _not_ give us document opening (boo) but it will
// interact reasonably with the Finder and the Dock

function MacNativeShell() {

}

function sanitizeMacFileName(path)
{
  return path.replace(":", "-").replace("/", "-");
}

MacNativeShell.prototype = {

  createAppNativeLauncher : function(app)
  {
    dump("APPS | nativeshell.mac | Creating app native launcher\n");
    this.createExecutable(app);
  },

  setUpPaths : function(app) {

      let installDirPath = "~/Applications";

      this.appName = sanitizeMacFileName(app.manifest.name) + ".app";

      this.installDir = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
      this.installDir.initWithPath(installDirPath);
      this.installDir.append(this.appName);

      let webRTPath = self.data.url("native-install/mac/xulrunner");
      this.webRTDir = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
      this.webRTDir.initWithPath(url.toFilename(webRTPath));

      this.webRTConfigFile = this.installDir.clone();
      this.webRTConfigFile.append("webRT.config");
      console.log(this.webRTConfigFile.path);

      this.iconFile = this.installDir.clone();
      this.iconFile.append("Contents");
      this.iconFile.append("Resources");
      this.iconFile.append("appicon.icns");
  },


  createExecutable : function(app)
  {
    try {
      this.setUpPaths(app);
    } catch(e) {
      throw("createExecutable - Failure setting up paths (" + e + ")");
    }

    if (file.exists(this.installDir.path))
    {
      // recursive delete
      this.installDir.remove(true);
    }
    
    // Now we synthesize a .app by copying the mac-app-template directory from our internal state
    var launchPath = app.origin;
    if (app.manifest.launch_path) {
      launchPath += app.manifest.launch_path;
    }

    let substitutions = {
      "\\$APPNAME": app.manifest.name,
      "\\$APPDOMAIN": app.origin,
      "\\$REVERSED_APPDOMAIN": /*reverseDNS(*/app.origin/*)*/,
      "\\$LAUNCHPATH": launchPath
    }
    file.mkpath(this.installDir.path);

      recursiveFileCopy("native-install/mac",
                           "",
                           this.installDir.path,
                           "/",
                           substitutions);

      recursiveFileCopy("native-install/XUL",
                           "",
                           this.installDir.path + "/XUL",
                           "/",
                           substitutions);

    //////////////////////////////////////////////
    //this code should be cross-platform   
    var XULDir = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
    XULDir.initWithPath(this.installDir.path);
    XULDir.append("XUL");
    var contentDir = XULDir.clone();
    contentDir.append("content");

    //add the install record to the native app bundle
    embedInstallRecord(app, XULDir);
    //add injector.js, which we need to inject some apis into the webapp content page
    embedMozAppsAPIFiles(contentDir);
    /////////////////////////////////////////////

    this.synthesizeIcon(app);
  },

  synthesizeIcon : function(app)
  {
    getBiggestIcon(app,
                   this.onIconRetrieved.bind(this));
  },

  onIconRetrieved : function(resultCode,
                             mimeType,
                             iconStream) {
    if (!components.isSuccessCode(resultCode)) {
      console.log("APPS | nativeshell.mac | synthesizeIcon - "
          + "Attempt to retrieve icon returned result code "
          + resultCode);
      return;
    }

    try {
      var filePath = Cc["@mozilla.org/file/directory_service;1"]
                     .getService(Ci.nsIProperties)
                     .get("TmpD", Ci.nsIFile);
      filePath.append("tmpicon" + tSuffix);
      filePath.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

      var stream = Cc["@mozilla.org/network/safe-file-output-stream;1"]
                   .createInstance(Ci.nsIFileOutputStream);
      // readwrite, create, truncate
      stream.init(filePath, 0x04 | 0x08 | 0x20, 0600, 0);

      NetUtil.asyncCopy(icoStream,
                        outputStream,
                        this.onTmpIconWritten.bind(this));
    } catch(e) {
      console.log("APPS | nativeshell.mac | synthesizeIcon - "
                  + "Failure creating temp icon"
                  + " (" + e + ")");
    }
  },

  onTmpIconWritten : function(result) {
    if (!Components.isSuccessCode(result)) {
      console.log("APPS | nativeshell.mac | synthesizeIcon - "
                  + "Failure writing temporary icon file "
                  + " (" + result + ")");
      return;
    }

    try {
    var process = Cc["@mozilla.org/process/util;1"]
                  .createInstance(Ci.nsIProcess);
    var sipsFile = Cc["@mozilla.org/file/local;1"]
                  .createInstance(Ci.nsILocalFile);
    sipsFile.initWithPath("/usr/bin/sips");
    process.init(sipsFile);
    process.runAsync(["-s",
                      "format", "icns",
                      filePath.path,
                      "--out", this.iconFile.path,
                      "-z", "128", "128"],
                      9);
    } catch(e) {
      console.log("APPS | nativeshell.mac | synthesizeIcon - "
                  + "Failure writing icon file"
                  + " (" + e + ")");
      return;
    }
  }
}



/* Jetpack specific export */
if (typeof exports !== "undefined")
    exports.NativeShell = NativeShell;
