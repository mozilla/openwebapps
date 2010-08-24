var sys = require("sys"),
    http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs");

function createServer(port) {
  return http.createServer(function(request, response) {
    var uri = url.parse(request.url).pathname;
    var filename = path.join(process.cwd(), uri);
    path.exists(filename, function(exists) {
    	if(!exists) {
    		response.writeHead(404, {"Content-Type": "text/plain"});
    		response.write("404 Not Found");
    		response.end();
        sys.puts("404 " + filename);
    		return;
    	}

    	fs.readFile(filename, "binary", function(err, file) {
    		if(err) {
    			response.writeHead(500, {"Content-Type": "text/plain"});
    			response.write(err + "n");
    			response.end();
          sys.puts("500 " + filename);
    			return;
    		}

    		response.writeHead(200);
    		response.write(file, "binary");
    		response.end();
        sys.puts("200 " + filename);
  
    	});
    });
  }).listen(port);
};
createServer(8123);
createServer(8124);
createServer(8125);

sys.puts("Server running at http://localhost:8123, 8124, and 8125");
