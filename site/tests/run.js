//
// a little node webserver designed to run the unit tests herein

var sys = require("sys"),
http = require("http"),
url = require("url"),
path = require("path"),
fs = require("fs"),
template = require("./serverjs/template"),
template_loader = require("./serverjs/loader");

const SPEC_DIR = path.join(path.dirname(__dirname), "spec");
const STATIC_DIR = path.join(path.dirname(__dirname));

template_loader.set_path(STATIC_DIR);

// all bound webservers stored in this lil' object
var boundServers = [ ];
function getWebRootDir(host, port) {
  for (var i = 0; i < boundServers.length; i++) {
    var o = boundServers[i];
    var a = o.server.address();
    if (host === a.address && port === a.port) {
      return o.path ? o.path : __dirname;
    }
  }
  return undefined;
}

function getServerByName(name) {
  for (var i = 0; i < boundServers.length; i++) {
    if (boundServers[i].name === name) return boundServers[i];
  }
  return undefined;
}

function fourOhFour(resp, reason) {
  resp.writeHead(404, {"Content-Type": "text/plain"});
  resp.write("404 Not Found");
  if (reason) {
    resp.write(": " + reason);
  }
  resp.end();
  return undefined;
}

function createServer(obj) {
  var port = obj.port;
  var myserver = http.createServer(function(obj, request, response) {
    var hostname = request.headers['host'].toString("utf8");
    var port = parseInt(hostname.split(':')[1]);
    var host = hostname.split(':')[0];

    // normalize 'localhost', so it just works.
    if (host === 'localhost') {
      var redirectURL = "http://127.0.0.1:" + port + request.url;
      response.writeHead(302, {"Location": redirectURL});
      response.end();
      return;
    }

    // get the directory associated with the port hit by client
    var siteroot = getWebRootDir(host, port);

    // unknown site?  really?
    if (!siteroot) return fourOhFour(response, "No site on this port");

    // hook to fetch manifests for HTML5 repos
    var parsedURI = url.parse(request.url, true);
    if (parsedURI.pathname == '/getmanifest') {
      var makeRequest = function (getURI) {
        getURI = url.parse(getURI);
        getURI.pathname = getURI.pathname || '/';
        getURI.search = getURI.search || '';
        getURI.port = getURI.port || '80';
        var client = http.createClient(parseInt(getURI.port), getURI.hostname);
        var siteRequest = client.request('GET',
                                         getURI.pathname + getURI.search,
                                         {host: getURI.host});
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
        siteRequest.addListener('error', function(socketException){
          if (socketException.errno === process.ECONNREFUSED) {
            sys.log('ECONNREFUSED: connection refused to '
                    +request.socket.host
                    +':'
                    +request.socket.port);
          } else {
            sys.log(socketException);
          }
          fourOhFour(response);
        });
        siteRequest.end();
      };
      makeRequest(parsedURI.query.url);
      sys.puts("Proxy URL " + parsedURI.query.url);
      return;
    }

    // servers.js is an artificial file which defines a data structure
    // where all of our servers are defined.  Ephemeral ports are used
    // to give us a better shot of just working as lots of test directories
    // are added, and this mechanism gives HTML based testing a means of
    // mapping test names (just dir names) into urls
    if (parsedURI.pathname == '/servers.js') {
      var serverToUrlMap = {};
      for (var i = 0; i < boundServers.length; i++) {
        var o = boundServers[i]
        var a = o.server.address();
        serverToUrlMap[o.name] = "http://" + a.address + ":" + a.port;
      }
      var t = "var SERVERS = " + JSON.stringify(serverToUrlMap) + ";";
      response.writeHead(200, {"Content-Type": "application/x-javascript"});
      response.write(t);
      response.end();
      return;
    }
    
    if(obj.handler) {
        obj.handler(request, response);
        return;
    }   

    var filename = path.join(siteroot, url.parse(request.url).pathname);

    if (siteroot == __dirname) {
      // We're layering two directories in this case
      var otherPath = path.join(__dirname, '..', url.parse(request.url).pathname);
      path.exists(otherPath, function(exists) {
        if (exists) {
          serveFileIndex(otherPath, response);
        } else {
          serveFileIndex(filename, response);
        }
      });
    } else {
      serveFileIndex(filename, response);
    }
  }.bind(null,obj));
  myserver.listen(port, PRIMARY_HOST);
  return myserver;
};

// start up webservers on ephemeral ports for each subdirectory here.
var dirs = fs.readdirSync(path.join(__dirname, 'servers')).map(
  function (d) {
    return {
      title: "Tests:",
      name: d,
      path: path.join(__dirname, 'servers', d)};
  });

var examplesCopies = 1;
if (process.env.EXAMPLE_COPIES) {
  examplesCopies = parseInt(process.env.EXAMPLE_COPIES);
  console.log('Starting ' + examplesCopies + ' copies of each example app');
}
var examplesDirs = fs.readdirSync(path.join(__dirname, '../../examples'));
for (var i=0; i<examplesCopies; i++) {
  examplesDirs.forEach(function (item) {
    dirs.push({
      title: "Examples: (set $EXAMPLE_COPIES to a number for multiple copies)",
      name: item + (i ? " ("+i+")" : ""),
      path: path.join(__dirname, '../../examples', item)
    });
  });
}

console.log("Starting test apps:");

// bind the "primary" testing webserver to a fixed local port, it'll
// be the place from which tests are run, and it's the repository host
// for the purposes of testing.
var PRIMARY_PORT = 60172;

// The interface address to bind, and will appear in all urls
var PRIMARY_HOST = "127.0.0.1";

// extract '-ip' argument if present
for (var i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === "-ip" && i < process.argv.length) {
    PRIMARY_HOST = process.argv[i+1];
    break;
  }
}

function primaryHandler(req, resp) {
    var urlpath = url.parse(req.url).pathname;

    /* We only want to use the template_loader for HTML
     * files, all other files use the standard serveFileIndex
     * since all the background work for mime types is set up.
     */
    if(urlpath.match(/\.html$/)) {
        var specs = getSpecs();
        var tests = [];
        specs.forEach( function( spec, index ) {
            if( spec !== 'run-all.html' ) {
                tests.push( spec );
            }
        } );
        template_loader.load_and_render(urlpath, { 
            specs: specs,
            tests: tests 
        }, function(err, result) {
            resp.end(result);
        });
    } else {
        urlpath = path.join(__dirname, '..', urlpath);
        serveFileIndex(urlpath, resp);
    }
}

function serveFile(filename, response) {
  path.exists(filename, function(exists) {
    if(!exists) {
      response.writeHead(404, {"Content-Type": "text/plain"});
      response.write("404 Not Found");
      response.end();
      return;
    }

    fs.readFile(filename, "binary", function(err, data) {
      if(err) {
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.write(err + "\n");
        response.end();
        return;
      }

      var exts = {
        ".js":   "text/javascript",
        ".css":  "text/css",
        ".html": "text/html",
        ".webapp": "application/x-web-app-manifest+json",
        ".png": "image/png",
        ".ico": "image/x-icon"
      };

      var ext = path.extname(filename);
      var mimeType = exts[ext] || "application/octet-stream";

	  data = data.replace(/https?:\/\/(stage\.)?myapps\.mozillalabs\.com/ig,
                              "http://" + PRIMARY_HOST + ":" + PRIMARY_PORT);

      response.writeHead(200, {"Content-Type": mimeType});
      response.write(data, "binary");
      response.end();
    });
  });
}

function serveFileIndex(filename, response) {
  // automatically serve index.html if this is a directory
  fs.stat(filename, function(err, s) {
	if (err === null && s.isDirectory()) {
	  serveFile(path.join(filename, "index.html"), response);
	} else {
	  serveFile(filename, response);
	}
  });
}


boundServers.push({
  name: "_primary",
  server: createServer({ 
    port: PRIMARY_PORT,
    handler: primaryHandler
  })
});

function formatLink(nameOrServer, extraPath) {
  if (typeof nameOrServer == 'string') {
    nameOrServer = getServerByName(nameOrServer).server;
  }
  var addr = nameOrServer.address();
  var url = 'http://' + addr.address + ':' + addr.port;
  if (extraPath) {
    url += extraPath;
  }
  return url;
}


console.log('Primary server:');
console.log('  ' + formatLink("_primary"));

var lastTitle = null;
dirs.forEach(function(dirObj) {
  if (!fs.statSync(dirObj.path).isDirectory()) return;
  if (lastTitle != dirObj.title) {
    console.log('\n' + dirObj.title);
    lastTitle = dirObj.title;
  }
  boundServers.push({
    path: dirObj.path,
    server: createServer({ port: 0 }),
    name: dirObj.name
  });
  console.log("  " + dirObj.name + ": " + formatLink(dirObj.name));
});

console.log("\nTesting server started, to run tests go to: "
            + formatLink("_primary", "/tests/index.html"));

function getSpecs() {
    var dirs = fs.readdirSync(path.join(__dirname, 'spec'));
    return dirs;
}
