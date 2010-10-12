## Installable Web Apps Technical Overview

This document describes an architecture for "Installable Web Applications."  These are applications constructed using standard web technologies including HTML5, CSS3, and JavaScript, which can run in any modern web browser.

The system presented here provides for both free and paid applications.  It presumes that there will be multiple stores from which users may install applications.  Developers are free to list their applications on multiple stores, and to enter independent relationships with each.  Developers should be free to self-publish their application, or to themselves create a curated application directory.  Applications deployed using this system should work on desktop and mobile platforms, and should degrade gracefully when advanced browser capabilities are not present.

This document is intended as a proposal to the web user and developer community, and direct constructive feedback is very welcome.  Throughout the document, links to the Mozilla wiki are placed inline where a topic of discussion is raised.  Readers are encouraged to visit the wiki to contribute to the conversation.

### Overview

This proposal defines an *Installable Web Application* in terms of the existing web technology stack.  These applications leverage the HTML5 specification, which describes how a web browser can provide local storage, offline access to applications and data, geolocation services, and rich 2D and 3D graphics capabilities.

Installable Web Applications build upon this HTML5 foundation by adding easy launching, an explicit installation flow, and verification of user registration between stores and applications (enabling proof of purchase).  This basic set of interactions requires no new browser features and should work in any modern web browser.  Richer interactions are also described which would be made possible by native browser support (that may be built-in, or supplied via browser extensions).

It is a primary goal of this proposal to allow a user to navigate through a collection of applications in a store or directory, select one to install, provide payment information if needed, and receive the installed application into a "dashboard" that holds all of his or her applications.  When the user subsequently launches the application (by mouse, keyboard, or followed link), the application should be able to verify the user's ownership immediately, so that the user experiences a "one click" launch into a personalized application.

It is not a goal of this proposal to explain how an all-HTML5 application can be downloaded to a desktop computer and subsequently protected from copying.  The focus of this proposal is on online verification of user proof-of-install, or proof-of-purchase (in other words, how web apps can work with a <a href="http://en.wikipedia.org/wiki/Key_server_%28software_licensing%29">license server</a>).

The basic set of concepts required to enable Installable Web Applications are:

* Application manifests, which describes the location, requirements, and capabilities of an application.
* A method to install an application into a user's browser, which can be used by stores and directories or by an application author itself (for self-published applications)
* A view to manage, browse, and launch installed applications.
* A network interaction to allow applications to confirm a user's ownership (that she has purchased or installed the application from a store).

The approach taken in this proposal is to create an installed application repository which resides entirely in the local storage of the browser.  We have created a prototype repository and an application dashboard which are written entirely in HTML5 and are hosted at `myapps.mozillalabs.com`.  The ability to install applications and verify user registration is exposed to applications through a JavaScript library that uses the HTML5 postMessage API to securely communicate between the application and the `myapps` domain.  The capabilities of the repository and dashboard could equally be provided by browser-native functions, with some security benefits (see discussion below).  Note that although the code for the dashboard is provided by `myapps.mozillalabs.com`, users' installed application manifests are stored entirely on their local browsers.  The `myapps` server has no database of users or apps, and issues no cookies to its users; it serves only to provide a JavaScript program which runs entirely inside the browser.

### The Application Manifest

The Manifest is a complete description of what the web browser needs to interact with the application.  It provides both human-readable elements (a name, a set of icons, and a description; possibly in multiple languages) and machine-readable elements (URLs, lists of capabilities), which allow the application repository and dashboard to display and launch applications.

The Manifest is encoded as a JSON data structure, and is provided to the browser when the application is installed.  A self-published application manifest is provided by the application developer.  A curated or purchased application manifest is provided by the directory or store.  The manifest is persisted in local storage and is used by the dashboard and repository for subsequent interactions with the user.

For detailed description of the manifest, and discussion of its design, visit wiki:Manifest. {need real url here}  (Note that the design of the manifest is intended to build on and comment on existing work by Google on [hosted web application manifests](http://code.google.com/chrome/apps/docs/developers_guide.html#live); please see the wiki for more in-depth discussion)

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

### Self-Published, Free, Registered, and Paid Apps

This system supports a wide range of potential application deployment models.

A *self-published* application can be created by a developer.  The developer creates a manifest and places a call to the `install` method on their webiste, driven by a button or link.  When the user clicks, the repository prompts the user for confirmation, and adds the application to the user's dashboard.  If the application requests additional permissions, the user is prompted to confirm them.  This process is essentially identical to the existing process of using a web site and bookmarking it, but adds a simplifying metaphore to the experience.

An application directory is simply a web site, which may provide additional tools to help a user find the applications they want -- perhaps including search, rankings, social features, discussion boards, reviews, etc.  An application directory can provide *free* and *registered* applications.  When the user clicks to add a *free* application, the site calls the `install` method, the user is prompted for confirmation, and the application is added to the dashboard.  A *registered* application is one that provides a user identity to the application, providing a single-sign on experience to the user.  In the *registered* case, an authorizationURL is also saved with the manifest.  The application can subsequently request user verification, which will cause the browser to send the user to the application directory for identity verification (mostly likely using cookie and form-based authentication), returning immediately, and in most cases imperceptibly, to the application with an identity token.

By adding payment-processing features, an application directory becomes a store, and supports *paid* applications.  A paid application adds proof-of-purchase to a registered application.  When the application requests user verification, the browser sends the user to the store for identity verification, and the store sends the user back to the application bearing both an identity token and a cryptographically-secure proof-of-purchase.  For more details, see the Verification Flow section, below.


### HTML5 implementation vs. browser-native implementation

The prototype `myapps.mozillalabs.com` repository can be included in any website through a simple JavaScript include.  It provides the install, getInstalled, and verifyIdentity methods through a secure cross-domain messaging API.    The `myapps.mozillalabs.com` dashboard can be loaded by simply navigating to the site in a browser.  It displays the currently installed applications, and launches them when they are clicked.

Note that we do not propose making `myapps.mozillalabs.com` a permanent delivery point for an application dashboard; see the Security and Privacy Considerations section for a discussion of a longer-term strategy.

Browser-native implementations can take deeper security measures, and integrate more with desktop and mobile operating systems, than a pure web-content dashboard.  We propose that experimental integration with browser-native functions be organized under a "window.navigator.apps" object.  New methods can be attached at this point and made available, in a limited way, to browser-native or web-based application dashboards.  Specific directions for browser integration include:

* Implementation of an installed application repository that resides in secure, tamper-evident desktop storage (e.g. with a digital signature)
* Ability to launch applications into an "app tab" or "pinned tab" that has a fixed location in the tab bar, or in a separate process with its own icon, menu-bar, etc.
* Access to OS-level <a href="http://www.w3.org/2010/web-notifications/">notification systems</a>
* Integration with browser-based permission APIs, including camera, microphone, geolocation, storage, file access, and cross-domain network access.
* Ability to launch applications into a "chromeless" mode (with no toolbars, location bar, or forward or backward buttons)
* Ability to launch <a href="http://www.whatwg.org/specs/web-workers/current-work/">web workers</a> to perform background processing or notification polling.
* Integration with push-based notification or message delivery systems

Any access to browser or OS-level functionality should require a more stringent installation step, and may require verification of the manifest - see Security and Privacy Considerations.


### The User's Application Repository and Dashboard

The application repository is a trusted collection of the manifests that the user has consented to install.  It provides a limited, privacy-respecting API to web content, which allows it to interact with other websites to give users a smooth experience of using web applications.  It also provides the dashboard, a rich HTML5 interface to manage and launch applications from the browser.

If the application repository is implemented by browser makers (or in extensions), a similar API will need to be provided.

In the `myapps.mozillalabs.com` case, we expose three APIs:

*   `install( <manifest> , [ <authorizationURL> ], [ <signature> ], <callback>):`

    prompts the user for confirmation of the manifest, possibly checking the installation and application domains against a registry of known malware sites.  If the user consents, the manifest is installed into the repository, along with the hostname of the installing site and a timestamp.  If the installing site does not use SSL, the user will be strongly discouraged from installing the application.   When the installation flow is completed with success or failure, the installing website is notified through the callback.
    
     the optional authorizationURL and signature fields are persisted into local storage along with the manifest, as part of the installation.
    
*   `getInstalled( <callback> ):`
    
    returns, through the callback, the installed applications whose URLs are contained by the calling site.  This allows an application to find out whether its manifest has been installed on a browser when the user visits the site.
    
*   `verifyIdentity ( [<return-to>], <callback> ):`
    
    selects the application whose URL matches the calling site, and initiates the verification flow for that application by loading the authorizationURL of the application.  {what happens when more than one matches?} See The Verification Flow.

### The Verification Flow

The goal of this flow is to allow a user to load a purchased or registered application and, without presenting any additional credentials, receive an authenticated and personalized experience.  This proposal does not require any one federated authentication solution, but provides a simple system to initiate federated login for a particular user-store-application combination.

The verification flow is very similar to a directed OpenID authentication flow, and store implementors may choose to adopt that flow for verification.  In that case, an OpenID attribute containing the application ID that was successfully verified would be sent in the response, along with the user identity.  One notable difference from the OpenID 2.0 use case is that the application store can be confident of the realm, so the need for a return_to or realm argument is relaxed.  {{TODO: Think hard about return_to }}

Note that there is no requirement that the application store provide a global identifier for the user.  The verification flow requires only that the store provide proof-of-purchase to the application.  Some application stores might choose to provide an identifier which only identifies a user within an application, others might choose to create globally unique IDs for users, and another may provide the user an option to choose.

#### Verification for offline use
An application that has been installed using HTML5 AppCache will be available to the browser even when the user's computer is disconnected from the network.  Applications are encouraged to use cookies or HTML5 local storage techniques to persist an access token, good for some "grace period" of time, which is used before the application repeats the verification flow.  Any access token that is positioned locally can be tampered with by a diligent attacker; if an application is truly concerned about secure offline verification, cryptography will be required.  See wiki:Verification#Offline{need real url here} for more discussion on this point. 

### Mobile User Interactions

Most smartphone and tablet computing platforms are already application-centric.  The Installed Web Applications proposal aims to standardize the requirements for deployment of web applications across all mobile platforms and to clarify how developers can optionally charge for those applications.

The installation flow on a mobile device must validate the manifest, present a request for permissions to the user, and create a data structure that causes the application to appear in the normal location for the device.  For unregistered applications, launching the application should simply open a navigation-free web browser instance, preloaded with the application's launchURL.  For registered and paid applications, the browser should be directed to the authorizationURL of the application, which can validate the user and direct the browser to the application's launchURL with a validated identity and purchase token.

To support offline use, developers should make use of HTML5 AppCache and localStorage to enable the local components of their application to run without network access.  Application stores are encouraged to provide an option for local caching of registration and payment assertions, to allow a developer to indicate that they do not require online verification for every run; in many cases, a single check, or a weekly/monthly check is sufficient.

Developers are encouraged to use cross-platform JavaScript toolkits to target multiple mobile platforms.  For further reading, see <a href="http://www.sencha.com/products/touch/">Sencha</a> and <a href="http://jquerymobile.com/">jQuery Mobile</a>.

### Security and Privacy Considerations

Here we present some of our analysis of the possible security and privacy attacks on this system, and the countermeasures we can take against them.

#### **Attacks on applications following installation:** 

Once the application manifest has been installed on a user's computer, an attacker may try to tamper with the manifest in order to manipulate the user.  These attacks include:
  
  * **Tampering with the application manifest in local storage:** If the attacker is able compromise a web-based dashboard, or gain file system access through a different attack vector, they may be able to tamper with the application manifest.  (Note that if the attacker has access to the file system, they can probably replace the web browser, so this consideration may be theoretical).  This kind of tampering can be detected by using tamper-evident signatures, e.g. through digital signatures.  For more on this approach, see wiki:Manifests#Signatures.  Any manifest that extends higher API privileges to an application should be subject to some sort of verification.
  
  * **Interception of the user during application launch:** If the attacker is able to intercept the user during the launch of an application (e.g. through man-in-the-middle), they could construct a phishing site that appears to be an application store and attempt to steal the user's credentials.  This is identical to the problem faced by many federated login providers in systems like OpenID.  Existing systems to detect and block malware sites can help with this problem, which is not unique to the web application use case.
  
#### **Attacks on the HTML5 repository and dashboard:** 

The prototype dashboard deployed at `myapps.mozillalabs.com` could be an attack vector if an attacker could succesfully impersonate the server providing the dashboard code, e.g. with a man-in-the-middle attack.  The attacker could read the set of installed applications, install deviously constructed application manifests, or vandalize the current set of applications.  The attacker could not steal the user's credentials with the store or the application, since those are not present in the manifest or the installation record.
  
Countermeasures for this threat include requiring HTTPS for all interaction with the dashboard server, to make sure the origin of the dashboard and repository code is trusted.

If a serious effort is made to support a cross-browser HTML5 dashboard, issues of governance, version control, and operational security will need to be jointly addressed by stakeholders.  An existing technical coordination group could take on the job, or a new independent organization could be created and jointly funded by the browser makers.

If, on the other hand, application repositories are going to live entirely in browser-private storage, the HTML5 dashboard becomes less important and is an uninteresting attack target.


#### **Attacks on the verification flow:** 

An attacker may attempt to capture the verification token from a store to a web app to re-use it or attempt to recover the private key of the store.  Stores are encouraged to use a non-replayable verification token, and to ensure that the token does not allow an attacker to escalate their access by claiming to be another user, or to verify a different application.  The use of digital signatures in the verification token is encouraged.

#### **Reuse or compromise of application store accounts:**

Users may accidentally, unknowingly, or maliciously share logins to an application store.  Application stores are free to implement whatever sort of login counters they wish to detect this behavior, and are free to interrupt the verification flow to indicate to users that there appear to be multiple uses of an account.  Note that if a store implements offline verification tokens, they will need their verification page to check back with the store periodically to determine whether an account compromise has been detected.

#### **Convincing the user to install bad applications:**

A malicious site, directory, or store could attempt to convince a user to install an application that abused the user's confidence in some way.  The most serious attacks would involve accessing the privileged APIs of the browser, and, as noted above, should require some sort of verification and a trusted source.  Less serious, but still potentially troubling, attacks could involve manipulating the identity token provided by a store to enable cross-domain tracking of the user.  The countermeasures for this class of attack are essentially identical to those required for browser add-ons and downloads: tracking of malware sites, strongly-worded user warnings, and the ability to return the system to a previously-saved state.

When installing from a malicious site, an HTML repository that depends on iframes for the installation flow could be vulnerable to an iframe defacement attack.  This attack could partially obscure the confirmation dialog to hide the true nature of the application being installed.  A native application repository would not have this problem; also, work on secure user interfaces for HTML content, which could mitigate iframe defacement attacks, is ongoing.  A repository that did not use iframes for the confirmation flow would not be vulnerable to this attack.

### Integration With the Dashboard and Between Applications

While the initial focus of this proposal remains on the minimal set of components required to enable Installable Web Applications, there are opportunities in the future to deepen the level of integration between applications and the dashboard (or browser if native support for applications is present).  The types of user experiences that could be enabled include:

* An aggregated view of outstanding notifications across all of the user's installed applications.
* The ability for the user execute a search across all of the information stored inside their applications.
* Applications to expose "bookmarklet" like functionality, which would cause the browser to include application actions in contextual menus.

In addition to applications exposing capabilities to the browser, it would also be possible for applications to expose capabilities to each other.  This feature could allow applications to publish and consume content from each other in secure interactions which are moderated by the dashboard, and controlled by the user.

The technical support for these types of interactions is already present in modern web browsers in the form of cross document messaging.  The preliminary work that must occur before such features can be considered for inclusion in the specification of Installable Web Applications is the development of a framework by which robust versioned APIs can be built on top of HTML5's cross document messaging facilities.  We've begun to explore these first challenges in a parallel experiement, [JSChannel](http://github.com/mozilla/jschannel).

