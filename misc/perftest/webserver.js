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
        var siteroot = "./content/";

        console.log("Siteroot: " + siteroot);

        var uri = url.parse(request.url).pathname;
        var filename = path.join(process.cwd(), siteroot, uri);

        console.log("filename: " + siteroot);

        var parsedURI = url.parse(request.url, true);

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

                    // determine content type.  all text/ types will get hostnames replaced
                    var exts = {
                        ".js":   "text/javascript",
                        ".css":  "text/css",
                        ".html": "text/html"
                    };
                    var ext = path.extname(filename);
                    var mimeType = (exts[ext]) ? exts[ext] : "application/unknown";

                    response.writeHead(200, {"Content-Type": mimeType});
                    response.write(data, "binary");
                    response.end();
                    sys.puts("200 " + filename);
                });
            });
        };

        // automatically serve index.html if this is a directory
        fs.stat(filename, function(err, s) {
            if (err === null && s.isDirectory()) {
                serveFile(path.join(filename, "index.html"));
            } else {
                serveFile(filename);
            }
        });
    }).listen(port);
};

p = 8888;
sys.puts("binding to http://localhost:" + p);
createServer(p);
