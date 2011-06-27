var setupModule = function(module) {
  module.controller = mozmill.getBrowserController();
}

var setupTest = function(test) {

  controller.open('http://127.0.0.1:60172/tests/spec/repo_api.html');
  controller.waitForPageLoad();
}


var testFoo = function() {
  var timeout = 2000;
  var button = new elementslib.ID(controller.tabs.activeTab.defaultView.frames[0].document, "installButton");
  
  for( var i = 0; i < 2; i++ ) {
    controller.sleep(timeout);
    controller.click(button);
  }

  controller.sleep(timeout);
  
  var innerButton = new elementslib.ID(controller.tabs.activeTab.defaultView.frames[2].frames[0].document, "installButton");
  controller.click( innerButton );
  
  for( var i = 0; i < 2; i++ ) {
    controller.sleep(timeout);
    controller.click(button);
  }
  
  controller.sleep(timeout);
  var okButton = new elementslib.Link(controller.tabs.activeTab.defaultView.frames[0].document, "http://127.0.0.1:50007");
  controller.click(okButton);
  
  controller.sleep(2000);
  controller.click(button);
  
  controller.sleep(2000);
  
  var okButtonImageSend = new elementslib.Link(controller.tabs.activeTab.defaultView.frames[0].document, "http://127.0.0.1:50006");
  controller.click(okButtonImageSend);
  
  controller.sleep(5000);

  var failCountElement = new elementslib.XPath(controller.tabs.activeTab, "/html/pre[@id='doctestOutput']/span[3]")
  controller.assertText(failCountElement, '0');
}
