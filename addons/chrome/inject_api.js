// this script is run at 'document_start' for all web content.
// it's executed before any scripts are executed and before the
// DOM is fully built.  it's job is to inject a script tag into the
// loaded page which will shim in functions into navigator.apps.
//
// navigator.apps will then communicate with this content script
// via custom DOM events and embedding data in the DOM.  This 
// content script will the communicate into trusted code using
// chrome provided mechanisms.
//
// All of this is a bit on the  yucky side.

// first let's inject our script to run inside the page's evaluation
// context
var s = document.createElement('script');
s.src = chrome.extension.getURL("open_web_apps_api.js");
document.documentElement.insertBefore(s, document.documentElement.firstChild);

// now let's inject two custom DOM nodes that will be used for communication
// into and out of the page
var d = document.createElement('div');
d.id = "__openWebAppsOut";
document.documentElement.insertBefore(d, document.documentElement.firstChild);
d = document.createElement('div');
d.id = "__openWebAppsIn";
document.documentElement.insertBefore(d, document.documentElement.firstChild);

// establish a connection to the extension
var port = chrome.extension.connect();

// next, let's register to receive incoming events from the page
d.addEventListener('__openWebAppsInEvent', function() {
    var data = document.getElementById('__openWebAppsIn').innerText;
    var msg = JSON.parse(data);
    port.postMessage(msg);
});

// a listener to receive messages from the extension 
port.onMessage.addListener(function(msg) {
    var d = document.getElementById('__openWebAppsOut');
    d.innerText = JSON.stringify(msg);
    var ev = document.createEvent('Event');
    ev.initEvent('__openWebAppsOutEvent', true, true);
    d.dispatchEvent(ev);
});
