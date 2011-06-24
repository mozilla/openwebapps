# Testing OpenWebApps

Since the goal behind OpenWebApps is to have an app ecosystem that works in both browsers that natively support the system (Firefox with the OpenWebApps Add-On) and those browsers that do not but support the HTML5 features of window.postMessage and localStorage, there are two libraries being developed to provide this functionality.

Unfortunately, at the moment, this means two sets of tests must be run, in two different environments.  The first is Jetpack based testing, the second is in browser testing of the HTML5 shim.

## Jetpack Based Unit Testing
The first set is to unit test the Jetpack based OpenWebApps add-on.  Jetpack based unit tests can be found in openwebapps/addons/jetpack/test.  Each test-*.js file is a unit test module.  There goal is one module per module in openwebapps/addons/jetpack/lib, but only for modules that are not shared with the HTML5 shim.  Shared modules at the moment are repo.js, manifest.js, typed_storage.js, and urlmatch.js.

Tests can be run from openwebapps/addons/jetpack using cfx.  See cfx documentation in the addon-sdk[https://github.com/mozilla/addon-sdk].  

### Using the addon-sdk for Unit Testing

1. download the git repository. [https://github.com/mozilla/addon-sdk]
2. cd to addon-sdk
3. type 'source bin/activate'
4. cd to openwebapps/addons/jetpack
5. type 'cfx test' - additional parameters such as -p for profile can be specified. A browser will be instantiated where the unit tests will be run.  When complete, the browser instance will quit and a report will be shown.

### Guidelines for API/Chrome development as it Relates to Unit Testing
Further exploration into the Jetpack provided unit testing ecosystem is needed before guidelines can be created.

### Guidelines for Writing Unit Tests
Guidelines for writing unit tests are still being developed and will be added here.

## HTML5 Shim Unit Testing/Regression Testing

The second set of tests are meant to test the HTML5 shim for browsers that do not natively support the OpenWebApps system.  The functionality provided by the OpenWebApps API is patched in using a call to a Mozilla hosted Javascript library.  The unit tests for these are browser based, and require user interaction.  A node.js server must be run to serve up services/apps that the tests use.  These tests can also be used to regression test browsers that natively support the OpenWebApps API.

Tests can be run in openwebapps/site/tests/.  All test specs are found in openwebapps/site/tests/spec/  Any new file added here will be automatically added to the list of tests.

### Running the Unit Tests

1. install node.js
2. cd to openwebapps/site/tests
3. type 'node run.js'
4. copy the url presented.
5. open up a browser instance.  To test the HTML5 shim, open a browser that does not have the OpenWebApps add on installed.
6. select the series of tests to be run.

### Guidelines for HTML5 Shim development as it Relates to Unit Testing

### Guidelines for Writing Unit Tests

