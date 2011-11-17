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
    let os = Components.classes["@mozilla.org/xre/app-info;1"]
                       .getService(Components.interfaces.nsIXULRuntime).OS;
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

function getBiggestIcon(minifest) {
  if (minifest.icons) {
    var biggest = 0;
    for (z in minifest.icons) {
      var size = parseInt(z, 10);
      if (size > biggest) biggest = size;
    }
    if (biggest !== 0) return minifest.icons[biggest];
  }
  return null;
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

// TODO: Ask OS which chars are valid in a path
function winPathify(path)
{
  const slashRE = /[\/\\]+/gi;
  return path.replace(slashRE, "\\");
}

// TODO: Ask OS which chars are valid in a filename
function winFilenameify(path)
{
  const re = /[:\/\\]+/gi;
  return path.replace(re, "-");
}

function winRunApp(filePath, commandLine, workingDir) {
  try {
    components.utils.import("resource://gre/modules/ctypes.jsm");
  } catch(e) {
    throw("winRunApp - "
          + "Failure importing ctypes (" + e + ")");
  }

  let shell32;
  try {
    shell32 = ctypes.open("Shell32");
  } catch(e) {
    throw("winRunapp - "
          + "Failed to open Shell32 (" + e + ")");
  }

  try {
    try {
      const WCHAR = ctypes.jschar;
      const HINSTANCE = ctypes.voidptr_t;
      const MAX_PATH = 260;
    } catch(e) {
      throw("winRunApp - "
            + "Failure setting up constants (" + e + ")");
    }

    let shellExecute;
    try {
      shellExecute = shell32.declare("ShellExecuteW",
                                       ctypes.default_abi,
                                       HINSTANCE,
                                       ctypes.voidptr_t, // Not used
                                       WCHAR.ptr,
                                       WCHAR.ptr,
                                       WCHAR.ptr,
                                       WCHAR.ptr,
                                       ctypes.int);
    } catch(e) {
      throw("winRunApp - "
            + "Failure declaring ShellExecuteW (" + e + ")");
    }

    let ret;
    try {
      let filePathCStr = ctypes.jschar.array()(filePath);
      let commandLineCStr =
              commandLine ? ctypes.jschar.array()(commandLine)
                          : null;
      let workingDirCStr = 
              workingDir ? ctypes.jschar.array()(workingDir)
                         : null;
      ret = shellExecute(null,
                         null,
                         filePathCStr,
                         commandLineCStr,
                         workingDirCStr,
                         ctypes.int(0) // SW_HIDE
                        );
    } catch(e) {
      throw("winRunApp - "
            + "Failure calling ShellExecuteW (" + e + ")");
    }
    if(32 >= ret) {
      throw("winRunApp - "
            + "Error in ShellExecuteW (" + ret + ")");
    }
  } finally {
    try {
      shell32.close();
    } catch (e) {
      console.log("APPS | nativeshell.win | winRunApp - "
                  + "Failure trying to close Shell32 (" + e + ")");
    }
  }
}

WinNativeShell.prototype = {
  createAppNativeLauncher : function(app)
  {
    this.createExecutable(app);
  },

  setUpPaths : function(app) {
      let env = Cc["@mozilla.org/process/environment;1"]
                .getService(Ci.nsIEnvironment);

      let installDirPath = env.get("APPDATA");
      if(!installDirPath) {
        throw("Failure looking up %APPDATA%");
      }

      this.appName = app.manifest.name;

      this.installDir = Cc['@mozilla.org/file/local;1']
                        .createInstance(Ci.nsILocalFile);
      this.installDir.initWithPath(installDirPath);
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

      this.installerDir = Cc["@mozilla.org/file/directory_service;1"]
                           .getService(Ci.nsIProperties)
                           .get("TmpD", Ci.nsIFile);
      this.installerDir.append(this.appName);

      let webRTPath = self.data.url("native-install/windows/xulrunner");
      this.webRTDir = Cc['@mozilla.org/file/local;1']
                      .createInstance(Ci.nsILocalFile);
      this.webRTDir.initWithPath(url.toFilename(webRTPath));

      this.webRTConfigFile = this.installDir.clone();
      this.webRTConfigFile.append("webRT.config");
  },

  createExecutable : function(app)
  {
    try {
      this.setUpPaths(app);
    } catch(e) {
      throw("createExecutable - Failure setting up paths (" + e + ")");
    }

    try {
      if (this.installDir.exists())
      {
        this.installDir.remove(true);
      }

      this.installDir.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
      this.iconFile.parent.create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
      this.installerDir.createUnique(Ci.nsIFile.DIRECTORY_TYPE, 0777);
    } catch(e) {
      throw("createExecutable - "
            + "Failure setting up target location (" + e + ")");
    }

    // TODO: Ask user whether to create desktop/start menu shortcuts
    let substitutions = {
      "\\$APPNAME": this.appName,
      "\\$APPDOMAIN": app.origin,
      "\\$LAUNCHPATH": this.launchPath,
      "\\$INSTALLDIR": this.installDir.path,
      "\\$ICONPATH": this.iconFile.path,
      "\\$DESKTOP_SHORTCUT": "y",
      "\\$SM_SHORTCUT": "y"
    }

    try {
      recursiveFileCopy("native-install/windows/installer",
                        "",
                        this.installerDir.path,
                        "\\",
                        substitutions,
                        undefined);

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

      let webRTConfigFileOStream
              = FileUtils.openSafeFileOutputStream(this.webRTConfigFile);
      let converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                      .createInstance(Ci.nsIScriptableUnicodeConverter);
      converter.charset = "UTF-8";
      let istream = converter.convertToInputStream(this.webRTDir.path + "\\");
      NetUtil.asyncCopy(istream,
                        webRTConfigFileOStream,
                        function(status) {
        if (!Components.isSuccessCode(status)) {
          // TODO: We should bail on the whole installation if this fails
          console.log("createExecutable - "
                      + "Failed writing WebRT location to config file");
        }
      });

      this.synthesizeIcon(app);

      //add the install record to the native app bundle
      embedInstallRecord(app, this.installDir);

      //add injector.js, which we need to inject some apis
      //into the webapp content page
      let contentDir = this.installDir.clone();
      contentDir.append("content");
      embedMozAppsAPIFiles(contentDir);
    } catch(e) {
      throw("createExecutable - "
          + "Failure copying files (" + e + ")");
    }

    try {
      let installerFile = this.installerDir.clone();
      installerFile.append("install.exe");
      winRunApp(installerFile.path,
                "-appName=" + this.appName
                + " -appURL=" + this.launchPath
                + " -appDesc=Descriptions are not yet supported"
                + " -iconPath=" + this.iconFile.path
                + " -createDesktopShortcut=y"
                + " -createStartMenuShortcut=y"
                + " /S",
                this.installDir.path);
    } catch (e) {
      throw("createExecutable - "
            + "Failure running installer (" + e + ")");
    }
  },

  synthesizeIcon : function(app)
  {
    let icon;
    try {
      icon = getBiggestIcon(app.manifest);
    } catch(e) {
      throw("synthesizeIcon - Failure reading icon information (" + e + ")");
    }

    if (icon.indexOf("data:") === 0) {
      // TODO: Add support for data URLS
      throw("synthesizeIcon - Data URLs are not yet supported");
    }

    icon = app.origin + icon;

    try {
      NetUtil.asyncFetch(icon, this.onIconDownloadComplete.bind(this));
    } catch(e) {
      throw("synthesizeIcon - Failure setting up asynchronous fetch of "
            + icon);
    }
  },

  onIconDownloadComplete : function(inputStream,
                                    resultCode,
                                    request)
  {
    // It's probably not wise to throw inside this callback
    // since we don't know how the calling code will handle the exception.
    // Instead we just log errors and return.
    if (!components.isSuccessCode(resultCode)) {
      console.log("APPS | nativeshell.win | synthesizeIcon - "
                  + "Error retrieving icon " + request.name
                  + " (result code = " + resultCode + ")");
      return;
    }

    let mimeType;
    try {
      // TODO: Come up with a smarter way to determine MIME type
      if (request.name.indexOf(".png") > 0) {
        mimeType = "image/png";
      } else if ((request.name.indexOf(".jpeg") > 0)
                || (request.name.indexOf(".jpg") > 0)) {
        mimeType = "image/jpeg";
      }
    } catch(e) {
      console.log("APPS | nativeshell.win | synthesizeIcon - "
                  + "Failure determining MIME type of " + request.name
                  + " (" + e + ")");
      return;
    }

    let icoStream;
    try {
      let imgTools = Cc["@mozilla.org/image/tools;1"]
                     .createInstance(Ci.imgITools);
      let imgContainer = { value: null };
      imgTools.decodeImageData(inputStream, mimeType, imgContainer);
      icoStream =
        imgTools.encodeImage(imgContainer.value,
                             "image/vnd.microsoft.icon");
    } catch (e) {
      console.log("APPS | nativeshell.win | synthesizeIcon - "
                  + "Failure converting icon " + request.name
                  + " (" + e + ")");
      return;
    }

    try {
      let outputStream = FileUtils.openSafeFileOutputStream(this.iconFile);
      NetUtil.asyncCopy(icoStream,
                        outputStream,
                        this.onIconConversionComplete.bind(this));
    } catch (e) {
      console.log("APPS | nativeshell.win | synthesizeIcon - "
          + "Failure writing icon file " + this.iconFile.path
          + " (" + e + ")");
      return;
    }
  },

  onIconConversionComplete : function(status)
  {
    if (!Components.isSuccessCode(status)) {
      console.log("APPS | nativeshell.win | synthesizeIcon - "
          + "Failure writing icon file " + this.iconFile.path
          + " (" + status + ")");
    } else {
      try {
        let reditFile = this.webRTDir.clone();
        reditFile.append("redit.exe");

        let exeFile = this.installDir.clone();
        exeFile.append(this.appName + ".exe");

        winRunApp(reditFile.path,
            "\"" + exeFile.path + "\""
            + " \"" + this.iconFile.path + "\"",
            this.installDir.path);
      } catch (e) {
        console.log("APPS | nativeshell.win | synthesizeIcon - "
            + "Failure setting icon resource"
            + " (" + e + ")");
      }
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

    this.synthesizeIcon(app, this.installDir.path + "/Contents/Resources/appicon.icns");
  },
  

  synthesizeIcon : function(app, destinationFile)
  {
    var icon = getBiggestIcon(app.manifest);

    // write the image into a temp file and convert it
    var filePath = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).
               get("TmpD", Ci.nsIFile);
    //dump("APPS | nativeshell.mac | Got temporary path " + filePath + "\n");

    if (icon.indexOf("data:") === 0) {

      // Guess the file type
      var tIndex = icon.indexOf(";");
      var type = icon.substring(5, tIndex);
      //dump("APPS | nativeshell.mac | type is " + type + "\n");

      var tSuffix="";
      if (type.indexOf("/png") > 0) tSuffix = ".png";
      else if (type.indexOf("/jpeg") > 0) tSuffix = ".jpg";
      else if (type.indexOf("/jpg") > 0) tSuffix = ".jpg";
      filePath.append("tmpicon" + tSuffix);

      // Decode base64
      var base64 = icon.indexOf("base64,");
      if (base64 < 0) {
        dump("Non-base64 data URLs are not supported!\n");
        return;
      }
      var data = icon.substring(base64 + 7);
      const AppShellService = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService);
      var decoded = AppShellService.hiddenDOMWindow.atob(String(data));
      
      // Stream data into it
      filePath.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
      //dump("APPS | nativeshell.mac | Creating temporary icon at " + filePath.path + "\n");

      var stream = Cc["@mozilla.org/network/safe-file-output-stream;1"].
                   createInstance(Ci.nsIFileOutputStream);
      stream.init(filePath, 0x04 | 0x08 | 0x20, 0600, 0); // readwrite, create, truncate
                  
      stream.write(decoded, decoded.length);
      if (stream instanceof Ci.nsISafeOutputStream) {
          stream.finish();
      } else {
          stream.close();
      }
      var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
      var sipsFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
      sipsFile.initWithPath("/usr/bin/sips");
      process.init(sipsFile);
      process.runAsync(["-s", "format", "icns", filePath.path, "--out", destinationFile, "-z", "128", "128"], 9);

    } else {
      // Make temp file:
      var tSuffix="";
      if (icon.indexOf(".png") > 0) tSuffix = ".png";
      else if (icon.indexOf(".jpeg") > 0) tSuffix = ".jpg";
      else if (icon.indexOf(".jpg") > 0) tSuffix = ".jpg";
      filePath.append("tmpicon" + tSuffix);
      filePath.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);
      //dump("APPS | nativeshell.mac | Creating temporary icon at " + filePath.path + "\n");
      var ostream = Cc["@mozilla.org/network/safe-file-output-stream;1"].
                   createInstance(Ci.nsIFileOutputStream);
      ostream.init(filePath, 0x04 | 0x08 | 0x20, 0600, 0); // readwrite, create, truncate

      // Go get it:
      var iconPath = app.origin + icon;
      //dump("APPS | createExecutable | Retrieving icon from " + iconPath + "\n");
      NetUtil.asyncFetch(iconPath, function(inputStream, resultCode, request) {
        try {
          if (!components.isSuccessCode(resultCode)) {
            // Handle error
            dump("APPS | createExecutable | Unable to get icon - error during request\n");
            return;
          } else {
            NetUtil.asyncCopy(inputStream, ostream, function(aResult) {
              if (ostream instanceof Ci.nsISafeOutputStream) {
                  ostream.finish();
              } else {
                  ostream.close();
              }
              var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
              var sipsFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
              sipsFile.initWithPath("/usr/bin/sips");
              process.init(sipsFile);
              process.runAsync(["-s", "format", "icns", filePath.path, "--out", destinationFile, "-z", "128", "128"], 9);
            })

          }
        } catch (e) {
          dump("ERROR : " + e + "\n");
        }
      });

    }
  },
}



/* Jetpack specific export */
if (typeof exports !== "undefined")
    exports.NativeShell = NativeShell;
