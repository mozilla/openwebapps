
let gServices = null;
let gActivity = null;

function configureServices(activity, services) {
    gServices = services;
  updateActivity(activity);
  let testservice = gServices[0];
  unsafeWindow.document.getElementById('servicebox').appendChild(testservice.iframe);
  testservice.on('ready', function() {
    testservice.call('echoArgs', gActivity.data, function(result) {
      self.port.emit('owa.success', result);
    }, function(errob) {
      self.port.emit('owa.failure', errob);
    });
  });
}
function updateActivity(activity) {
  gActivity = activity;
}

unsafeWindow.navigator.wrappedJSObject.mozApps.mediation.ready(configureServices, updateActivity);
