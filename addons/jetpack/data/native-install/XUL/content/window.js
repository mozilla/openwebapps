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
  
  function getInstallRecord(cb) {
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
        cb(parsed);
    });
  }

  injector.InjectorInit(window); // we inject on the XUL window and observe content-document-global-created //   theBrowser.contentWindow.wrappedJSObject); // wrappedJSObject the right thing here?
  window.appinjector.register({
    apibase: "navigator.mozApps",
    name: "amInstalled",
    script: null,
    getapi: function(contentWindowRef) {
      return function(callback) {
        getInstallRecord(callback);
      }
    }
  });

  window.appinjector.register({
    apibase: "navigator.mozApps",
    name: "verifyReceipt",
    script: null,
    getapi: function(contentWindowRef) {
        return function(options, cb, verifyOnly) {
            getInstallRecord(function(record) {
                if (!record) {
                    cb({"error": "Invalid Receipt"});
                    return;
                }

                function base64urldecode(arg) {
                    var s = arg;
                    s = s.replace(/-/g, '+'); // 62nd char of encoding
                    s = s.replace(/_/g, '/'); // 63rd char of encoding
                    switch (s.length % 4) // Pad with trailing '='s
                    {
                        case 0: break; // No pad chars in this case
                        case 2: s += "=="; break; // Two pad chars
                        case 3: s += "="; break; // One pad char
                        default: throw new InputException("Illegal base64url string!");
                    }
                    return window.atob(s); // Standard base64 decoder
                }

                function parseReceipt(rcptData) {
                    // rcptData is a JWT.  We should use a JWT library.
                    var data = rcptData.split(".");
                    if (data.length != 3)
                        return null;

                    // convert base64url to base64
                    var payload = base64urldecode(data[1]);
                    var parsed = JSON.parse(payload);

                    return parsed;
                }
                
                var receipt = parseReceipt(record.install_data.receipt);
                if (!receipt) {
                    cb({"error": "Invalid Receipt"});
                    return;
                }
                
                // Two status "flags", one for verify XHR other for BrowserID XHR
                // These two XHRs run in parallel, and the last one to finish invokes cb()
                var assertion;
                var verifyStatus = false;
                var assertStatus = false;

                var verifyURL = receipt.verify;
                var verifyReq = new XMLHttpRequest();  
                verifyReq.open('GET', verifyURL, true);  
                verifyReq.onreadystatechange = function (aEvt) {  
                    if (verifyReq.readyState == 4) {
                        // FIXME: 404? Yeah, because that's what we get now
                        // Hook up to real verification when it's done on AMO
                        // and change this to 200 !!!
                        verifyStatus = true;
                        if (verifyReq.status == 404) {
                            if (verifyOnly && typeof verifyOnly == "function") {
                                verifyOnly(receipt);
                            }
                            if (verifyStatus && assertStatus)
                                cb({"success": {"receipt": receipt, "assertion": assertion}});
                        } else {
                            if (verifyStatus && assertStatus)
                                cb({"error": "Invalid Receipt: " + req.responseText});
                        }
                    }
                };
                verifyReq.send(null);

                // Start BrowserID verification
                var options = {"silent": true, "requiredEmail": receipt.user.value};
                checkNativeIdentityDaemon(contentWindowRef.location, options, function(ast) {
                    assertion = ast;
                    if (!assertion) {
                        cb({"error": "Invalid Identity"});
                        return;
                    }

                    var assertReq = new XMLHttpRequest();
                    assertReq.open('POST', 'https://browserid.org/verify', true);
                    assertReq.onreadystatechange = function(aEvt) {
                        if (assertReq.readyState == 4) {
                            assertStatus = true;

                            // FIXME: a 200 status code doesn't mean OK, check
                            // the responseText
                            if (assertReq.status == 200) {
                                if (verifyStatus && assertStatus)
                                    cb({"success": {"receipt": receipt, "assertion": assertion}});
                            } else {
                                if (verifyStatus && assertStatus)
                                    cb({"error": "Invalid Identity: " + assertReq.responseText});
                            }
                        }
                    };

                    var body = "assertion=" + encodeURIComponent(assertion) + "&audience=" +
                        contentWindowRef.location.protocol + "//" + contentWindowRef.location.host;
                    assertReq.send(body);
                });
            });
        }
    }  
  });

  function checkNativeIdentityDaemon(callingLocation, options, success, failure)
  {
    dump("CheckNativeIdentityDaemon " + callingLocation + " " + options + "\n");
    // XXX what do we do if we are not passed a requiredEmail?
    // could fail immediately, or could ask Firefox for a default somehow
    if (!options || !options.requiredEmail) failure();

    var port = 7350;
    var output, input, scriptableStream;
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
            output = transport.openOutputStream(transport.OPEN_BLOCKING, 0, 0);
            output.write(buf, buf.length);
            input = transport.openInputStream(transport.OPEN_BLOCKING, 0, 0);
            scriptableStream = Components.classes["@mozilla.org/scriptableinputstream;1"]  
                                 .createInstance(Components.interfaces.nsIScriptableInputStream);  
            scriptableStream.init(input);
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
            checkNativeIdentityDaemon(contentWindowRef.location, options, function(assertion) {
                // success: return to caller
                var assert = JSON.parse(assertion);
                if (assert.status == "ok" && assert.assertion) {
                    callback(assert.assertion);
                } else {
                    // failure
                    callback(null);
                }
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
