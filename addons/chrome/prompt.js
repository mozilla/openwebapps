
;Prompt = (function() {
    var showFunc = function(cb) {
        // XXX when infobars are a part of the API, we can use them
        // to render user prompts.
        // for now, there's no prompting
        // chrome.experimental.infobars.show(path:"prompt.html");
        setTimeout(function() { cb(true); }, 500);
    };
    return {
        show: showFunc
    };
}());