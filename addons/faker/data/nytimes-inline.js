
window.navigator.apps.services.registerHandler('link.transition', 'transition', function(args, cb) {
    alert('new url ' + args.url);
});

window.navigator.apps.services.ready();

