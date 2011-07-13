const {Cc, Cu, Ci} = require("chrome");
const file = require("file");
const self = require("self");
const url = require("url");



NativeShell = (function() {

  function CreateNativeShell(domain, appManifest)
  {
    new MacNativeShell().createAppNativeLauncher(domain, appManifest);
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
  if (!'experimental' in manifest) return "";
  if (!'menubar' in manifest.experimental) return "";

  let toolbox = '<toolbox collapsed="true"><menubar id="main-bar">';
  for (let key in manifest.experimental.menubar) {
    toolbox += '<menu label="' + key + '"><menupopup>';
    for (let option in manifest.experimental.menubar[key]) {
      toolbox += '<menuitem label="' + option + '"/>';
    }
    toolbox += '</menupopup></menu>';
  }
  toolbox += '</menubar></toolbox>';

  return toolbox;
}

// XXX TODO use platform appropriate file divider everywhere!!!!!!

function recursiveFileCopy(sourceBase, sourcePath, destPath, substitutions)
{
  dump("APPS | recursiveFileCopy | sourcePath is " + sourcePath + "\n");
  var srcFile = url.toFilename(self.data.url(sourceBase + "/" + sourcePath));
  dump("APPS | recursiveFileCopy | srcFile is " + srcFile + "\n");
  if (file.exists(srcFile))
  {
    dump("APPS | recursiveFileCopy | file exists\n");
  
    // How do we tell if this is a directory?  Try to list() it 
    // and catch exceptions.
    var isDirectory=false, dirContents;
    try {
      dirContents = file.list(srcFile);
      dump("APPS | recursiveFileCopy | isDirectory\n");
      isDirectory = true;
    } catch (cannotListException) {
      dump("APPS | recursiveFileCopy | is not directory\n");
    }
    
    if (isDirectory) 
    {    
      dump("APPS | recursiveFileCopy | create target directory; destPath is " + destPath + ", sourcePath is " + sourcePath + "\n");
      var dstFile = destPath + "/" + sourcePath;
      dump("APPS | recursiveFileCopy | create " + dstFile + "\n");
      file.mkpath(dstFile);
      
      for (var i=0; i < dirContents.length; i++)
      {
        dump("APPS | recursiveFileCopy | iterate to " + dirContents[i] + "\n");
        recursiveFileCopy(sourceBase, sourcePath + "/" + dirContents[i], destPath, substitutions);
      }
    } else {
      // Assuming textmode for everything - do we need any binaries?
      var dstFile = destPath + "/" + substituteStrings(sourcePath, substitutions);
      dump("APPS | recursiveFileCopy | copy " + srcFile + " to " + dstFile + "\n");


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


// Mac implementation
//
// Our Mac strategy for now is to create a .webloc file and
// to put the app icon on it.  We also create a "Web Apps"
// subfolder in the Applications folder.
//
// This does _not_ give us document opening (boo) but it will
// interact reasonably with the Finder and the Dock

const WEB_APPS_DIRNAME = "Web Apps";

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
    //this.synthesizeIcon(app, filePath + "/Contents/Resources/appicon.icns");
  },
  
  synthesizeIcon : function(app)
  {
    var icon = getBiggestIcon(app.manifest);
    var iconPath;
    if (icon.indexOf("data:") === 0) {
      // write the image into a temp file and convert it
      var fileutils={};
      Cu.import("resource://gre/modules/FileUtils.jsm", fileutils);

      var filePath = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).
                 get("TmpD", Ci.nsIFile);
                 
      // Guess the file type
      var tIndex = icon.indexOf(";");
      var type = icon.substring(5, tIndex);
      var tSuffix="";
      if (type.indexOf("/png")) tSuffix = ".png";
      else if (type.indexOf("/jpeg")) tSuffix = ".jpg";
      else if (type.indexOf("/jpg")) tSuffix = ".jpg";
      filePath.append("tmpicon" + tSuffix);

      // Decode base64
      var base64 = icon.indexOf("base64,");
      if (base64 < 0) {
        dump("Non-base64 data URLs are not supported!\n");
        return;
      }
      var data = icon.substring(base64 + 7);
      var decoded = atob(data);
      
      // Stream data into it
      var aFile = Cc["@mozilla.org/file/local;1"].
                  createInstance(Ci.nsILocalFile);
      aFile.initWithPath(filePath);
      aFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0600);

      var stream = Cc["@mozilla.org/network/safe-file-output-stream;1"].
                   createInstance(Ci.nsIFileOutputStream);
      stream.init(aFile, 0x04 | 0x08 | 0x20, 0600, 0); // readwrite, create, truncate
                  
      stream.write(decoded, decoded.length);
      if (stream instanceof Ci.nsISafeOutputStream) {
          stream.finish();
      } else {
          stream.close();
      }

      //"sips -s format icns /path/to/png --out " + filePath + "/Contents/Resources/appicon.icns";
      //iconPath = icon;

    } else {
      iconPath = app.origin + icon;    
      var netutil;
      Cu.import("resource://gre/modules/NetUtil.jsm", netutil);
      netutil.asyncFetch(iconPath, function(inputStream, resultCode, request) {
        if (!Cc.isSuccessCode(aResult)) {
          // Handle error
          dump("APPS | createExecutable | Unable to get icon\n");
          return;
        } else {
          
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
    dump("Called setIcon; got " + ret + "\n"); 
  }
}



/* Jetpack specific export */
if (typeof exports !== "undefined")
    exports.NativeShell = NativeShell;
