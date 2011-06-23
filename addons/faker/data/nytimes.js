
// this doesn't work yet, because window.navigator.apps does not appear to be reachable 
// from content script, which sucks.

// we may have to shim window.navigator.apps in the content script itself
// postMessaging back to the add-on, which will then do its thing.

// set up the smooth transition stuff
window.navigator.apps.services.registerHandler('link.transition', 'transition', function(args, cb) {
    alert('new url ' + args.url);
});

window.navigator.apps.services.ready();
