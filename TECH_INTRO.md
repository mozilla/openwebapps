## Installable Web Apps Technical Overview

This document describes an architecture for "Installable Web Applications."  These are applications constructed using standard web technologies including HTML5, CSS3, and JavaScript, which can run in any modern web browser.

The system presented here provides for both free and paid applications.  It presumes that there will be multiple application stores, and that users will have applications from multiple stores on their devices.  Developers are similarly expected to be free to list their applications on multiple stores, and to enter independent relationships with each.  Developers should be free to self-publish their application, or to create a curated application directory.

This document is intended as a proposal to the web user and developer community, and direct constructive feedback is very welcome.  Throughout the document, links to the Mozilla wiki are placed inline where a topic of discussion is raised.  Readers are encouraged to visit the wiki to contribute to the conversation.

### Overview

This proposal defines an "Installable Web Application" in terms of the existing HTML and HTTP technology stack.  The HTML5 specification describes how a web browser can provide local storage, offline access to applications and data, geolocation services, and rich 2D and 3D graphics capabilities.

A Web Application is built on the HTML5 foundation, adding easy browsing and launching, an explicit installation flow, and verification of user registration between stores and applications, which enables proof of purchase.  The basic set of interactions require no new browser features and should work in any modern web browser with HTML5 support.  Some richer interactions, which would require additional browser work but can often be implemented with extensions, are also described here.

It is a primary goal of this proposal to allow a user to navigate through a collection of applications in a store or directory, select one to install, provide payment information if needed, and receive the installed application into a "dashboard" that holds all of his or her applications.  When the user subsequently launches the application (by mouse, keyboard, or followed link), the application should be able to verify the user's registration or ownership immediately, so that the user has a "one click" launch experience into a personalized, registered application experience.

It is not a goal of this proposal to explain how an all-HTML5 application can be downloaded to a desktop computer and subsequently protected from copying.  The focus of this proposal is on online verification of user proof-of-install, or proof-of-purchase.

The basic set of concepts required to construct a Web Application are:

* An application manifest, which describes the location, requirements, and capabilities of an application.
* A method to install an application into a user's browser, which can be used by stores and directories (for purchased or curated applications) or by an application itself (for a self-published application)
* A view to manage, browse, and launch the installed applications
* A network interaction to allow the application to confirm the user's registration or purchase from a store.

The approach taken in this proposal is to create an application repository and application dashboard, which reside entirely in the local storage of the browser.  We have created a prototype repository and dashboard that run entirely in HTML5, and are hosted at myapps.mozillalabs.com.  The ability to install applications and verify user registration is exposed to applications through a cross-domain JavaScript library that uses the HTML5 postMessage API to securely communicate between the application and the myapps domain.  The capabilities of the repository and dashboard could equally be provided by browser-native functions, with some security benefits (see discussion below).  Note that, while though the code for the dashboard is provided by myapps.mozillalabs.com, users' installed application manifests are stored entirely on their local browsers.  The myapps server has no database of users or apps, and issues no cookies to its users; it serves only to provide a JavaScript program which runs entirely inside the browser.

### The Application Manifest

The Manifest is a complete description of what the web browser needs to interact with the application.  It provides both human-readable elements (a name, a set of icons, and a description; possibly in multiple languages) and machine-readable elements (URLs, lists of capabilities), which allow the application repository and dashboard to display and launch applications.

The Manifest is encoded as a JSON data structure, and is provided to the browser when the application is installed.  A self-published application manifest is provided by the application developer.  A curated or purchased application manifest is provided by the directory or store.  The manifest is persisted in local storage and is used by the dashboard and repository for subsequent interactions with the user.

For detailed description of the manifest, and discussion of its design, visit wiki:Manifest. {need real url here}  (Note that the design of the manifest is intended to build on and comment on existing work by Google on hosted web application manifests; please see the wiki for more in-depth discussion)

For a discussion of the security and privacy considerations around the application manifest, please see Security and Privacy Considerations, below.  In particular, for a discussion of using digital signatures to create tamper-evident manifests, see wiki:Manifest#Signatures {need real url here}

    {
      "name": "MozillaBall",
      "description": "Exciting Open Web development action!",
      "app": {
        "urls": [
          "https://mozillaball.mozillalabs.com"
        ],
        "base_url": "https://mozillaball.mozillalabs.com",
        "launch_path": "",
        "update_path": "manifest/manifest.json",
        "authorization_url": "https://store.somewhere.com"
      },
      "capabilities": [
      "geolocation"
      ],
      "icons": {
        "16": "icon-16.png",
        "48": "icon-48.png",
        "128": "icon-128.png"
      },
      "developer": {
        "name": "Mozilla Labs",
        "url": "http://mozillalabs.com"
      }
      "locales": {
        "es": {
          "description": "¡Acción abierta emocionante del desarrollo del Web!",
          "developer": {
            "url": "http://es.mozillalabs.com/",
          }
        },
        "it": {
          "description": "Azione aperta emozionante di sviluppo di fotoricettore!",
          "developer": {
            "url": "http://it.mozillalabs.com/"
          }
        }
      }
    }

### HTML5 implementation vs. browser-native implementation

The prototype myapps.mozillalabs.com repository can be included in any website through a simple JavaScript include.  It provides the install, getInstalled, and verifyIdentity methods through a secure cross-domain messaging API.    The myapps.mozillalabs.com dashboard can be loaded by simply navigating to the site in a browser.  It displays the currently installed applications, and launches them when they are clicked.

Note that we do not propose making myapps.mozillalabs.com a permanent delivery point for an application dashboard; see the Security and Privacy Considerations section for a discussion of a longer-term strategy.

Browser-native implementations can take deeper security measures, and integrate more with desktop and mobile operating systems, than a pure web-content dashboard.  We propose that experimental integration with browser-native functions be organized under a "window.navigator.apps" object.  New methods can be attached at this point and made available, in a limited way, to browser-native or web-based application dashboards.  Specific directions for browser integration include:

* Implementation of an installed application repository that resides in secure, tamper-evident desktop storage
* Ability to launch applications into an "app tab" or "pinned tab" that has a fixed location in the tab bar.
* Integration with browser-based permission APIs, including geolocation, storage, and file access
* Ability to launch applications into a "chromeless" mode (with no toolbars, location bar, or forward or backward buttons)
* Access to OS-level notification systems

Any access to browser or OS-level functionality should require a more stringent installation step, and may require verification of the manifest - see Security and Privacy Considerations.


### The User's Application Repository and Dashboard

The application repository is a trusted collection of the manifests that the user has consented to install.  It provides a limited, privacy-respecting API to web content, which allows it to interact with other websites to give users a smooth experience of using web applications.  It also provides the dashboard, a rich HTML5 interface to manage and launch applications from the browser.

In the myapps.mozillalabs.com case, we expose three APIs:

*   `install( <manifest> , <callback>):`

   	prompts the user for confirmation of the manifest, possibly checking the installation and application domains against a registry of known malware sites.  If the user consents, the manifest is installed into the repository, along with the hostname of the installing site and a timestamp.  If the installing site does not use SSL, the user will be strongly discouraged from installing the application.   When the installation flow is completed with success or failure, the installing website is notified through the callback.
    
*   `getInstalled( <callback> ):`
    
    returns, through the callback, the installed applications whose URLs are contained by the calling site.  This allows an application to find out whether its manifest has been installed on a browser when the user visits the site.
    
*   `verifyIdentity ( [<return-to>], <callback> ):`
    
    selects the application whose URL matches the calling site, and initiates the verification flow for that application by loading that URL.  {what happens when more than one matches?} See The Verification Flow.

### The Verification Flow

The goal of this flow is to allow a user to load a purchased or registered application and, without presenting any additional credentials, receive an authenticated and personalized experience.  This proposal does not require any one federated authentication solution, but provides a simple system to initiate federated login for a particular user-store-application combination.

The verification flow is very similar to a directed OpenID authentication flow, and store implementors may choose to adopt that flow for verification.  In that case, an OpenID attribute containing the application ID that was successfully verified would be sent in the response, along with the user identity.  One notable difference from the OpenID 2.0 use case is that the application store can be confident of the realm, so the need for a return_to or realm argument is relaxed.  {{TODO: Think hard about return_to }}

Note that there is no requirement that the application store provide a global identifier for the user.  The verification flow requires only that the store provide proof-of-purchase to the application.  Some application stores might choose to provide an identifier which only identifies a user within an application, others might choose to create globally unique IDs for users, and another may provide the user an option to choose.

#### Verification for offline use
An application that has been installed using HTML5 AppCache will be available to the browser even when the user's computer is disconnected from the network.  Applications are encouraged to use cookies or HTML5 local storage techniques to persist an access token, good for some "grace period" of time, which is used before the application repeats the verification flow.  Any access token that is positioned locally can be tampered with by a diligent attacker; if an application is truly concerned about secure offline verification, cryptography will be required.  See wiki:Verification#Offline{need real url here} for more discussion on this point. 

### Mobile User Interactions

### Security and Privacy Considerations

Here we present some of our analysis of the possible security and privacy attacks on this system, and the countermeasures we can take against them.

* Attacks on applications following installation
Once the application manifest has been installed on a user's computer, an attacker may try to tamper with the manifest in order to manipulate the user.  These attacks include:

** Tampering with the application manifest in local storage
If the attacker is able to tamper with the application manifest, either by compromising the dashboard code or by gaining file system access through a different attack vector, they may be able to tamper with the application manifest.  (Note that if the attacker has access to the file system, they can probably replace the web browser, so this consideration may be theoretical).  This kind of tampering can be detected by using tamper-evident signatures, e.g. through digital signatures.  For more on this approach, see wiki:Manifests#Signatures.  Any manifest that extends higher API privileges to an application should be subject to some sort of verification.

** Interception of the user during application launch
If the attacker is able to intercept the user during the launch of an application (e.g. through man-in-the-middle), they could construct a phishing site that appears to be an application store and attempt to steal the user's credentials.  This is identical to the problem faced by many federated login providers in systems like OpenID.  Existing systems to detect and block malware sites can help with this problem, which is not unique to the web application use case.

* Attacks on the HTML5 repository and dashboard
The prototype dashboard deployed at myapps.mozillalabs.com could be an attack vector if an attacker could succesfully impersonate the server providing the dashboard code, e.g. with a man-in-the-middle attack.  The attacker could read the set of installed applications, install deviously constructed application manifests, or vandalize the current set of applications.  The attacker could not steal the user's credentials with the store or the application, since those are not present in the manifest or the installation record.

Countermeasures for this threat include requiring HTTPS for all interaction with the dashboard server, to make sure the origin of the dashboard and repository code is trusted.

* Attacks on the verification flow
An attacker may attempt to capture the verification token from a store to a web app to re-use it or attempt to recover the private key of the store.  Stores are encouraged to use a non-replayable verification token, and to ensure that the token does not allow an attacker to escalate their access by claiming to be another user, or to verify a different application.  The use of digital signatures in the verification token is encouraged.

TODO:
Discussion of account sharing at store and countermeasures


### Integration With the Dashboard and Between Applications ===

