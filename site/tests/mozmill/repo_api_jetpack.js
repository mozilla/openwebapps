var setupModule = function(module) {
  module.controller = mozmill.getBrowserController();
  controller.open('http://127.0.0.1:60172/tests/spec/repo_api.html');
  controller.waitForPageLoad();
};

var testOpenWebAppsJetpack = function() {
  var timeout = 2000;
  controller.sleep(timeout);
  var button = new elementslib.Lookup(controller.window.document, '/id("main-window")/id("mainPopupSet")/id("notification-popup")/id("openwebapps-install-notification-notification")/anon([1])/{"class":"popup-notification-button-container","pack":"end","align":"center"}/anon({"anonid":"button"})/anon({"anonid":"button"})');
  
  for( var i = 0; i < 5; i++ ) {
    controller.click(button);
    controller.sleep(timeout);
  }
  
  controller.sleep(20000);
  var failCountElement = new elementslib.XPath(controller.tabs.activeTab, "/html/pre[@id='doctestOutput']/span[@class='failed']");

  controller.assertText(failCountElement, '0');
}
