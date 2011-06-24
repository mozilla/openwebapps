
// this doesn't work yet, because window.navigator.apps does not appear to be reachable 
// from content script, which sucks.

// we may have to shim window.navigator.apps in the content script itself
// postMessaging back to the add-on, which will then do its thing.

// set up the smooth transition stuff
var head = document.getElementsByTagName("head")[0];
var el = document.createElement("script");
el.setAttribute("type", "text/javascript");
el.setAttribute("src", "https://raw.github.com/mozilla/openwebapps/master/addons/faker/data/nytimes-inline.js");
head.appendChild(el);

