var apps = require("apps");
var url = require("url");

exports.applicationMatchesURL = function(test) {
  var app = 
    {
      app:
      {
        urls:["http://www.helloworld.com"]
      }
    };

  test.assert(apps.applicationMatchesURL(app, "http://www.helloworld.com"));
};