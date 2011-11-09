dump("hello world\n");
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

  function checkNativeIdentityDaemon(callingLocation, callback, options, success, failure)
  {
    dump("CheckNativeIdentityDaemon " + callingLocation + " " + options + "\n");
    // XXX what do we do if we are not passed a requiredEmail?
    // could fail immediately, or could ask Firefox for a default somehow
    if (!options || !options.requiredEmail) failure();

    var port = 7350;
    var sockTransportService = Components.classes["@mozilla.org/network/socket-transport-service;1"]
        .getService(Components.interfaces.nsISocketTransportService);
    
    var domain = callingLocation.protocol + "//" + callingLocation.host;
    if (callingLocation.port && callingLocation.port.length > 0) callingLocation += ":" + callingLocation.port;
    var buf = "IDCHECK " + options.requiredEmail + " " + domain + "\r\n\r\n";

    var eventSink = {
        onTransportStatus: function(aTransport, aStatus, aProgress, aProgressMax) {
            if (aStatus == aTransport.STATUS_CONNECTED_TO) {
                output.write(buf, buf.length);
            } else if (aStatus == aTransport.STATUS_RECEIVING_FROM) {
                var chunk = scriptableStream.read(8192);
                if (chunk.length> 1) {
                    success(chunk);
                    return;
                } else {
                    failure();
                    return;
                }
            } else if (false /* connection refused */) {
                port++;
                attemptConnection();
            }
        }
    };

    var threadMgr = Components.classes["@mozilla.org/thread-manager;1"].getService();
    function attemptConnection() {
        if (port > 7550) {
            failure();
            return;
        }
        var transport = sockTransportService.createTransport(null, 0, "127.0.0.1", port, null);
        transport.setEventSink(eventSink, threadMgr.currentThread);
        try {
            var output = transport.openOutputStream(transport.OPEN_BLOCKING, 0, 0);
            output.write(buf, buf.length);
            var input = transport.openInputStream(transport.OPEN_BLOCKING, 0, 0);
            var scriptableStream = Components.classes["@mozilla.org/scriptableinputstream;1"]  
                                 .createInstance(Components.interfaces.nsIScriptableInputStream);  
            scriptableStream.init(input);
            alert("finished setup");
            
        } catch (e) {
            alert(e);
            port++;
            attemptConnection();
        }
    }
    attemptConnection();
  }

  window.appinjector.register({
    apibase: "navigator.id",
    name: "getVerifiedEmail",
    script: null,
    getapi: function(contentWindowRef) {
        return function(callback, options) { // XXX what is the options API going to be?
            checkNativeIdentityDaemon(contentWindowRef.location, callback, options, function(assertion) {
                // success: return to caller
                callback(assertion);
            }, function() {
                // failure: need to present BrowserID dialog
                if (!options || !options.silent) {
                    dump("OpenBrowserIDDialog\n");
                    openBrowserIDDialog(callback, options);
                } else {
                    callback(null);
                }
            });
        }
    }
  });

  window.appinjector.inject();
} catch (e) {
    dump(e + "\n");
}
