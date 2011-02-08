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
   synchronization of applications.  Primarily used by dashboards.

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

    **onsuccess** is a callback that will be invoked with no arguments if the application is successfully installed.

    **onerror** is an [error callback](#error-object) that will be invoked if the installation fails.  Possible error
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

    Provides a means for an application to check if it's installed.  Once determined, the `onsuccess` function will
    be invoked with a single argument: an [application object](#app-object) if installed, or `null` if not.

*   `getInstalledBy( <onsuccess callback>, [onerror callback] ):`

    Returns, through the callback, the applications that were installed by the calling domain.  This allows an application
    directory or store to determine which applications it has installed on behalf of the current user. ([wiki](http://wiki.mozilla.org/Labs/Apps/MyApps#getInstalledBy)).  `onsuccess` will be invoked with an array of the [application objects](#app-object) installed by the calling origin.

#### Management API (`navigator.apps.mgmt.*`)  <a name="mgmt-api"></a>

The Management API is part of the application repository's API which is priviledged,
intended to grant access to trusted pages, or "Dashboards".  The API exposes calls
which let dashboards manage and launch applications on a users behalf.  Additionally
the API exposes functions to fuel application sync, which lets the dashboard display
the logged-in state of the user and allows the user to sign up or register for an
account to sync their applications.

*   `list( <onsuccess callback>, [onerror callback] )`

    List all installed applications.  The return value is a object which contains
    [application objects](#app-object) indexed by their origin.

*   `uninstall( <origin>, [onsuccess callback], [onerror callback] )`

    Uninstall an application from the repository.  `origin` is the origin the application to be removed.
    onsuccess will be invoked subsequent to the application's removal, or onerror will be invoked
    and passed an [error object](#error-object) with a code of `noSuchApp` if the specified application
    doesn't exist.

*  `saveState( <stateObject>, [onsuccess callback], [onerror callback] )`

    Save dashboard specific state into the application repository.  This function should be used by dashboards to persist context.  This function is superior to other persistence mechanisms as it allows for the backup and synchronization of a users state, if the user so desires.

*  `loadState( <onsuccess callback>, [onerror callback] )`

    Load state saved by `saveState`, and returns it asynchronously to the `onsuccess` callback.

*  `getLoggedInUser( <onsuccess callback>, [onerror callback] )`

    Determine whether a user is currently authenticated to the application repository for the purposes of application synchronization.
    The callback receives a single argument which is `null` when no user is logged in, otherwise the argument is a javascript object
    containing the following properties:

    `userName (string)`: a unique identifier which is meaningful to both the system and the user (i.e. email address). 
    `displayName (string)`: a human readable identifier which identifies a user (not neccesarily unique, i.e. first name).

*  `login( <onsuccess callback>, [onerror callback] )`

    Cause the application repository to display login UI to the user.  The `onsuccess` callback will be invoked when the
    process of user authentication is complete and will be provided the same arguments as the callback to `getLoggedInUser()`.

*  `logout( <onsuccess callback>, [onerror callback] )`

    Logout the currently authenticated user.  A noop if no user is currently authenticated.  The `onsuccess` callback argument will be
    invoked when the operation is complete and receives no arguments.

#### Application Representation  <a name="app-object"></a>

Wherever *application objects* are returned via the api, they are represented as javascript objects
with the following fields:

    `origin (string)`: The origin of the application (scheme, host, and port)
    `manifest (object)`: The currently stored version of the manifest of the application.
    `install_time (integer)`: The time that the application was installed (generated via Date().getTime, represented as the number of milliseconds between midnight of January 1st, 1970 and the time the app was installed).  
    `install_origin (string)`: The origin of the site that triggered the installation of the application.

#### Error Objects  <a name="error-object"></a>

Errors are returned via callbacks in the API.  Errors are represented as javascript
objects with the following properties:

    `code (string)`: A short, english, camel cased error code that may be programmatically
                     checked to optimize user facing error displays.
    `message (string)`: A short, english, developer readable sentence that describes the cause
                     of the error in more specifics.  Useful for debugging and error logs.

#### Mobile Considerations

Most mobile platforms already organize themselves around an *application launcher*.  See the <a href="mobile.html">Mobile Platforms</a> page for more discussion of these platforms.

#### See Also

Also see the related [wiki page](http://wiki.mozilla.org/Labs/Apps/MyApps#JS_API).
