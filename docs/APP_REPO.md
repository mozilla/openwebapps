### The Application Repository and Dashboard

The application repository is a client-side trusted collection of the manifests that the user has installed.

We have implemented a prototype repository in HTML5 at `myapps.mozillalabs.com`, but future repositories could be implemented in browser extensions or as part of a web browser platform.

It provides a limited, privacy-respecting API to web content, which allows it to interact with other websites to give users a smooth experience of using web applications.  It also provides the dashboard, a rich HTML5 interface to manage and launch applications from the browser.

If the application repository is implemented by browser makers (or in extensions), a similar API will need to be provided.

In the `myapps.mozillalabs.com` case, we expose three APIs:

*   `install( <manifest> , [ <authorizationURL> ], [ <signature> ], <callback>):`

    prompts the user for confirmation of the manifest, possibly checking the installation and application domains against a registry of known malware sites.  If the user consents, the manifest is installed into the repository, along with the hostname of the installing site and a timestamp.  If the installing site does not use SSL, the user will be strongly discouraged from installing the application.   When the installation flow is completed with success or failure, the installing website is notified through the callback.
    
     the optional authorizationURL and signature fields are persisted into local storage along with the manifest, as part of the installation.
    
*   `getInstalled( <callback> ):`
    
    returns, through the callback, the installed applications whose URLs are contained by the calling site.  This allows an application to find out whether its manifest has been installed on a browser when the user visits the site.
    
*   `verifyIdentity ( [<return-to>], <callback> ):`
    
    selects the application whose URL matches the calling site, and initiates the verification flow for that application by loading the authorizationURL of the application.  {what happens when more than one matches?} See The Verification Flow.


#### Mobile Considerations

Most mobile platforms already organize themselves around an *application launcher*.  On mobile platforms, Installed Web Apps should work with existing platforms to make the web application launch act like a platform-specific binary application.

In most cases, application directories or stores can perform the "heavy lifting" of platform integration.

*Example*: Apple Computer's iOS provides excellent support for the display and launch of web applications from the default application launcher.  JavaScript extensions exist on the Mobile Safari platform to determine whether the application is being viewed in Safari, or as a standalone ("webclip") application.  Application stores that wish to provide proof-of-purchase verification to web applications can easily save their verification URL as the target URL of the webclip, and can verify the user's registration and forward to the application on startup; caching of this verification for a reasonable period can reduce the latency of startup to create a faster launch experience.