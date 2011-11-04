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

//needs to be async!  should be using some form of copyFile
function embedInstallRecord(app, destinationDir) {
  //write the contents of the app (install record), json-ified, into the specified file.
  destinationDir.append("installrecord.json");
  try {
    let installRecString = JSON.stringify(app);
    let textwriter = file.open(destinationDir.path, "w"); 
    textwriter.write(installRecString);
    textwriter.close();
  } catch (e) {
    console.log("error writing installrecord : " + e + "\n");
  }
}


//used to copy in the necessary js files to include so we can call the MozApps api to do browserID stuff.
// turns out that we only really need injector.js for now
function embedMozAppsAPIFiles(destDir)
{
  //find where the jetpack addon is, and where it is keeping the necessary js files we need to copy into the native app
  var mozappsD = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
  mozappsD.append("extensions");
  mozappsD.append(self.id);
  mozappsD.append("resources");
  mozappsD.append("openwebapps-at-mozillalabs-dot-com-openwebapps-lib");

  var injectorSrc = mozappsD.clone();
  injectorSrc.append("injector.js");
  var injectorDest = destDir.clone();
  injectorDest.append("injector.js");
  console.log("injectorSrc : " + injectorSrc.path);

  copyFile(injectorSrc, injectorDest);
}


//for now, bring the entire file into memory, so we can do substitutions on it if necessary.
// obviously, this is not suitable for very large files, but it is async.
// NOTE: both inFile and outFile are nsIFile objects
// NOTE: this code should probably throw, and get caught up at the top, where we can cancel the creation of the native app
function copyFile(inFile, outFile, options) {
  
  Components.utils.import("resource://gre/modules/NetUtil.jsm");  
  Components.utils.import("resource://gre/modules/FileUtils.jsm");  
      
  NetUtil.asyncFetch(inFile, function(inputStream, status) {  
      if (!Components.isSuccessCode(status)) {  
        // Handle error!  
        console.log("ERROR: " + status + " failed to read file: " + inFile);
        return;  
      }  
      
    var outputStream = FileUtils.openSafeFileOutputStream(outFile);

    NetUtil.asyncCopy(inputStream, outputStream, function(inputStream, status) {
      if (!Components.isSuccessCode(status)) {  
        // Handle error!  
        console.log("ERROR: " + status + " failed to write file: " + outFile);
        return;  
      } 
    });        
  });  

}

function recursiveFileCopy(srcDir,
                           leaf,
                           dstDir,
                           separator,
                           substitutions,
                           specialFiles,
                           perFileCallback,
                           perDirectoryCallback)
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
                        newSpecialFiles,
                        perFileCallback,
                        perDirectoryCallback);
    }

    if(perDirectoryCallback) {
      perDirectoryCallback(dest);
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

      try {
        let inputStream = file.open(srcFile, fileProperties["mode"]);
        let fileContents = inputStream.read();
        inputStream.close();
        let finalContents;
        if(fileProperties["substituteStrings"]) {
          finalContents = substituteStrings(fileContents, substitutions);
        } else {
          finalContents = fileContents;
        }
        let outputStream = file.open(dest, "w" + fileProperties["mode"]);
        outputStream.write(finalContents);
        outputStream.close();

        if(perFileCallback) {
          perFileCallback(dest);
        }
      } catch(e) {
        throw("recursiveFileCopy - "
            + "Failed copying file from "
            + srcFile
            + " to "
            + dest
            + " (" + e + ")");
      }
    }
  }
}

const WEB_APPS_DIRNAME = "Web Apps";

// Windows implementation
//
// Our Windows strategy:
//    Copy our XUL app and generic launcher to this dir on user's machine:
//                    "%LOCALAPPDATA%\Web Apps"

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
                         ctypes.int(10) // SW_SHOWDEFAULT
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

function winExpandVars(toExpand)
{
  try {
    components.utils.import("resource://gre/modules/ctypes.jsm");
  } catch(e) {
    throw("winExpandVars - "
          + "Failure importing ctypes (" + e + ")");
  }

  let kernel32;
  try {
    kernel32 = ctypes.open("Kernel32");
  } catch(e) {
    throw("winExpandVars - "
          + "Failed to open Kernel32 (" + e + ")");
  }

  try {
    try {
      const DWORD = ctypes.uint32_t;
      const WCHAR = ctypes.jschar;
      const MAX_PATH = 260;
      const outStrType = ctypes.ArrayType(WCHAR);
    } catch(e) {
      throw("winExpandVars - "
            + "Failure setting up constants (" + e + ")");
    }

    let expandEnvironmentStrings;
    try {
      expandEnvironmentStrings = kernel32.declare("ExpandEnvironmentStringsW",
                                                  ctypes.default_abi,
                                                  DWORD,
                                                  WCHAR.ptr,
                                                  WCHAR.ptr,
                                                  DWORD);
    } catch(e) {
      throw("winExpandVars - "
            + "Failure declaring ExpandEnvironmentStringsW (" + e + ")");
    }

    let ret;
    let out;
    try {
      let cstr = ctypes.jschar.array()(toExpand);
      out = new outStrType(MAX_PATH);
      ret = expandEnvironmentStrings(cstr, out, MAX_PATH);
    } catch(e) {
      throw("winExpandVars - "
            + "Failure calling ExpandEnvironmentStringsW (" + e + ")");
    }
    if(0 === ret) {
      throw("winExpandVars - "
            + "Error in ExpandEnvironmentStringsW (" + ret + ")");
    } else {
      return out.readString();
    }
  } finally {
    try {
      kernel32.close();
    } catch (e) {
      console.log("APPS | nativeshell.win | winExpandVars - "
                  + "Failure trying to close Kernel32 (" + e + ")");
    }
  }
}

WinNativeShell.prototype = {

  createAppNativeLauncher : function(app)
  {
    this.createExecutable(app);
  },

  createExecutable : function(app)
  {
    let baseDir = "%LOCALAPPDATA%\\" + WEB_APPS_DIRNAME;

    try {
      baseDir = winPathify(winExpandVars(baseDir));
      var filePath = baseDir + "\\" + winFilenameify(app.manifest.name);
      var launchPath = app.origin;
      if (app.manifest.launch_path) {
        launchPath += app.manifest.launch_path;
      }
    } catch(e) {
      throw("createExecutable - Failure setting up paths (" + e + ")");
    }

    let iconPath = filePath
                   + "\\XUL\\chrome\\icons\\default\\"
                   + app.manifest.name
                   + ".ico";

    try {
      if (file.exists(filePath))
      {
        // recursive delete
        let aNsLocalFile = Cc['@mozilla.org/file/local;1']
                           .createInstance(Ci.nsILocalFile);
        aNsLocalFile.initWithPath(filePath);
        aNsLocalFile.remove(true);
      }

      if(file.exists(baseDir + "\\install.exe")) {
        file.remove(baseDir + "\\install.exe");
      }

      file.mkpath(baseDir);
      file.mkpath(filePath);
      file.mkpath(filePath + "\\XUL");
      file.mkpath(file.dirname(iconPath));
    } catch(e) {
      throw("createExecutable - "
            + "Failure setting up target location (" + e + ")");
    }

    // TODO: Ask user whether to create desktop/start menu shortcuts
    let substitutions = {
      "\\$APPNAME": app.manifest.name,
      "\\$APPDOMAIN": app.origin,
      "\\$LAUNCHPATH": launchPath,
      "\\$INSTALLDIR": baseDir,
      "\\$ICONPATH": iconPath,
      "\\$DESKTOP_SHORTCUT": "y",
      "\\$SM_SHORTCUT": "y"
    }

    let fileWriter;
    try {
      fileWriter = file.open(filePath + "\\uninstall-files.dat", "w");
      fileWriter.writeLine = function(toWrite) {
        fileWriter.write(toWrite.slice(filePath.length + 1) + "\n");
      };
    } catch(e) {
      throw("createExecutable - "
            + "Failure setting up uninstall-files.dat (" + e + ")");
    }

    try {
      let dirWriter;
      try {
        dirWriter = file.open(filePath + "\\uninstall-dirs.dat", "w");
        dirWriter.writeLine = function(toWrite) {
          let modifiedLine = toWrite.slice(filePath.length + 1);
          if(modifiedLine) {
            dirWriter.write(modifiedLine + "\n");
          }
        };
      } catch(e) {
        throw("createExecutable - "
            + "Failure setting up uninstall-dirs.dat (" + e + ")");
      }

      try {
        recursiveFileCopy("native-install/windows/installer",
            "",
            baseDir,
            "\\",
            substitutions,
            undefined,
            undefined,
            undefined);

        recursiveFileCopy("native-install/windows/app",
            "",
            filePath,
            "\\",
            substitutions,
            undefined,
            fileWriter.writeLine,
            dirWriter.writeLine);

        recursiveFileCopy("native-install/XUL",
            "",
            filePath + "\\XUL",
            "\\",
            substitutions,
            undefined,
            fileWriter.writeLine,
            dirWriter.writeLine);

        this.synthesizeIcon(app, iconPath);

        //////////////////////////////////////////////
        //this code should be cross-platform   
        var XULDir = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
        XULDir.initWithPath(filePath);
        XULDir.append("XUL");
        var contentDir = XULDir.clone();
        contentDir.append("content");

        //add the install record to the native app bundle
        embedInstallRecord(app, XULDir);
        //add injector.js, which we need to inject some apis into the webapp content page
        embedMozAppsAPIFiles(contentDir);
        /////////////////////////////////////////////

        fileWriter.writeLine(filePath + "\\installrecord.json");
      } catch(e) {
        throw("createExecutable - "
              + "Failure copying files (" + e + ")");
      } finally {
        dirWriter.close();
      }
    } finally {
      fileWriter.close();
    }

    try {
      winRunApp(baseDir + "\\install.exe",
                "-appName=" + app.manifest.name
                + " -appURL=" + launchPath
                + " -appDesc=No description"
                + " -iconPath=" + iconPath
                + " -createDesktopShortcut=y"
                + " -createStartMenuShortcut=y"
                + " /S",
                filePath);
    } catch (e) {
      throw("createExecutable - "
            + "Failure running installer (" + e + ")");
    }
  },

  synthesizeIcon : function(app, destinationFile)
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
    let netutil={};

    try {
      Cu.import("resource://gre/modules/NetUtil.jsm", netutil);
      netutil.NetUtil.asyncFetch(icon, function(inputStream,
                                                    resultCode,
                                                    request) {
        // It's probably not wise to throw inside this callback
        // since we don't know how the calling code will handle the exception.
        // Instead we just log errors and return.
        if (!components.isSuccessCode(resultCode)) {
          console.log("APPS | nativeshell.win | synthesizeIcon - "
                      + "Error retrieving icon from path " + icon
                      + " (result code = " + resultCode + ")");
          return;
        }

        let mimeType;
        try {
          // TODO: Come up with a smarter way to determine MIME type
          if (icon.indexOf(".png") > 0) {
            mimeType = "image/png";
          } else if ((icon.indexOf(".jpeg") > 0)
            || (icon.indexOf(".jpg") > 0)) {
            mimeType = "image/jpeg";
          }
        } catch(e) {
          console.log("APPS | nativeshell.win | synthesizeIcon - "
                      + "Failure determining MIME type of " + icon
                      + " (" + e + ")");
          return;
        }

        let icoStream;
        try {
          imgTools = Cc["@mozilla.org/image/tools;1"]
                     .createInstance(Ci.imgITools);
          let imgContainer = { value: null };
          imgTools.decodeImageData(inputStream, mimeType, imgContainer);
          icoStream =
              imgTools.encodeImage(imgContainer.value,
                                   "image/vnd.microsoft.icon");
        } catch (e) {
          console.log("APPS | nativeshell.win | synthesizeIcon - "
                      + "Failure converting icon " + icon
                      + " (" + e + ")");
          return;
        }

        // TODO: Smarter (async) writing of ico
        let icoFileWriter;
        try {
          icoFileWriter = file.open(destinationFile, "wb");
        } catch(e) {
          console.log("APPS | nativeshell.win | synthesizeIcon - "
                      + "Unable to open file " + destinationFile + " for writing"
                      + " (" + e + ")");
          return;
        }

        try{
          let icoBinaryStream = Cc["@mozilla.org/binaryinputstream;1"]
                                .createInstance(Ci.nsIBinaryInputStream);
          icoBinaryStream.setInputStream(icoStream);

          let contents = icoBinaryStream
                         .readBytes(icoBinaryStream.available());

          icoFileWriter.write(contents);
        } catch (e) {
          console.log("APPS | nativeshell.win | synthesizeIcon - "
                      + "Failure writing icon file " + destinationFile
                      + " (" + e + ")");
          return;
        } finally {
          icoFileWriter.close();
        }
      });
    } catch(e) {
      throw("synthesizeIcon - Failure setting up asynchronous fetch of "
            + icon);
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

  createExecutable : function(app)
  {
    var baseDir = "/Applications/" + WEB_APPS_DIRNAME;
    if (!file.exists(baseDir))
    {
      file.mkpath(baseDir);
    }

    var filePath = baseDir + "/" + sanitizeMacFileName(app.manifest.name) + ".app";
    if (file.exists(filePath))
    {
      // recursive delete
      var aNsLocalFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
      aNsLocalFile.initWithPath(filePath);
      aNsLocalFile.remove(true);
    }
    
    // Now we synthesize a .app by copying the mac-app-template directory from our internal state
    var launchPath = app.origin;
    if (app.manifest.launch_path) {
      launchPath += app.manifest.launch_path;
    }

    let substitutions = {
      "\\$APPNAME": app.manifest.name,
      "\\$APPDOMAIN": app.origin,
      "\\$APPDOMAIN_REVERSED": reverseDNS(app.origin),
      "\\$LAUNCHPATH": launchPath
    }
    file.mkpath(filePath);

      recursiveFileCopy("native-install/mac",
                           "",
                           filePath,
                           "/",
                           substitutions);

      recursiveFileCopy("native-install/XUL",
                           "",
                           filePath + "/XUL",
                           "/",
                           substitutions);

    //////////////////////////////////////////////
    //this code should be cross-platform   
    var XULDir = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
    XULDir.initWithPath(filePath);
    XULDir.append("XUL");
    var contentDir = XULDir.clone();
    contentDir.append("content");

    //add the install record to the native app bundle
    embedInstallRecord(app, XULDir);
    //add injector.js, which we need to inject some apis into the webapp content page
    embedMozAppsAPIFiles(contentDir);
    /////////////////////////////////////////////

    this.synthesizeIcon(app, filePath + "/Contents/Resources/appicon.icns");
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
      var netutil={};
      Cu.import("resource://gre/modules/NetUtil.jsm", netutil);
      //dump("APPS | createExecutable | Retrieving icon from " + iconPath + "\n");
      netutil.NetUtil.asyncFetch(iconPath, function(inputStream, resultCode, request) {
        try {
          if (!components.isSuccessCode(resultCode)) {
            // Handle error
            dump("APPS | createExecutable | Unable to get icon - error during request\n");
            return;
          } else {
            netutil.NetUtil.asyncCopy(inputStream, ostream, function(aResult) {
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
