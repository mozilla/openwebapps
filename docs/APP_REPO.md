### The Application Repository and Dashboard

The application repository is a client-side trusted collection of the manifests that the user has installed.

We have implemented a prototype repository in HTML5 at `myapps.mozillalabs.com` ([wiki](http://wiki.mozilla.org/Labs/Apps/MyApps)), but future repositories could be implemented in [browser extensions](http://wiki.mozilla.org/Labs/Apps/Browser_Native_Repository) or as part of a web browser platform.  A pure HTML implementation allows users to try out open web apps without installing or upgrading their software, while native browser support could considerably improve security, and user experience.

The application repository provides a limited, privacy-respecting API
to web content, which allows it to interact with other websites to
give users a smooth experience of using web applications.  It also
powers the **application dashboard**, a rich HTML5 interface to manage
and launch applications from the browser.

#### Accessing the API <a name="accessing-the-api"></a> 

The application repository API can be enabled by including a javascript
library.  This library will detect whether native API support is enabled
by the user's browser, if not it will shim in a pure HTML implementation.

The javascript library should be included from:

    https://myapps.mozillalabs.com/jsapi/include.js

All APIs related to open web applications are accessed under the
`navigator.apps` object.  There are two distinct types of functions available
in the API:

1. "Installation API" - functions related to the installation or
   management of installed applications - Interesting to stores,
   self-distributing applications, and app directories.

2. "Management API" - functions related to the display, launch or
   synchronization of applications.  Primarily used by dashboards
   authored in HTML.

#### Installation API (`navigator.apps.*`) <a name="install-api"></a>

The installation API is exposed as properties on the `navigator.apps` object.

*   `install({ url: <url to manifest> , [ install_data: <object> ], [ onsuccess: <function> ], [ onerror: <function> ] }):`

    Trigger the installation of an application.  During the installation process, the application will be validated
    and the user prompted to approve the installation.

    **url** is a `string` URL containing the location of the manifest to be installed.  In the case of self distribution
    (where the installing origin is the same as the application origin), the installing site may omit the origin part of
    the url and provide an absolute path (beginning with '/').

    **install_data** is an `object` containing data that will be associated with the installed application.
    This object may be used as a means of an installing site (possibly store or directory) communicating with an
    application.  Information related to purchase verification may be transmitted in this object.

    **onsuccess** is a function that will be invoked if the application is successfully installed.

    **onerror** is an [error callback](#error_object) that will be invoked if the installation fails.  Possible error
    codes include:

        * `denied` - if the user refuses to install the application
        * `permissionDenied` - if the installing site is not allowed to trigger the installation
        * `manifestURLError` - if the url to the manifest is malformed
        * `networkError` - if the application host is unreachable
        * `manifestParseError` - if the manifest contains syntax errors (not proper JSON)
        * `invalidManifest` - if the manifest contains semantic errors (i.e. missing required properties)

    Finally, the install() function will throw an exception if required arguments are missing (url), or if
    unsupported arguments are present.

*   `amInstalled( <onsuccess callback>, [onerror callback] ):`

    returns, through the callback, the installed applications whose URLs are contained by the calling site.  This allows an application to find out whether its manifest has been installed on a browser when the user visits the site. ([wiki](http://wiki.mozilla.org/Labs/Apps/MyApps#getInstalled))

*   `getInstalledBy( <callback> ):`

    returns, through the callback, the applications that were installed by the calling domain.  This allows an application directory or store to determine if an application is already installed, during browsing. ([wiki](http://wiki.mozilla.org/Labs/Apps/MyApps#getInstalledBy))

<!-- FIXME: probably some simple example is called for here? Or link to some examples page on wiki -->

#### Management API (`navigator.apps.mgmt.*`)  <a name="mgmt-api"></a>

The Management API is part of the application repository's API which is priviledged,
intended to grant access to trusted pages, or "Dashboards".  The API exposes calls
which let dashboards manage and launch applications on a users behalf.  Additionally
the API exposes functions to fuel application sync, which lets the dashboard display
the logged-in state of the user and allows the user to sign up or register for an
account to sync their applications.

*   `list( <callback> )`

    XXX: should there be a locale argument to list?  where should localization occur?

    List all installed applications.  The return value is an an array of objects.  Each object has the following properties:

    `id (string)`: A unique identifier for the application.  
    `installURL (string)`: The url from which the application was installed  
    `installTime (integer)`: The time that the application was installed (generated via Date().getTime, represented as the number of milliseconds between midnight of January 1st, 1970 and the time the app was installed).  
    `icons (object)`: An object mapping strings representing icon size (i.e. '96' or '128') to urls of the actual icon (often data urls)  
    `name (string)`: The human readable (localized) name of the application.  
    `description (string)`: The human readable (localized) description of the application.  
    `launchURL (string)`: The url that the user should be redirected to where the application can be launched.  
    `developer (object)`: An object containing `name` and `url` properties describing the developer of the application  

*   `remove( <id>, <callback> )`

    Remove an application from the repository.  `id` is the unique launch URL of the application, and the callback will be invoked after the operation completes.

*  `saveState( <dashboard identifier>, <stateObject>, [callback] )`

    Save dashboard specific state into the application repository.  This function should be used by dashboards to persist context.  This function is superior to other persistence mechanisms as it allows for the backup and synchronization of a users state, if the user so desires.  `dashboard identifier` could be a guid, or some string which is a reasonably unique dashboard implementation identifier under which the state data will be scoped.  

*  `loadState( <dashboard identifier>, <callback> )`

    Load state saved by `saveState`.  

*  `getLoggedInUser( <callback> )`

    Determine whether a user is currently authenticated to the application repository for the purposes of application synchronization.  The callback takes a single argument which is `null` when no user is logged in, otherwise the argument is a javascript object containing the following properties:

    `userName (string)`: a unique identifier which is meaningful to both the system and the user (i.e. email address). 
    `displayName (string)`: a human readable identifier which identifies a user (not neccesarily unique, i.e. first name).

*  `login( <callback> )`

    Cause the application repository to display login UI to the user.  A callback will be invoked when the process of user authentication is complete and will be provided the same arguments as the callback to `getLoggedInUser()`.

*  `logout( <callback> )`

    Logout the currently authenticated user.  A noop if no user is currently authenticated.  The callback argument will be invoked when the operation is complete and takes no arguments.

#### Error Objects  <a name="error-objects"></a>

XXX

#### Mobile Considerations

Most mobile platforms already organize themselves around an *application launcher*.  See the <a href="mobile.html">Mobile Platforms</a> page for more discussion of these platforms.

#### See Also

Also see the related [wiki page](http://wiki.mozilla.org/Labs/Apps/MyApps#JS_API).
