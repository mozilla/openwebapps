/*
 *  A nodejs testing server for running the various sites involved in
 *  vapour locally.  The following sites are served here:
 *
 *  myapps.org - Both the HTML5 site dashboard and the broker of application
 *               purchasing and provising
 *  apptast.ic - An application store, perhaps one that is capable of morphing
 *               plain ol' websites into applications  
 *  spaceface.com - A web site that can be installed as a web application.
 *
 *  The server also does code parameterization for local testing.  The hostnames
 *  above will be substituted within served html, javascript, and css at the
 *  time they're served.  This allows local testing without any etc hosts
 *  modification.
 */

var sys = require("sys"),
    http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs");

function createServer(port) {
  return http.createServer(function(request, response) {
    var hostname = request.headers['host'].toString("utf8");

    var sites = {
      "myapps.org": {
        dir: "../site",
        testhost: "localhost:8123"
      },
      "apptast.ic": {
        dir: "../apptast.ic",
        testhost: "localhost:8124"
      },
      "spaceface.com": {
        dir: "../examples/spaceface.com",
        testhost: "localhost:8125"
      }
    };      

    var siteroot = null;
    for (s in sites) {
      if (hostname == sites[s].testhost == 0) {
        console.log("req for host: " + s + " ("+ sites[s].testhost  + ")");
        siteroot = sites[s].dir;
        break;
      }
    }

    if (siteroot === null) {
    	response.writeHead(404, {"Content-Type": "text/plain"});
    	response.write("404 Not Found");
    	response.end();
      console.log("404 " + hostname);
      return;
    }

    console.log("Siteroot: " + siteroot);

    var uri = url.parse(request.url).pathname;
    var filename = path.join(process.cwd(), siteroot, uri);

    console.log("filename: " + siteroot);

    var serveFile = function (filename) {
      console.log("serving " + filename);
      path.exists(filename, function(exists) {
        if(!exists) {
    		  response.writeHead(404, {"Content-Type": "text/plain"});
    		  response.write("404 Not Found");
    		  response.end();
          sys.puts("404 " + filename);
    		  return;
    	  }

    	  fs.readFile(filename, "binary", function(err, data) {
    		  if(err) {
    			  response.writeHead(500, {"Content-Type": "text/plain"});
    			  response.write(err + "n");
    			  response.end();
            sys.puts("500 " + filename);
    			  return;
    		  }

          // if filename extension is .js, .css, or .html, let's search and replace
          // all occurances of any of the hostnames with test hostnames
          for (s in sites) {
            data = data.replace(s, sites[s].testhost);
          }

    		  response.writeHead(200);
    		  response.write(data, "binary");
    		  response.end();
          sys.puts("200 " + filename);
        });
    	});
    };

    // automatically serve index.html if this is a directory
    fs.stat(filename, function(err, s) {
      if (s.isDirectory) {
        serveFile(path.join(filename, "index.html"));
      } else {
        serveFile(filename);
      }
    });
  }).listen(port);
};
var ports = [8123, 8124, 8125];
for (port in ports) createServer(ports[port]);
console.log("Server running at http://localhost:{" + ports.join(",") + "}");
