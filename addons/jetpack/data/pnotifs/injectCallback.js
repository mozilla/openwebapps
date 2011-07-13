var nextCallbackID = 0;
var callbackDictionary = {};

function handleCallbacks(args) {
    var callbackIDMap = {};
    for (var arg in args) {
        if (typeof args[arg] !== 'function') continue;
        // Assign this callback instance an ID
        callbackIDMap[arg] = nextCallbackID;
        callbackDictionary[nextCallbackID++] = args[arg];
    }
    return callbackIDMap;
}

self.port.on('onCallback', function(msg) {
    callbackDictionary[msg.callbackID].apply(eval(msg.context), msg.args);
});