// shim in a dump function if one doesn't exist
if (!window.dump) {
    if(typeof console === "undefined") {
        window.console = { log: function() { } };
    }
    window.dump = function (x) { console.log(x); };
}
