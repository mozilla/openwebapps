const {Cc, Ci, Cm, Cu, components} = require("chrome");
const repo = require("api").FFRepoImplService;

var serverSocket;

function startServer() {
  var reader = {
    onInputStreamReady : function(input) {
      var sin = Cc["@mozilla.org/scriptableinputstream;1"]
                .createInstance(Ci.nsIScriptableInputStream);
      sin.init(input);
      sin.available();
      var request = '';
      while (sin.available()) {
        request = request + sin.read(512);
      }
      console.log('Received: ' + request);
      input.asyncWait(reader,0,0,null);
    } 
  }        
  var listener = {
    onSocketAccepted: function(serverSocket, clientSocket) {
      console.log("Accepted connection on "+clientSocket.host+":"+clientSocket.port);
      input = clientSocket.openInputStream(0, 0, 0).QueryInterface(Ci.nsIAsyncInputStream);
      output = clientSocket.openOutputStream(Ci.nsITransport.OPEN_BLOCKING, 0, 0);
      input.asyncWait(reader,0,0,null);
    }
  };
  serverSocket = Cc["@mozilla.org/network/server-socket;1"].
                    createInstance(Ci.nsIServerSocket);
  serverSocket.init(-1, true, 5);
  console.log("Opened socket on " + serverSocket.port);
  serverSocket.asyncListen(listener);
}

exports.testXHRTimeout = function(test) {
  test.waitUntilDone();
  startServer();
  repo._fetchManifest("http://127.0.0.1:" + serverSocket.port, function(manifest) {
    if (manifest == null) test.pass("Manifest fetch timed out as expected!");
    test.done();
  });
};
