const { Cc, Ci, Cm, Cu, Cr, components } = require("chrome");
const addon = require("self");
const pageMod = require("page-mod");


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

      verifyReceipt: function(callback, options, cb, verifyOnly) {
        doVerifyReceipt(aWindow, callback, options, cb, verifyOnly);
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

function doVerifyReceipt(contentWindowRef, options, cb, verifyOnly) {
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
          if (verifyStatus && assertStatus) {
            cb({"success": {"receipt": receipt, "assertion": assertion}});
          }
        } else {
          if (verifyStatus && assertStatus) {
            cb({"error": "Invalid Receipt: " + req.responseText});
          }
        }
      }
    };
    verifyReq.send(null);

    // Start BrowserID verification
    var options = {"silent": true, "requiredEmail": receipt.user.value};
    getBrowserIDAssertion(contentWindowRef.location, options, function(err, assertion) {
      if (err) {
        cb({"error": err});
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
            if (verifyStatus && assertStatus) {
              cb({"success": {"receipt": receipt, "assertion": assertion}});
            }
          } else {
            if (verifyStatus && assertStatus) {
              cb({"error": "Invalid Identity: " + assertReq.responseText});
            }
          }
        }
      };

      var body = "assertion=" + encodeURIComponent(assertion) + "&audience=" +
        contentWindowRef.location.protocol + "//" + contentWindowRef.location.host;
      assertReq.send(body);
    });
  });
}

function getBrowserIDAssertion(origin, options, cb)
{
  // First check the identity daemon, if not running or unable
  // to get assertion, fallback to popup.
  // cb is a node style callback (err, assertion);
  checkNativeIdentityDaemon(origin, options, function(err, assertion) {
    if (!assertion) {
      dump("Could not get assertion from daemon, opening popup from origin: " + origin + "error: " + err + "\n");
      
      var frame = document.createElement("iframe");
      frame.setAttribute("type", "content");
      //frame.setAttribute("collapsed", "true");

      function loaded(e) {
        frame.removeEventListener("DOMContentLoaded", loaded);
        var win = frame.contentWindow;
        var sandbox = new Cu.Sandbox(win, {sandboxPrototype: win, wantXrays: false});
        Cu.evalInSandbox('document.getElementById("button").click();', sandbox);
      }

      frame.addEventListener("DOMContentLoaded", loaded, false);
      document.getElementById(appName).appendChild(frame);
      frame.setAttribute("src", "http://proness.kix.in/misc/check.html");
      /*
      var win = frame.contentWindow.wrappedJSObject;
      var script = win.document.createElement("script");
      script.src = "https://browserid.org/include.js";
      win.document.head.appendChild(script);
      */
    } else {
      cb(null, assertion);
    }
  });
}

function checkNativeIdentityDaemon(callingLocation, options, callback)
{
  dump("CheckNativeIdentityDaemon " + callingLocation + " " + JSON.stringify(options) + "\n");

  // XXX what do we do if we are not passed a requiredEmail?
  // could fail immediately, or could ask Firefox for a default somehow
  if (!options || !options.requiredEmail) callback("invalid options", null);

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
        if (chunk.length > 1) {
          callback(null, chunk);
          return;
        } else {
          callback("could not retrieve assertion", null);
          return;
        }
      } else if (aStatus == aTransport.STATUS_CONNECTING_TO) {
        // If the socket isn't "alive" at this stage we assume the
        // port isn't reachable
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
      callback("daemon not found", null);
      return;
    }

    var transport = sockTransportService.createTransport(null, 0, "127.0.0.1", port, null);
    transport.setEventSink(eventSink, threadMgr.currentThread);
    output = transport.openOutputStream(transport.OPEN_BLOCKING, 0, 0);
    output.write(buf, buf.length);
    input = transport.openInputStream(transport.OPEN_BLOCKING, 0, 0);
    scriptableStream = Cc["@mozilla.org/scriptableinputstream;1"]  
                      .createInstance(Ci.nsIScriptableInputStream);  
    scriptableStream.init(input);
  }
  attemptConnection();
}

exports.main = function(options, callbacks) {
  console.log("native app addon starting");

  pageMod.PageMod({
    include: "*", // XXX we could be more specific
    contentScriptWhen: "start",
    contentScriptFile: ["https://browserid.org/include.js", addon.data.url('nativeapi.js')],
    onAttach: function(worker) {
      worker.port.on("verifiedEmail", function(data) {
        console.log("Got back from login " + JSON.stringify(data));
      });
    }
  });

  // initialize the injector if we are <fx9
  require("./injector").init();
}
