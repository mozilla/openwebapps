const FFRepoImpl = require("api").FFRepoImplService;
const {installTestApp, uninstallTestApp, ensureNoTestApp} = require("./helpers/helpers");

exports.testSimpleInstall = function(test) {
  test.waitUntilDone();
  installTestApp(test, "apps/basic/basic.webapp",
    function() { // success callback.
      test.pass("got success callback for installing the app");
      test.done();
    }
  );
};

exports.testUninstallWhenNotInstalled = function(test) {
  test.waitUntilDone();
  let appPath = "apps/basic/basic.webapp";

  ensureNoTestApp(test, appPath, function () {
    uninstallTestApp(test, appPath,
      function(result) { // success CB
        test.fail("got a success callback uninstalling an already uninstalled app");
        test.done();
      },
      function(errob) { //errback
        test.assertEqual(errob.code, "noSuchApplication");
        test.done();
      }
    );
  });
};
