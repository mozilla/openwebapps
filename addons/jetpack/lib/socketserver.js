const {Cc, Ci} = require("chrome");
var pageWorkers = require("page-worker");

var gIdServer;
const PORT_RANGE_START = 7350;
const PORT_RANGE_END = 7400;

function IdentityServer() {

	return this;
}

IdentityServer.prototype = {
	start: function() {
		if (this.serverSocket) return;

		this.serverSocket = Cc["@mozilla.org/network/server-socket;1"].createInstance(Ci.nsIServerSocket);

		var port = PORT_RANGE_START;
		while (port < PORT_RANGE_END)
		{
			try {
				this.serverSocket.init(port, true, 5);
				console.log("Started identity server on port " + port);
				break;
			} catch (e) {
				port++;
				if (port == PORT_RANGE_END)
				{
					console.log("Unable to start identity server on port " + port + "; checking next available port");					
				} 
				else
				{
					console.log("Unable to start identity server on any port.  Terminating.");
					this.serverSocket = null;
					return;
				}
				break;
			}
		}
		
		this.serverSocket.asyncListen(this);
	},

	stop: function() {
		if (this.serverSocket) this.serverSocket.stop();
		this.serverSocket = null;
	},

	onSocketAccepted: function(aSocket, aTransport)
	{
		try {
			console.log("ID server accepted connection from " + aTransport.port);
			var inStreamNative = aTransport.openInputStream(aTransport.OPEN_BLOCKING, 0, 0); // XXX blocking, blech. 
			var inStream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
			inStream.init(inStreamNative);

			var buffer = "";

			try {
				while (true)
				{	
					var chunk = inStream.read(1024);
					buffer = buffer + chunk;
					console.log("GOT DATA: " + chunk + "\n");
					if (chunk == null || buffer.indexOf("\r\n\r\n") >= 0) {
						console.log("Found end of buffer\n");
						this.handleRequest(buffer, aTransport);
						break;
					} else {
						console.log("Looking for more data\n");
					}
				}
			} catch (e) {
				console.log("ID server I/O error while reading request:" + e);
			}
			inStream.close();
		} catch (e) {
			console.log(e);
		}
	},

	onStopListening: function(aSocket, aStatus)
	{
		console.log("ID server stop listening; " + aStatus);
	},

	handleRequest: function(request, aTransport)
	{
		var outStream = aTransport.openOutputStream(aTransport.OPEN_BLOCKING, 0, 0); // XXX blocking, blech. 

		var idLine = request.split("\r")[0];
		var lineParts = idLine.split(" ");
		if (lineParts[0] != "IDCHECK" || lineParts.length != 3) {
			console.log("Incorrect request on ID server port");
			var err = '{"status":"error"}';
			outStream.write(err, err.length);
			outStream.close();
			return;
		}
		var id = lineParts[1];
		var audience = lineParts[2];
		
		// TODO sanitize ID through regex		
		console.log("Passing identity " + id + " to browserid\n");
		try {
			pageWorkers.Page({
			  contentURL: "https://browserid.org",
			  contentScript: "unsafeWindow.BrowserID.User.setOrigin(\"" + audience + "\");" +
			  	"unsafeWindow.BrowserID.User.getAssertion(\"" + id + "\", " + 
			  	"function(res) {self.postMessage({status:\"ok\", assertion:res});}, " + 
			  	"function(err) {self.postMessage({status:\"error\"});});",
			  contentScriptWhen: "end",
			  onMessage: function(message) {
			  	var out = JSON.stringify(message) + "\r\n\r\n";
				console.log("BrowserID returned: " + out);
			  	outStream.write(out, out.length);
				outStream.close();
			  }
			});
		} catch (e) {
			var out = "error: " + e;
			outStream.write(out, out.length);
			outStream.close();			
		}
	}
}

function startServer() {
	gIdServer = new IdentityServer();
	gIdServer.start();
}
function stopServer() {
	
}

exports.startServer = startServer;
exports.stopServer = stopServer;
