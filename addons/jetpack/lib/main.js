const widgets = require("widget");
const tabs = require("tabs");

// this is the OLD bootstrap, don't get confused
const bootstrap = require("bootstrap");

// patching the startup() call for now
bootstrap.startup({
    id: 'openwebapps@labs.mozilla.com'
});

console.log("The add-on is running.");
