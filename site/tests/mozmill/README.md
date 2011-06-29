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

To run the html5 test, run test_html5.sh
To run the addon test, run test_addon.sh


