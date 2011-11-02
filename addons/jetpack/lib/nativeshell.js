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
  function CreateNativeShell(domain, appManifest)
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
      nativeShell.createAppNativeLauncher(domain, appManifest);
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

function makeMenuBar(manifest)
{
  if (!('experimental' in manifest)) return "";
  if (!('menubar' in manifest.experimental)) return "";

  let toolbox = '<toolbox collapsed="true"><menubar id="main-bar">';
  for (let key in manifest.experimental.menubar) {
    toolbox += '<menu label="' + key + '"><menupopup>';
    for (let option in manifest.experimental.menubar[key]) {
      toolbox += '<menuitem label="' + option + '" ' +
        'oncommand="doHandleMenuBar(\'' +
        manifest.experimental.menubar[key][option] +
        '\');"/>';
    }
    toolbox += '</menupopup></menu>';
  }
  toolbox += '</menubar></toolbox>';

  return toolbox;
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

function winGetTempFilename()
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

    } catch(e) {
      throw("createExecutable - "
            + "Failure setting up target location (" + e + ")");
    }

    // TODO: Ask user whether to create desktop/start menu shortcuts
    let substitutions = {
      "\\$APPNAME": app.manifest.name,
      "\\$APPDOMAIN": app.origin,
      "\\$LAUNCHPATH": launchPath,
      "\\$APPMENUBAR": makeMenuBar(app.manifest),
      "\\$INSTALLDIR": baseDir,
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
    // TODO: Get icon for use with Windows
  }
}



// Mac implementation
//
// Our Mac strategy for now is to create a .webloc file and
// to put the app icon on it.  We also create a "Web Apps"
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
      "\\$LAUNCHPATH": launchPath,
      "\\$APPMENUBAR": makeMenuBar(app.manifest)
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

    this.synthesizeIcon(app, filePath + "/Contents/Resources/appicon.icns");
  },
  
  synthesizeIcon : function(app, destinationFile)
  {
    var icon = getBiggestIcon(app.manifest);

    // write the image into a temp file and convert it
    var filePath = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).
               get("TmpD", Ci.nsIFile);
    dump("APPS | nativeshell.mac | Got temporary path " + filePath + "\n");

    if (icon.indexOf("data:") === 0) {

      // Guess the file type
      var tIndex = icon.indexOf(";");
      var type = icon.substring(5, tIndex);
      dump("APPS | nativeshell.mac | type is " + type + "\n");

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
      dump("APPS | nativeshell.mac | Creating temporary icon at " + filePath.path + "\n");

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
      dump("APPS | nativeshell.mac | Creating temporary icon at " + filePath.path + "\n");
      var ostream = Cc["@mozilla.org/network/safe-file-output-stream;1"].
                   createInstance(Ci.nsIFileOutputStream);
      ostream.init(filePath, 0x04 | 0x08 | 0x20, 0600, 0); // readwrite, create, truncate

      // Go get it:
      var iconPath = app.origin + icon;    
      var netutil={};
      Cu.import("resource://gre/modules/NetUtil.jsm", netutil);
      dump("APPS | createExecutable | Retrieving icon from " + iconPath + "\n");
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
    //"sips -s format icns /path/to/png --out " + filePath + "/Contents/Resources/appicon.icns";
  },
  
  createWebLocFile: function(app)
  {
    var baseDir = "/Applications/" + WEB_APPS_DIRNAME;
    if (!file.exists(baseDir))
    {
      file.mkpath(baseDir);
    }

    var filePath = baseDir + "/" + sanitizeMacFileName(app.manifest.name) + ".webloc";
    if (file.exists(filePath))
    {
      file.remove(filePath);
    }
    var fileWriter = file.open(filePath, "w");
    var launchPath = app.origin;
    if (app.manifest.launch_path) {
      launchPath += app.manifest.launch_path;
    }
    fileWriter.write("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" + 
        "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n" + 
        "<plist version=\"1.0\">\n" + 
        "<dict>\n" + 
        "    <key>URL</key>\n" + 
        "    <string>" + launchPath + "</string>\n" + 
        "</dict>\n" + 
        "</plist>\n");
    fileWriter.close();

    // THEN: set the icon
    // var lib = ct.ctypes.open(self.data.url("iconsetter.a"));

    var ct = {};
    Cu.import("resource://gre/modules/ctypes.jsm", ct);
    var lib = ct.ctypes.open("/Users/michaelhanson/Projects/openwebapps/addons/jetpack/data/libiconsetter.dylib");
    var setIcon = lib.declare("setIcon", ct.ctypes.default_abi, ct.ctypes.int, ct.ctypes.ArrayType(ct.ctypes.char), ct.ctypes.ArrayType(ct.ctypes.char));
    
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
    var icon = getBiggestIcon(app.manifest);
    var iconPath;
    if (icon.indexOf("data:") === 0) {
      iconPath = icon;
    } else {
      iconPath = app.origin + icon;    
    }
    var ret = setIcon(filePath, iconPath); // Will invoke NSURL resolution, could hang out for a LONG time
  }
}



/* Jetpack specific export */
if (typeof exports !== "undefined")
    exports.NativeShell = NativeShell;
