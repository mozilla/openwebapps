const widgets = require("widget");
const tabs = require("tabs");

// this is the OLD bootstrap, don't get confused
const bootstrap = require("bootstrap");

var self = require("self");

// patching the startup() call for now
bootstrap.startup(self.data.url);

console.log("The add-on is running.");
