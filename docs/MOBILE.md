### Mobile User Interactions

Most smartphone and tablet computing platforms are already application-centric.  The Installed Web Applications proposal aims to standardize the requirements for deployment of web applications across all mobile platforms and to clarify how developers can optionally charge for those applications.

In most cases, application directories or stores can perform the "heavy lifting" of platform integration.

The installation flow on a mobile device must validate the manifest, present a request for permissions to the user, and create a data structure that causes the application to appear in the normal location for the device.  For unregistered applications, launching the application should simply open a navigation-free web browser instance, preloaded with the application's launchURL.  For registered and paid applications, the browser should be directed to the authorizationURL of the application, which can validate the user and direct the browser to the application's launchURL with a validated identity and purchase token.

*Example*: Apple Computer's iOS provides excellent display and launching of web applications from the default application launcher.  JavaScript extensions exist on the Mobile Safari platform to determine whether the application is being viewed in Safari, or as a standalone ("webclip") application.  Application stores that wish to provide proof-of-purchase verification to web applications can easily save their verification URL as the target URL of the webclip, and can verify the user's registration and forward to the application on startup; caching of this verification for a reasonable period can reduce the latency of startup to create a faster launch experience.

#### Offline Use

To support offline use, developers should make use of HTML5 AppCache and localStorage to enable the local components of their application to run without network access.  Application stores are encouraged to provide an option for local caching of registration and payment assertions, to allow a developer to indicate that they do not require online verification for every run; in many cases, a single check, or a weekly/monthly check is sufficient.

#### Multiplatform Development

Developers are encouraged to use cross-platform JavaScript toolkits to target multiple mobile platforms.  For further reading, see <a href="http://www.sencha.com/products/touch/">Sencha</a> and <a href="http://jquerymobile.com/">jQuery Mobile</a>.
