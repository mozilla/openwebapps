## Open Web Apps Technical Overview

This document describes an architecture for *Open Web Applications.*  These are applications constructed using standard web technologies including HTML5, CSS3, and JavaScript, which can run in any modern web browser  Like today's web applications, they are made with a combination of server-side logic and client-side logic.

The system presented here provides for both free and paid applications.  It presumes that there will be multiple stores from which users may install applications.  Developers are free to list their applications on multiple stores and to enter independent relationships with each.  Developers should be free to self-publish their application, or create their own curated application directory.  Applications deployed using this system should work on desktop and mobile platforms, and should degrade gracefully when advanced browser capabilities are not present.

This document is intended as a proposal to the web user and developer community, and direct constructive feedback ([via the mailing list](http://groups.google.com/group/mozilla-labs)) is very welcome.  Throughout the document, links to the Mozilla wiki are placed inline where a topic of discussion is raised.  Readers are encouraged to visit the wiki to contribute to the conversation.

### Overview

This proposal defines an *Open Web Application* in terms of the existing web technology stack.  These applications leverage the HTML5 specification, which describes how a web browser can provide local storage, offline access to applications and data, geolocation services, and rich 2D and 3D graphics capabilities.

Open Web Applications build upon this HTML5 foundation by adding easy launching, an explicit installation flow, and verification of user registration between stores and applications (enabling proof of purchase).  This basic set of interactions requires no new browser features and should work in any modern web browser.<!-- FIXME: link to wiki page defining "modern browser" -->  Richer interactions are also described which would be made possible by native browser support (that may be built-in, or supplied via browser extensions).

Using this system, a user can navigate through a collection of applications in a store or directory, select one to install, provide payment information if needed, and receive the installed application into a "dashboard" that holds all of his or her applications.  When the user subsequently launches the application (by mouse, keyboard, or followed link), the application should be able to verify the user's ownership immediately, so that the user experiences a "one click" launch into a personalized application.

It is not a goal of this proposal to explain how an all-HTML5 application can be downloaded to a desktop computer and subsequently protected from copying.  The focus of the payment proposal is on online verification of user proof-of-install, or proof-of-purchase (in other words, how web apps can work with a <a href="http://en.wikipedia.org/wiki/Key_server_%28software_licensing%29">license server</a>). <!-- FIXME: "It is not a goal" is kind of confusing; it is not a goal of the project, or of this document to explain? -->

The basic set of concepts required to enable Open Web Applications are:

* **Application manifests**, which describes the location, requirements, and capabilities of an application.

* An **application repository**, which holds the manifests for all of the user's installed applications.

* A **method to install** an application into a user's repository, which can be used by stores and directories or by an application developer (for self-published applications).

* A **application dashboard**, which is a user interface through which to manage, browse, and launch installed applications.

* An optional network interaction to allow applications to **confirm the user's ownership** of a paid registration (i.e. from an application store).

This proposal assumes that the application repository resides in the local storage of the user's browser.  It is a relatively simple step to imagine server-based repositories, or to use web browser synchronization techniques to copy application manifests between browser instances.

We have created a prototype repository and an application dashboard which are written entirely in HTML5 and are hosted at [myapps.mozillalabs.com](http://myapps.mozillalabs.com).  The ability to install applications and verify user registration is exposed to applications through a JavaScript library that uses the HTML5 `postMessage` API to securely communicate between the application and the `myapps` domain.

The capabilities of the repository and dashboard could equally be provided by browser-native functions, with some security benefits.  <!-- FIXME: should it be noted that we are committed to this hosted solution, and that browser-native would not *replace* the hosted solution, just augment it? --> Note that although the code for the dashboard is provided by `myapps.mozillalabs.com`, users' installed application manifests are stored entirely on their local browsers.  The `myapps` server has no database of users or apps, and issues no cookies to its users; it serves only to provide a JavaScript program which runs entirely inside the browser.

### Sections

Use the navigation bar, at left, to browse the sections of this document.

Alternatively, you may view the entire document as <a href="oneFile.html">one large file.</a>
