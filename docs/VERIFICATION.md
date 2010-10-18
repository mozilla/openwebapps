### Self-Published, Free, Registered, and Paid Apps

This system supports a wide range of potential application deployment models.

A *self-published* application can be created by a developer.  The developer creates a manifest and places a call to the `install` method on their website, driven by a button or link.  When the user clicks, the repository prompts the user for confirmation, and adds the application to the user's dashboard.  If the application requests additional permissions, the user is prompted to confirm them.  This process is essentially identical to the existing process of using a web site and bookmarking it, but adds a simplifying metaphor to the experience.

An application directory is simply a web site, and may provide additional tools to help a user find the applications they want &mdash; perhaps including search, rankings, social features, discussion boards, reviews, etc.

An application directory can provide *free* and *registered* applications.  When the user clicks to add a *free* application, the site calls the `install` method, the user is prompted for confirmation, and the application is added to the dashboard.

A *registered* application is one that provides a user identity to the application, providing a single-sign on experience to the user.  In the *registered* case, an authorizationURL is also saved with the manifest.  The application can subsequently request user verification, which will cause the browser to send the user to the application directory for identity verification (mostly likely using cookie and form-based authentication), returning immediately, and in most cases imperceptibly, to the application with an identity token.

By adding payment-processing features, an application directory becomes a store, and supports *paid* applications.  A paid application adds proof-of-purchase to a registered application.  When the application requests user verification, the browser sends the user to the store for identity verification, and the store sends the user back to the application bearing both an identity token and a cryptographically-secure proof-of-purchase.


### The Verification Flow

The goal of this flow is to allow a user to load a purchased or registered application and, without presenting any additional credentials, receive an authenticated and personalized experience.  This proposal does not require any one federated authentication solution, but provides a simple system to initiate federated login for a particular user-store-application combination.

The verification flow is very similar to a directed OpenID authentication flow, and store implementors may choose to adopt that flow for verification.  In that case, an OpenID attribute containing the application ID that was successfully verified would be sent in the response, along with the user identity.  One notable difference from the OpenID 2.0 use case is that the application store can be confident of the realm, so the need for a `return_to` or `realm` argument is relaxed.  {{TODO: Think hard about return_to }}

Note that there is no requirement that the application store provide a *global identifier* for the user.  The verification flow requires only that the store provide proof-of-purchase to the application.  Some application stores might choose to provide an identifier which only identifies a user within an application, others might choose to create globally unique IDs for users, and another may provide the user an option to choose.

#### Verification for offline use
An application that has been installed using HTML5 AppCache will be available to the browser even when the user's computer is disconnected from the network.  Applications are encouraged to use cookies or HTML5 local storage techniques to persist an access token, good for some "grace period" of time, which is used before the application repeats the verification flow.  Any access token that is positioned locally can be tampered with by a diligent attacker; if an application is truly concerned about secure offline verification, cryptography will be required.  See wiki:Verification#Offline{need real url here} for more discussion on this point.
