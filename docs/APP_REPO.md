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

*   `install({ manifest: <manifest object> , [  authorization_url: <url> ], [ signature: <sig> ], callback: <function> }):`

    Prompts the user for confirmation of the manifest, possibly checking the installation and application domains against a registry of known malware sites.  If the user consents, the manifest is installed into the repository, along with the hostname of the installing site and a timestamp.  If the installing site does not use SSL, the user will be strongly discouraged from installing the application.   When the installation flow is completed with success or failure, the installing website is notified through the callback.

     The optional authorization_url and signature fields are persisted into local storage along with the manifest, as part of the installation. ([wiki](http://wiki.mozilla.org/Labs/Apps/MyApps#install))

*   `getInstalled( <callback> ):`

    returns, through the callback, the installed applications whose URLs are contained by the calling site.  This allows an application to find out whether its manifest has been installed on a browser when the user visits the site. ([wiki](http://wiki.mozilla.org/Labs/Apps/MyApps#getInstalled))

*   `getInstalledBy( <callback> ):`

    returns, through the callback, the applications that were installed by the calling domain.  This allows an application directory or store to determine if an application is already installed, during browsing. ([wiki](http://wiki.mozilla.org/Labs/Apps/MyApps#getInstalledBy))

*   `verify ( [<return-to>], <callback> ):`

    selects the application whose URL matches the calling site, and initiates the verification flow for that application by loading the authorizationURL of the application.  <!-- FIXME: what happens when more than one matches? --> See [The Verification Flow](verification.html). ([wiki](http://wiki.mozilla.org/Labs/Apps/MyApps#verify))

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


#### Mobile Considerations

Most mobile platforms already organize themselves around an *application launcher*.  See the <a href="mobile.html">Mobile Platforms</a> page for more discussion of these platforms.

#### See Also

Also see the related [wiki page](http://wiki.mozilla.org/Labs/Apps/MyApps#JS_API).
