let gCallbacks = {};
let gCallbackIndex = 0;

onMessage = function onMessage(message) {
  console.log("Got message: " + JSON.stringify(message));

  if (gCallbacks[message.id]) {

    console.log("Calling callback"); 
    gCallbacks[message.id](message.result);
    delete gCallbacks[message.id];

  } else {
    console.log("No callback, dropping silently");
  }
};

window.navigator.apps = {
  install: function(args) {
    // TODO verify arguments
    gCallbacks[gCallbackIndex] = args.callback;
    postMessage({
      id:gCallbackIndex++,
      cmd:'install',
      origin:document.URL,
      manifest:args.manifest, 
      auth_url:args.authorization_url, 
      sig:args.signature});
  },
  getInstalled: function(callback) {
    gCallbacks[gCallbackIndex] = callback;
    postMessage({
      id:gCallbackIndex++,
      cmd:'getInstalled',
      origin:document.URL});    
  },
  getInstalledBy: function(callback) {
    gCallbacks[gCallbackIndex] = callback;
    postMessage({
      id:gCallbackIndex++,
      cmd:'getInstalledBy',
      origin:document.URL});    
  },
  setRepoOrigin: function() {
  },
  verify: function() {
  },
  mgmt: {
    list: function(callback) {
      gCallbacks[gCallbackIndex] = callback;
      postMessage({
        id:gCallbackIndex++,
        cmd:'list',
        origin:document.URL}
      );
    },
    loadState: function(stateID, callback) {
      gCallbacks[gCallbackIndex] = callback;
      postMessage({
        id:gCallbackIndex++,
        cmd:'loadState',
        stateID: stateID,
        origin:document.URL});
    },
    saveState: function(stateID, stateValue, callback) {
      gCallbacks[gCallbackIndex] = callback;
      postMessage({
        id:gCallbackIndex++,
        cmd:'saveState',
        stateID: stateID,
        stateValue: stateValue,
        origin:document.URL});
    },
    remove: function(appID, callback) {
      gCallbacks[gCallbackIndex] = callback;
      postMessage({
        id:gCallbackIndex++,
        cmd:'remove',
        appID:appID,
        origin:document.URL});    
    },
  }
};
