
let gServices = null;
let gActivity = null;

function configureServices(activity, services) {
    gServices = services;
    updateActivity(activity);
  let testservice = gServices[0];
  unsafeWindow.document.getElementById('servicebox').appendChild(testservice.iframe);
  testservice.on('ready', function() {
    testservice.call('testErrors', gActivity.data, function(result) {
      self.port.emit('owa.success', {code: 'test_failure', msg: 'unexpected success callback'});
    }, function(errob) {
      self.port.emit('owa.success', errob);
    });
  });
}

function updateActivity(activity) {
  gActivity = activity;
}

window.navigator.mozApps.mediation.ready(configureServices, updateActivity);

