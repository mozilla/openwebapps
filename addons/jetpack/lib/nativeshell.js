const {components, Cc, Cu, Ci} = require("chrome");
const file = require("file");
const self = require("self");
const url = require("url");



NativeShell = (function() {

  function CreateNativeShell(domain, appManifest)
  {
    // TODO: Select Mac or Windows
    new MacNativeShell().createAppNativeLauncher(domain, appManifest);
    //new WinNativeShell().createAppNativeLauncher(domain, appManifest);
  }

  return {
    CreateNativeShell: CreateNativeShell
  }
})();

function substituteStrings(inputString, substituteStrings)
{
  var working = inputString;
  for (var key in substituteStrings) {
    working = working.replace("$" + key, substituteStrings[key], "g"); //note that 'g' is non-standard
  }
  return working;
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


function winRecursiveFileCopy(sourceBase, sourcePath, destPath, substitutions)
{
  console.log("APPS | nativeshell.win | winRecursiveFileCopy - "
               + "\nsourceBase=" + sourceBase
               + "\nsourcePath=" + sourcePath
               + "\ndestPath=" + destPath);
  var srcFile = (url.toFilename(self.data.url(sourceBase + "/" + sourcePath))).replace("/","\\","g");

  console.log("APPS | nativeshell.win | winRecursiveFileCopy - " + srcFile);
  if (file.exists(srcFile))
  {
    // How do we tell if this is a directory?  Try to list() it 
    // and catch exceptions.
    var isDirectory=false, dirContents;
    try {
      dirContents = file.list(srcFile);
      isDirectory = true;
      console.log("APPS | nativeshell.win | winRecursiveFileCopy - IS a directory");
    } catch (cannotListException) {
      console.log("APPS | nativeshell.win | winRecursiveFileCopy - IS NOT a directory");
    }
    
    if (isDirectory) 
    {    
      var dstFile = destPath + "\\" + sourcePath.replace("/","\\","g");
      console.log("APPS | nativeshell.win | winRecursiveFileCopy - creating directory " + dstFile);
      file.mkpath(dstFile);
      console.log("APPS | nativeshell.win | winRecursiveFileCopy - directory created");

      for (var i=0; i < dirContents.length; i++)
      {
        winRecursiveFileCopy(sourceBase, sourcePath + "/" + dirContents[i], destPath, substitutions);
      }
    } else {
      // Assuming textmode for everything - do we need any binaries?
      var dstFile = destPath + "\\" + (substituteStrings(sourcePath, substitutions)).replace("/","\\", "g");
      console.log("APPS | nativeshell.win | winRecursiveFileCopy - dstFile=" + dstFile);

      // BIG HACK
      var binaryMode = false;
      if (sourcePath.indexOf("foxlauncher") >= 0)
      {
        // Some shenanigans here to set the executable bit:
        var aNsLocalFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
        aNsLocalFile.initWithPath(dstFile);
        aNsLocalFile.create(aNsLocalFile.NORMAL_FILE_TYPE, 0x1ed); // octal 755
        binaryMode = true;
      }
      var inputStream = file.open(srcFile, "r" + (binaryMode ? "b" : ""));
      var fileContents = inputStream.read();
      var finalContents;
      if (!binaryMode) {
        finalContents = substituteStrings(fileContents, substitutions);
      } else {
        finalContents = fileContents;
      }
      var outputStream = file.open(dstFile, "w" + (binaryMode ? "b" : ""));
      outputStream.write(finalContents);
      outputStream.close();
    }
  }
}

// XXX TODO use platform appropriate file divider everywhere!!!!!!

function recursiveFileCopy(sourceBase, sourcePath, destPath, substitutions)
{
  var srcFile = url.toFilename(self.data.url(sourceBase + "/" + sourcePath));
  if (file.exists(srcFile))
  {
    // How do we tell if this is a directory?  Try to list() it 
    // and catch exceptions.
    var isDirectory=false, dirContents;
    try {
      dirContents = file.list(srcFile);
      isDirectory = true;
    } catch (cannotListException) {
    }
    
    if (isDirectory) 
    {    
      var dstFile = destPath + "/" + sourcePath;
      file.mkpath(dstFile);
      
      for (var i=0; i < dirContents.length; i++)
      {
        recursiveFileCopy(sourceBase, sourcePath + "/" + dirContents[i], destPath, substitutions);
      }
    } else {
      // Assuming textmode for everything - do we need any binaries?
      var dstFile = destPath + "/" + substituteStrings(sourcePath, substitutions);

      // BIG HACK
      var binaryMode = false;
      if (sourcePath.indexOf("foxlauncher") >= 0)
      {
        // Some shenanigans here to set the executable bit:
        var aNsLocalFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
        aNsLocalFile.initWithPath(dstFile);
        aNsLocalFile.create(aNsLocalFile.NORMAL_FILE_TYPE, 0x1ed); // octal 755
        binaryMode = true;
      }
      var inputStream = file.open(srcFile, "r" + (binaryMode ? "b" : ""));
      var fileContents = inputStream.read();
      var finalContents;
      if (!binaryMode) {
        finalContents = substituteStrings(fileContents, substitutions);
      } else {
        finalContents = fileContents;
      }
      var outputStream = file.open(dstFile, "w" + (binaryMode ? "b" : ""));
      outputStream.write(finalContents);
      outputStream.close();
    }
  }
}


const WEB_APPS_DIRNAME = "Web Apps";

// Windows implementation
//
// Our Windows strategy:
//    Copy our XUL app and generic launcher to user's machine
//       Currently C:\Web Apps, eventually %APPDATA%
//    TODO: Add registry entry for Add/Remove programs
//    TODO: Create shortcut somewhere useful (desktop?)
//    TODO: Update exe resources with correct icon

function WinNativeShell() {

}

// TODO: Pretty sure we can ask the OS to do this for us with
// js-ctypes and a system call
function sanitizeWinFileName(path)
{
  return path.replace(":", "-").replace("/", "-");
}

WinNativeShell.prototype = {

  createAppNativeLauncher : function(app)
  {
    console.log("APPS | nativeshell.Win | Creating app native launcher");
    this.createExecutable(app);
  },

  createExecutable : function(app)
  {
    // TODO: baseDir should point to %APPDATA%\WEB_APPS_DIRNAME
    // see `ExpandEnvironmentStrings` (invoke through js-ctypes)
    //   http://msdn.microsoft.com/en-us/library/ms724265.aspx
    var baseDir = "C:\\" + WEB_APPS_DIRNAME;
    console.log("APPS | nativeshell.Win | baseDir=" + baseDir);
    if (!file.exists(baseDir))
    {
      file.mkpath(baseDir);
    }

    var filePath = baseDir + "\\" + sanitizeWinFileName(app.manifest.name);
    console.log("APPS | nativeshell.Win | filePath=" + filePath);
    if (file.exists(filePath))
    {
      // recursive delete
      var aNsLocalFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
      aNsLocalFile.initWithPath(filePath);
      aNsLocalFile.remove(true);
    }
    
    var launchPath = app.origin;
    if (app.manifest.launch_path) {
      launchPath += app.manifest.launch_path;
    }
    console.log("APPS | nativeshell.Win | launchPath=" + launchPath);

    var substitutions = {
      APPNAME: app.manifest.name,
      APPDOMAIN: app.origin,
      APPDOMAIN_REVERSED: reverseDNS(app.origin),
      LAUNCHPATH: launchPath,
      APPMENUBAR: makeMenuBar(app.manifest)
    }
    file.mkpath(filePath);
    // TODO: Organize this so it's not in "mac-app-template"
    winRecursiveFileCopy("mac-app-template", "", filePath, substitutions);
    //this.synthesizeIcon(app, filePath + "/Contents/Resources/appicon.icns");
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

    var substitutions = {
      APPNAME: app.manifest.name,
      APPDOMAIN: app.origin,
      APPDOMAIN_REVERSED: reverseDNS(app.origin),
      LAUNCHPATH: launchPath,
      APPMENUBAR: makeMenuBar(app.manifest)
    }
    file.mkpath(filePath);
    recursiveFileCopy("mac-app-template", "", filePath, substitutions);
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
