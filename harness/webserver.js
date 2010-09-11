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

const sites = {
    "myapps.mozillalabs.com": {
        dir: "../site",
        prod_url: 'https://myapps.mozillalabs.com',
        dev_port: "8123"
    },
    "spaceface.com": {
        dir: "../examples/spaceface.com",
        prod_url: 'http://spaceface.com',
        dev_port: "8124"
    },
    "tweetsup.mozillalabs.com": {
        dir: "../examples/tweetsup",
        prod_url: 'https://tweetsup.mozillalabs.com',
        dev_port: "8125"
    },
    /* bugzap and dictionary require that we run a python server.
     * we'll list them here so node.js can do substitution for
     * local dev, but they should be run separately by their
     * python webservers.  `nobind: true` causes the port not to
     * be bound */
    "bugzap.mozillalabs.com": {
        dir: "../examples/bugzap",
        prod_url: 'https://bugzap.mozillalabs.com',
        dev_port: "8126",
        nobind: true
    },
    "dictionary.mozillalabs.com": {
        dir: "../examples/wiktionary",
        prod_url: 'https://dictionary.mozillalabs.com',
        dev_port: "8201",
        nobind: true
    }
};

function createServer(port) {
    return http.createServer(function(request, response) {
        var hostname = request.headers['host'].toString("utf8");

        var siteroot = null;
        for (s in sites) {
            var port = hostname.split(":")[1];
            if (port == sites[s].dev_port) {
                console.log("req for host: " + s + " (port "+ sites[s].dev_port  + ")");
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


        // I'd like to use this to normalize HTML (optionally):
        //   http://github.com/aredridel/html5
        // Maybe turn it into XML/XHTML so it's easy to parse browser-side
        var parsedURI = url.parse(request.url, true);
        if (parsedURI.pathname == '/subreq') {
            var makeRequest = function (getURI) {
                getURI = url.parse(getURI);
                getURI.pathname = getURI.pathname || '/';
                getURI.search = getURI.search || '';
                getURI.port = getURI.port || '80';
                var client = http.createClient(parseInt(getURI.port), getURI.hostname);
                var siteRequest = client.request('GET',
                    getURI.pathname + getURI.search,
                    {host: getURI.host});
                siteRequest.end();
                siteRequest.on('response', function (siteResponse) {
                    if (parsedURI.query.follow
                        && siteResponse.statusCode > 300
                        && siteResponse.statusCode < 400) {
                        getURI = siteResponse.headers['location'];
                        sys.puts('Proxy redirect to: ' + getURI);
                        makeRequest(getURI);
                        return;
                    }
                    response.writeHead(
                        siteResponse.statusCode, siteResponse.headers);
                    siteResponse.on('data', function (chunk) {
                        response.write(chunk, 'binary');
                    });
                    siteResponse.on('end', function () {
                        response.end();
                    });
                });
            };
            makeRequest(parsedURI.query.uri);
            sys.puts("Proxy URL " + parsedURI.query.uri);
            return;
        }

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
                    var textual = false;
                    var exts = [ ".js", ".css", ".html" ];
                    for (i in exts) {
                        if (true == (textual = (path.extname(filename) === exts[i]))) break;
                    }

                    if (textual && data && data.split) {
                        // which hostname shall we substituted in?
                        var subHost = hostname.split(":")[0];
                        for (s in sites) {
                            data = data.split(sites[s].prod_url).join("http://" + subHost + ":" + sites[s].dev_port);
                        }
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
            if (err === null && s.isDirectory()) {
                serveFile(path.join(filename, "index.html"));
            } else {
                serveFile(filename);
            }
        });
    }).listen(port);
};
var ports = [];
for (s in sites) {
    if (sites[s].nobind) continue;
    var p = parseInt(sites[s].dev_port);
    sys.puts("bound http://localhost:" + p + " - " + sites[s].prod_url);
    createServer(p);
    ports.push(p);
}
