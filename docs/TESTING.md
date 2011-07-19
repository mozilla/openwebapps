# Testing OpenWebApps

The goal behind OpenWebApps is to have an app ecosystem that works in both browsers that natively support the system (Firefox with the OpenWebApps Add-On) and browsers that do not but support the HTML5 features of window.postMessage and localStorage.  Because we are providing this functionality to both types of browsers, there are two libraries being developed simultaneously.  The first library is the OpenWebApps add-on, the second library is an HTML5 shim that provides an identical API.

There are two types of tests, one are OpenWebApps add-on unit tests.  The second are in-browser 'pseudo-unit/pseudo-integration' tests that can be run in the browser or automated using MozMill.


## Jetpack Based Unit Testing
The first set is to unit test the Jetpack based OpenWebApps add-on.  Jetpack based unit tests can be found in openwebapps/addons/jetpack/test.  Each test-*.js file is a unit test module.  There goal is one module per module in openwebapps/addons/jetpack/lib, but only for modules that are not shared with the HTML5 shim.  Shared modules at the moment are repo.js, manifest.js, typed_storage.js, and urlmatch.js. These tests can either make use of the standard facilities given by JetPacks unit-test module, or make use of a special framework located in openwebapps/addons/jetpack/test/helpers.  The extra framework is a slightly higher abstraction than the one provided with Jetpack.

Tests can be run from openwebapps/addons/jetpack using cfx.  See cfx documentation in the addon-sdk[https://github.com/mozilla/addon-sdk] and [https://addons.mozilla.org/en-US/developers/docs/sdk/1.0/dev-guide/addon-development/cfx-tool.html]. Documentation on writing tests can be found at: [https://addons.mozilla.org/en-US/developers/docs/sdk/1.0/packages/api-utils/docs/unit-test.html]

The provided framework provides extra meta-assertions as well as setup/teardown functionality not yet found in JetPack.  These assertions have been added to the JetPack code and a pull request is currently pending.  In the mean time, you can either download the updated version from [git://github.com/shane-tomlinson/addon-sdk.git], merge the patches into your own code from [https://github.com/mozilla/addon-sdk/pull/198], or use provided framework.  The provided framework provides these extra features.  An example of identical tests using both the framework and the standard JetPack API are found in tests/test-utils.js 

### Using the addon-sdk for Unit Testing

1. download the git repository. [https://github.com/mozilla/addon-sdk]
2. cd to addon-sdk
3. type 'source bin/activate'
4. cd to openwebapps/addons/jetpack
5. type 'cfx test' - additional parameters such as -p for profile or -f to specify an individual test module can be specified. A browser will be instantiated where the unit tests will be run.  When complete, the browser instance will quit and a report will be shown.

#### Meta-Assertions, startup, teardown functionality provided by the framework.
A pull request [https://github.com/mozilla/addon-sdk/pull/198] has been issued for these changes to make it into the baseline code.

setup/teardown are two functions that are often found in other unit test systems.  setup is run before each test.  This is normally used to construct an object whose state must be known at the beginning of the test. teardown is run after each test.  This can be used to deconstruct an object or do any cleanup that must be done.

The provided meta assertions are:
* assertFunction - check if item is a function
* assertUndefined - check if an item is undefined
* assertNotUndefined - check if an item is not undefined.  Not the same as "assert" as null, 0, and false will evaluate to true
* assertNull - check if an item is null
* AssertNotNull - check if an item is not null.  Not the same as "assert" as undefined, 0, and false will evaluate to true
* assertObject - check if an item is an object.
* assertString - check if an item is a string.
* assertArray - check if an item is an array.
* assertNumber - check if an item is a number.

### Guidelines for API/Chrome development as it Relates to Unit Testing
Further exploration into the Jetpack provided unit testing ecosystem is needed before guidelines can be created.

### Guidelines for Writing Unit Tests
1. Write tests!  Better before than after!
2. You know the phrase, "Test early, test often."
3. No test should depend on the state of a previous test.

## Integration Testing

The second set of tests are part unit/part integration are meant to test the entire OpenWebApps ecosystem in both browsers that support the OpenWebApps API and HTML5 compatible browsers that do not.  These tests must be run in the browser.  

These tests make use of DocTestJS[http://ianb.github.com/doctestjs/] as well as node.js to run the application serving engine.  These tests require user interaction unless run through MozMill.  A node.js server must be run to serve up services/apps that the tests use.  

Tests can be run in openwebapps/site/tests/.  All test specs are found in openwebapps/site/tests/spec/  Any new file added here will be automatically added to the list of tests.  The spec files make use of Djangode[https://github.com/simonw/djangode/] as a templating library, Djangode gives a Django compatible templating library to node.js.

### Running the Tests

#### Manual Testing
1. install node.js
2. If you have not done it, make sure all the openwebapps repo module dependencies are installed.
To do this, go to the openwebapps directory.  Type 'git submodule init', then 'git submodule update'
3. cd to openwebapps/site/tests
4. type 'node run.js'
5. copy the url presented.
6. open up a browser instance.  To test the HTML5 shim, open a browser that does not have the OpenWebApps add on installed.
7. select the series of tests to be run.

Since there both the HTML5 and OpenWebApps addon must be tested, these tests need run twice, once in a browser instance that has the OpenWebApps addon installed and enabled, and a second time in a browser that does not.  

#### Automated Testing using MozMill
1. install node.js
2. cd to openwebapps/site/tests
3. type 'node run.js'
4. Run the mozmill scripts.  These can be done from the MozMill plugin using the scripts found in mozmill.
4a. Scripts can be run from the MozMill firefox plugin - the scripts are located in the mozmill subdirectory under repo_api_jetpack.js and repo_api_html5.js
4b. Scripts can be run from the command line by running tes_addon.sh or test_html5.sh

Running these tests can be automated using MozMill.  More documentation for the MozMill tests can be found in openwebapps/site/tests/mozmill/README.md.

### Guidelines for HTML5 Shim development as it Relates to Testing

### Guidelines for Writing Tests
* New test modules are added to openwebapps/site/tests/spec.  Each file added to the spec directory will be automatically added to the list of possible tests to run.


