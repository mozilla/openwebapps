function doHandleMenuBar(toCall)
{
    // We need to pageMod in from the faker
    // TODO pass this into content code somehow
    window.alert("Menu bar item " + toCall + " was clicked!");
    return;
}

window.addEventListener("click", function(e) {
    // Make sure clicks remain in our context
    // TODO check to see if we are in same origin?
    if (e.target.nodeName == "A") {
        e.preventDefault();
        window.location = e.target.href;
    }
}, false);



// Commands:
var appName = "$APPNAME";
function newWindow()
{
    var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                       .getService(Components.interfaces.nsIWindowWatcher);
    var win = ww.openWindow(null, "chrome://webapp/content/window.xul",
                            null, "chrome,centerscreen", null);
}




// Register the injector to add new APIs to the content windows:
try {
  var injector = {};
  Components.utils.import("chrome://webapp/content/injector.js", injector);
  
  injector.InjectorInit(window); // we inject on the XUL window and observe content-document-global-created //   theBrowser.contentWindow.wrappedJSObject); // wrappedJSObject the right thing here?
  window.appinjector.register({
    apibase: "navigator.mozApps",
    name: "amInstalled",
    script: null,
    getapi: function(contentWindowRef) {
      return function(callback) {
        
        var appDirectory = Components.classes["@mozilla.org/file/directory_service;1"].  
                                                getService(Components.interfaces.nsIProperties).  
                                                    get("CurProcD", Components.interfaces.nsIFile);  
              
        var aNsLocalFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
        aNsLocalFile.initWithFile(appDirectory);
        aNsLocalFile.appendRelativePath("installrecord.json");

        Components.utils.import("resource://gre/modules/NetUtil.jsm");  
        Components.utils.import("resource://gre/modules/FileUtils.jsm");  
            
        dump(aNsLocalFile.path + "\n");
        NetUtil.asyncFetch(aNsLocalFile, function(inputStream, status) {  
          if (!Components.isSuccessCode(status)) {  
            // Handle error!  
            console.log("ERROR: " + status + " failed to read file: " + inFile);
            return;  
          }  
          var data = NetUtil.readInputStreamToString(inputStream, inputStream.available());  
          var parsed = JSON.parse(data);
          inputStream.close();
          callback(parsed);
        });  
      }
    }
  });
  window.appinjector.inject();
} catch (e) {
    dump(e + "\n");
}
