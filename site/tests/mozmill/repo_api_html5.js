var setupModule = function(module) {
  module.controller = mozmill.getBrowserController();
}

var setupTest = function(test) {

  controller.open('http://127.0.0.1:60172/tests/spec/repo_api.html');
  controller.waitForPageLoad();
}


var testHTML5Shim = function() {
  var timeout = 2000;
  var button = new elementslib.ID(
          controller.tabs.activeTab.defaultView.frames[0].document, "installButton");

  controller.sleep(timeout);
  
  // Install the first two apps.  The first app installation causes the app 
  // dashboard to appear, so we must set the tabIndex back to the original app.
  for( var i = 0; i < 2; i++ ) {
    controller.click(button);
    controller.tabs.selectTabIndex(0);
    controller.sleep(timeout);
  }

  // Sleep a few - now things get slightly ghetto.  The next app is installed 
  // inside of another app.  Because of this, we have to get a reference to the 
  // inner installButton and click it.
  //controller.sleep(timeout);
  
  var innerInstallButton = new elementslib.ID(
          controller.tabs.activeTab.defaultView.frames[2].frames[0].document, "installButton");
  controller.click( innerInstallButton );
  
  // The next two apps install as normal.
  for( var i = 0; i < 2; i++ ) {
    controller.sleep(timeout);
    controller.click(button);
  }
  
  controller.sleep(timeout);

  // Now, apps are running invokeService - these open up a dialog requesting 
  // permission, we have to get references to the inner links to allow the 
  // service to be used.
  var okButton = new elementslib.XPath(
          controller.tabs.activeTab.defaultView.frames[0].document, "/html/body/div[2]/ul/li/a");
  controller.click(okButton);
  
  // A normal app install
  controller.sleep(2000);
  controller.click(button);
  
  controller.sleep(2000);
  
  // Another invokeService being run, this time for image.send
  var okButtonImageSend = new elementslib.XPath(
          controller.tabs.activeTab.defaultView.frames[0].document, "/html/body/div[2]/ul/li/a");
  controller.click(okButtonImageSend);
  
  // Wait for results stuff to finish.
  controller.sleep(5000);

  var failCountElement = new elementslib.XPath(
          controller.tabs.activeTab, '//span[@class="failed"]')
  controller.assertText(failCountElement, '0');
}
