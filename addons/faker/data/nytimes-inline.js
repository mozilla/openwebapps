
window.navigator.apps.services.registerHandler('link.transition', 'transition', function(args, cb) {
    if (window.skimmer) {
        
        skimmer("article").load(args.url, "");
    } else {
        window.location = args.url;
    }
});

window.navigator.apps.services.ready();


