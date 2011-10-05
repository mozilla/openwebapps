
let gServices = null;
window.navigator.mozApps.mediation.ready(
function configureServices(action, services) {
    dump("configureServices called!\n");
    gServices = services;
  let testservice = gServices[0];
  unsafeWindow.document.getElementById('servicebox').appendChild(testservice.iframe);
},
function startActivity(activity) {
    dump("startActivity called!\n");
  let testservice = gServices[0];
  testservice.on('ready', function() {
    testservice.call('echoArgs', activity.data, function(result) {
      self.port.emit('owa.success', result);
    }, function(errob) {
      self.port.emit('owa.failure', errob);
    });
  });
});
