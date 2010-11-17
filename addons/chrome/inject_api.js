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
s = document.createElement('script');
s.src = chrome.extension.getURL("open_web_apps_api.js");
document.documentElement.insertBefore(s, document.documentElement.firstChilde);
