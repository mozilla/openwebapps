#MozMill Tests

These MozMill[https://developer.mozilla.org/en/Mozmill] tests are intended to 
automatically run the unit tests that are written in jsDocs.  There are two 
tests here, the first is for the HTML5 shim, the second for the JetPack addon.

To run these scripts, MozMill must be installed, either the 
addon[https://addons.mozilla.org/en-US/firefox/addon/mozmill/] or the command 
line variant 
[https://developer.mozilla.org/en/Mozmill_Tests#Installing_Mozmill].

These tests will perform the interaction that is normally required of the user.

When performing tests on the HTML5 version, the instance of FireFox must NOT 
have the OpenWebApps addon installed.

These tests can be run both from the command line and using the MozMill Firefox 
extension.

Before running the tests, the node.js server must be started to server up the 
applications.  This is done from the openwebapps/site/tests directory.

1. cd ..
2. node run.js

Mozmill makes use of cfx from the 
addon-sdk[https://github.com/mozilla/addon-sdk/], so this should be available.

From the shell that you want to write the tests, go to the addon-sdk directory 
and type:

    source bin/activate

Then return to this directory and run:

html5: ./test_html5.sh
addon: ./test_addon.sh


