
let gServices = null;
window.navigator.mozApps.mediation.ready(
function configureServices(action, services) {
    gServices = services;
  let testservice = gServices[0];
  unsafeWindow.document.getElementById('servicebox').appendChild(testservice.iframe);
},
function startActivity(activity) {
  let testservice = gServices[0];
  testservice.on('ready', function() {
    testservice.call('testErrors', activity.data, function(result) {
      self.port.emit('owa.success', {code: 'test_failure', msg: 'unexpected success callback'});
    }, function(errob) {
      self.port.emit('owa.success', errob);
    });
  });
});

