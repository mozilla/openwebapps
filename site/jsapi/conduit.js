/** @class Conduit
 *  An abstraction around a conduit which handles allocation and
 *  communication */

/**
 * @constructor
 * @param url the absolute URL to the conduit HTML
 */
Conduit = function(url) {
    // private data
    var _chan = undefined,
        _iframe = undefined,
        _url = url;


    // load the conduit into an iframe
    function _setup() {
        if (_chan === undefined) {
            // Create hidden iframe dom element
            var doc = window.document;
            _iframe = doc.createElement("iframe");
            _iframe.style.display = "none";

            // Append iframe to the dom and load up myapps.mozillalabs.com inside
            doc.body.appendChild(_iframe);

            _iframe.src = url;

            _chan = Channel.build({
                window: _iframe.contentWindow,
                origin: "*",
                scope: "openwebapps"
            });
        }
    }

    /**
     * invoke a service on this conduit 
     * @param name {string} The moniker of the service to invoke
     * @param args {any} Service-specific Arguments
     * @param [onsuccess] {function} A callback invoked upon success
     * @param [onerror] {function} A callback invoked upon failure
     */
    this.invoke = function(name, args, onsuccess, onerror) {
        _setup();
        _chan.call({
            method: name,
            params: args,
            success: onsuccess,
            error: onerror
        });
    };

    return this;
};
