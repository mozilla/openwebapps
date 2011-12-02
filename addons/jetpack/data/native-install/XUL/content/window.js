
var Cu = Components.utils;
var Cc = Components.classes;
var Cm = Components.manager;
var Ci = Components.interfaces;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

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
                            null, "chrome,centerscreen,resizable", null);
}

// Inject APIs
//----- navigator.mozApps api implementation
// FIXME: Fallback doesn't actually work on Fx<9, debug why
var injector = {};
Cu.import("chrome://webapp/content/injector.js", injector);
injector.init();

function NavigatorAPI() {};
NavigatorAPI.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIDOMGlobalPropertyInitializer]),
  
  init: function API_init(aWindow) {
    let chromeObject = this._getObject(aWindow);

    // We need to return an actual content object here, instead of a wrapped
    // chrome object. This allows things like console.log.bind() to work.
    let contentObj = Cu.createObjectIn(aWindow);
    function genPropDesc(fun) {
      return { enumerable: true, configurable: true, writable: true,
               value: chromeObject[fun].bind(chromeObject) };
    }
    let properties = {};
  
    for (var fn in chromeObject.__exposedProps__) {
      properties[fn] = genPropDesc(fn);
    }

    Object.defineProperties(contentObj, properties);
    Cu.makeObjectPropsNormal(contentObj);

    return contentObj;
  }
};

var MozAppsAPIContract = "@mozilla.org/openwebapps/mozApps;1";
var MozAppsAPIClassID = Components.ID("{19c6a16b-18d1-f749-a2c7-fa23e70daf2b}");
function MozAppsAPI() {}
MozAppsAPI.prototype = {
  __proto__: NavigatorAPI.prototype,
  classID: MozAppsAPIClassID,
  _getObject: function(aWindow) {
    return {
      amInstalled: function(callback) {
        getInstallRecord(callback);
      },

      verifyReceipt: function(callback, options) {
        doVerifyReceipt(aWindow, callback, options);
      },
      
      __exposedProps__: {
        amInstalled: "r",
        verifyReceipt: "r"
      }
    };
  }
};

let MozAppsAPIFactory = {
  createInstance: function(outer, iid) {
    if (outer != null) throw Cr.NS_ERROR_NO_AGGREGATION;
    return new MozAppsAPI().QueryInterface(iid);
  }
};

Cm.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
  MozAppsAPIClassID, "MozAppsAPI", MozAppsAPIContract, MozAppsAPIFactory
);
Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager)
  .addCategoryEntry("JavaScript-navigator-property", "mozApps", MozAppsAPIContract, false, true);

/* TODO: Unload injector
unloaders.push(function() {
  Cm.QueryInterface(Ci.nsIComponentRegistrar).unregisterFactory(
    MozAppsAPIClassID, MozAppsAPIFactory
  );
  Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager).
              deleteCategoryEntry("JavaScript-navigator-property", "mozApps", false);
});
*/

function getInstallRecord(cb) {
  var appDirectory = Cc["@mozilla.org/file/directory_service;1"].
    getService(Ci.nsIProperties).  
    get("CurProcD", Ci.nsIFile);
            
  var aNsLocalFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
  aNsLocalFile.initWithFile(appDirectory);
  aNsLocalFile.appendRelativePath("installrecord.json");

  Cu.import("resource://gre/modules/NetUtil.jsm");
  Cu.import("resource://gre/modules/FileUtils.jsm");
          
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

function doVerifyReceipt(contentWindowRef, cb, options) {
  getInstallRecord(function(record) {
    if (!record) {
      cb({"error": "Application not installed"});
      return;
    }

    if (typeof cb !== "function") {
      throw "Callback not provided in doVerifyReceipt";
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
      
    try {
      if (!record.install_data) {
        throw "Receipt not found"; 
      }
      var receipt = parseReceipt(record.install_data.receipt);
      if (!receipt) {
        throw "Invalid Receipt";
      }
    } catch (e) {
      cb({"error": e});
      return;
    }
      
    // Two status "flags", one for verify XHR other for BrowserID XHR
    // These two XHRs run in parallel, and the first one to error out invokes cb()
    // If both XHRs succeed, the last one to succeed will invoke cb()
    var assertion;
    var errorSent = false;
    var verifyStatus = false;
    var assertStatus = false;

    var verifyURL = receipt.verify;
    var verifyReq = new XMLHttpRequest();  
    verifyReq.open('POST', verifyURL, true);  
    verifyReq.onreadystatechange = function (aEvt) {  
      if (verifyReq.readyState == 4) {
        try {
          if (verifyReq.status == 200) {
            var resp = JSON.parse(verifyReq.responseText);
            if (resp.status != "ok") {
              throw resp.status;
            }

            dump("verifyReq success! " + verifyReq.responseText + "\n");
            verifyStatus = true;
            if (options && options.receiptVerified && typeof options.receiptVerified == "function") {
              options.receiptVerified(receipt);
            }
            if (verifyStatus && assertStatus) {
              cb({"success": {"receipt": receipt, "assertion": assertion}});
            }
          } else {
            throw verifyReq.status;
          }
        } catch(e) {
          dump("error in verifyReq! " + verifyReq.responseText);
          if (!errorSent) {
            cb({"error": "Invalid Receipt: " + verifyReq.responseText}); 
            errorSent = true;
          }
        }
      }
    };

    try {
      verifyReq.send(record.install_data.receipt); 
    } catch (e) {
      // Offline
      if (!errorSent) {
        cb({"error": "Offline: Could not verify receipt"}); 
        errorSent = true;
      }
    }

    // Start BrowserID verification
    var idOptions = {"silent": true, "requiredEmail": receipt.user.value};
    checkNativeIdentityDaemon(contentWindowRef.location, idOptions, function(ast) {
      assertion = ast;
      if (!assertion) {
        cb({"error": "Invalid Identity"});
        return;
      }

      var assertReq = new XMLHttpRequest();
      assertReq.open('POST', 'https://browserid.org/verify', true);
      assertReq.onreadystatechange = function(aEvt) {
        if (assertReq.readyState == 4) {
          try {
            if (assertReq.status == 200) {
              var resp = JSON.parse(assertReq.responseText);
              if (resp["status"] != "okay") {
                throw resp.status;
              }

              dump("assertReq success! " + assertReq.responseText + "\n");
              assertStatus = true;
              if (verifyStatus && assertStatus) {
                cb({"success": {"receipt": receipt, "assertion": assertion}});
              }
            } else {
              throw assertReq.status;
            }
          } catch(e) {
            dump("error in assertReq! " + assertReq.responseText);
            if (!errorSent) {
              cb({"error": "Invalid Identity: " + assertReq.responseText}); 
              errorSent = true;
            }
          }
        }
      };

      var body = "assertion=" + encodeURIComponent(assertion) + "&audience=" +
        encodeURIComponent(contentWindowRef.location.protocol + "//" + contentWindowRef.location.host);
      assertReq.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

      try {
        assertReq.send(body); 
      } catch (e) {
        // Offline
        if (!errorSent) {
          cb({"error": "Offline: Could not verify receipt"}); 
          errorSent = true;
        }
      }
    }, function(err) {
      // Ideally we'd implement a fallback here where we open a BrowserID
      // popup dialog. But this is not trivial to do, punting for now.
      cb({"error": "Could not obtain Identity: " + err});
    });
  });
}

function checkNativeIdentityDaemon(callingLocation, options, success, failure)
{
  dump("CheckNativeIdentityDaemon " + callingLocation + " " + JSON.stringify(options) + "\n");
  if (typeof failure != "function") {
    function failure(e) {
      dump("Failure callback not defined, shimmed " + e);
    }
  }

  // XXX what do we do if we are not passed a requiredEmail?
  // could fail immediately, or could ask Firefox for a default somehow
  if (!options || !options.requiredEmail) failure();

  var port = 7350;
  var output, input, scriptableStream;
  var sockTransportService = Cc["@mozilla.org/network/socket-transport-service;1"]
    .getService(Ci.nsISocketTransportService);
  
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
          try {
            var assert = JSON.parse(chunk.replace(/\s/g, ''));
            if (assert['assertion']) {
              success(assert['assertion']);
            } else {
              throw "Invalid assertion"; 
            }
          } catch (e) {
            failure();
          }
          return;
        } else {
          failure();
          return;
        }
      } else if (aStatus == aTransport.STATUS_CONNECTING_TO) {
        // If socket is not "alive" at this stage, it means connection refused
        if (!aTransport.isAlive()) {
          port++;
          attemptConnection();
        }
      }
    }
  };

  var threadMgr = Cc["@mozilla.org/thread-manager;1"].getService();
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
      scriptableStream = Cc["@mozilla.org/scriptableinputstream;1"]  
                        .createInstance(Ci.nsIScriptableInputStream);  
      scriptableStream.init(input);
    } catch (e) {
      port++;
      attemptConnection();
    }
  }
  attemptConnection();
}

/* TODO: Add navigator.id.getVerifiedEmail */
