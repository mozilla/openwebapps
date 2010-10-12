### Mobile User Interactions

Most smartphone and tablet computing platforms are already application-centric.  The Installed Web Applications proposal aims to standardize the requirements for deployment of web applications across all mobile platforms and to clarify how developers can optionally charge for those applications.

The installation flow on a mobile device must validate the manifest, present a request for permissions to the user, and create a data structure that causes the application to appear in the normal location for the device.  For unregistered applications, launching the application should simply open a navigation-free web browser instance, preloaded with the application's launchURL.  For registered and paid applications, the browser should be directed to the authorizationURL of the application, which can validate the user and direct the browser to the application's launchURL with a validated identity and purchase token.

To support offline use, developers should make use of HTML5 AppCache and localStorage to enable the local components of their application to run without network access.  Application stores are encouraged to provide an option for local caching of registration and payment assertions, to allow a developer to indicate that they do not require online verification for every run; in many cases, a single check, or a weekly/monthly check is sufficient.

Developers are encouraged to use cross-platform JavaScript toolkits to target multiple mobile platforms.  For further reading, see <a href="http://www.sencha.com/products/touch/">Sencha</a> and <a href="http://jquerymobile.com/">jQuery Mobile</a>.

