### The Application Repository and Dashboard

The application repository is a client-side trusted collection of the manifests that the user has installed.

We have implemented a prototype repository in HTML5 at `myapps.mozillalabs.com` ([wiki](http://wiki.mozilla.org/Labs/Apps/MyApps)), but future repositories could be implemented in [browser extensions](http://wiki.mozilla.org/Labs/Apps/Browser_Native_Repository) or as part of a web browser platform. <!-- FIXME: I think we have some specific reasons for a hosted repository, which we could explain?  Particularly browser-neutrality and portability -->

The application repository provides a limited, privacy-respecting API to web content, which allows it to interact with other websites to give users a smooth experience of using web applications.  It also powers the **application dashboard**, a rich HTML5 interface to manage and launch applications from the browser.

If the application repository is implemented by browser makers (or in extensions), a similar API will need to be provided.

#### Install API <a name="install-api"></a>

Also see the related [wiki page](http://wiki.mozilla.org/Labs/Apps/MyApps#JS_API).

App stores or specific applications can interact with the repository by including the Javascript from `https://myapps.mozillalabs.com/jsapi/include.js` and use the `AppClient` object that is exposed.  In the `myapps.mozillalabs.com` case, we expose four functions:

*   `install({ manifest: <manifest object> , [  authorization_url: <url> ], [ session: <session> ], [ signature: <sig> ], callback: <function> }):`

    Prompts the user for confirmation of the manifest, possibly checking the installation and application domains against a registry of known malware sites.  If the user consents, the manifest is installed into the repository, along with the hostname of the installing site and a timestamp.  If the installing site does not use SSL, the user will be strongly discouraged from installing the application.   When the installation flow is completed with success or failure, the installing website is notified through the callback.

     The optional authorization_url and signature fields are persisted into local storage along with the manifest, as part of the installation. ([wiki](http://wiki.mozilla.org/Labs/Apps/MyApps#install))

*   `getInstalled( <callback> ):`

    returns, through the callback, the installed applications whose URLs are contained by the calling site.  This allows an application to find out whether its manifest has been installed on a browser when the user visits the site. ([wiki](http://wiki.mozilla.org/Labs/Apps/MyApps#getInstalled))

*   `getInstalledBy( <callback> ):`

    returns, through the callback, the applications that were installed by the calling domain.  This allows an application directory or store to determine if an application is already installed, during browsing. ([wiki](http://wiki.mozilla.org/Labs/Apps/MyApps#getInstalledBy))

*   `verify ( [<return-to>], <callback> ):`

    selects the application whose URL matches the calling site, and initiates the verification flow for that application by loading the authorizationURL of the application.  <!-- FIXME: what happens when more than one matches? --> See [The Verification Flow](verification.html). ([wiki](http://wiki.mozilla.org/Labs/Apps/MyApps#verify))

<!-- FIXME: probably some simple example is called for here? Or link to some examples page on wiki -->


#### Mobile Considerations

Most mobile platforms already organize themselves around an *application launcher*.  See the <a href="mobile.html">Mobile Platforms</a> page for more discussion of these platforms.
