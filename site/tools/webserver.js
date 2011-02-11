var sys = require("sys"),
    http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs");
    
function endsWith(s, val) {
  var idx = s.lastIndexOf(val);
  return (idx >= 0 && idx == s.length - val.length);
}

function createServer(port) {
  return http.createServer(function(request, response) {

    var parsedurl = url.parse(request.url, true);
    var uri = parsedurl.pathname;
    
    if (uri == "/synthesize_notification")
    {
      function val(term, deflt) {
        if (parsedurl.query && parsedurl.query[term]) return parsedurl.query[term];
        return deflt;
      }
    
      response.writeHead(200, {"Content-Type": "application/atom+xml"});
      response.write('<feed xmlns="http://www.w3.org/2005/Atom">\n');
      response.write('<title>' + val("title", "Untitled Notification") + '</title>\n');
      response.write('<id>' + val("id", "generic-id") + '</id>\n');
      if (parsedurl.query && parsedurl.query['updated']) {
        response.write('<updated>' + val("updated", "") + '</updated>\n');
      }
      var count = 0;
      if (parsedurl.query && parsedurl.query["entry" + count + "title"])
      {
        response.write("<entry>\n");
        response.write('<title>' + val("title", "entry" + count + "title") + '</title>\n');
        response.write('<summary>' + val("title", "entry" + count + "summary") + '</summary>\n');
        // TODO: link, id, updated, summary
        response.write('</entry>\n');
        count += 1;
      }
      response.write('</feed>\n');
      response.end();
      sys.puts("200 notification");
      return;
    }
    var filename = path.join(process.cwd(), uri);
    path.exists(filename, function(exists) {
    	if(!exists) {
    		response.writeHead(404, {"Content-Type": "text/plain"});
    		response.write("404 Not Found");
    		response.end();
        sys.puts("404 " + filename);
    		return;
    	}

      var contentType;
      if (endsWith(filename, ".webapp")) {
        contentType = "application/x-web-app-manifest+json";
      } else if (endsWith(filename, ".htm") || endsWith(filename, ".html")) {
        contentType = "text/html";
      }

    	fs.readFile(filename, "binary", function(err, file) {
    		if(err) {
    			response.writeHead(500, {"Content-Type": "text/plain"});
    			response.write(err + "n");
    			response.end();
          sys.puts("500 " + filename);
    			return;
    		}

        var headers = {};
        if (contentType) headers["Content-Type"] = contentType;
    		response.writeHead(200, headers);
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
