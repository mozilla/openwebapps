# Sync

This is a description of sync in open web apps, ideally thorough enough to double as a specification.  This documentation describes how sync *will* be implemented, not (at this time) any current implementation.

As a quick overview, this specifies several aspects of the protocol:

1. A document that describes the repository state
2. How to generate this document from a repository
3. An algorithm for merging this document, when fetched, into an existing repository
4. The over-the-wire protocol for getting and setting this document
Synchronized Document

## The Document

The document is a JSON document, aka object.  The object keyed off the application Origin (protocol + domain + port-if-not-default).  This is essentially the ID of each application.  The key must be a normalized origin; for example, `http://example.com:80` is not valid (the `:80` should be removed) and `http://example.com/` is not valid (there should be no trailing `/`).

**NOTE:** there is no definition of how to construct an origin for `file:`, `chrome:` or other non-standard protocols; and yet we may use such protocols (we *are* using such origins for F1, to handle internal applications).  On the other hand, such apps should probably never be synchronized as they are not portable between devices.

**NOTE:** should we allow clients to ignore or remove invalid origins?

Each item is itself an object, with these keys:

`deleted`: if present and true, then the application has been deleted. Applications that do not appear in the list of applications are just *unknown*, not *deleted*; only something with a true `deleted` key is really deleted from the repository.

Note that applications may also be "hidden" but recoverable.  A deleted application has had its receipt thrown away and is garbage. It is not necessary that any dashboard present UI for deleting an application, but we assume that there is (and the `navigator.mozApps API provides) some way that an application can actually be eliminated, and so this represents that.  If an app is deleted then only `last_modified` is required.

`last_modified`: a numeric timestamp (seconds from the epoc, UTC). This is required even for the case of a deleted app.

**NOTE:** can we reliably figure out the timezone?  Does it matter? Elsewhere we use `Date().getTime()` - we can also try to resolve differences with the server because we start with a `GET` as noted in the Protocol section.

`manifest`: the installed manifest.  This is not double-encoded, i.e., it is an object.

`manifest_url`: where the manifest was fetched from

`install_data`: the data given with `navigator.apps.install(manifest_url, install_data)`

**NOTE:** the most common use case (maybe the only use case) for `install_data` is for receipts.  Receipts should probably be handled more carefully.

`install_origin`: the origin where app was installed from

**NOTE:** this may be derivative of `manifest_url`?  Maybe that's okay?

`install_time`: timestamp (seconds) of the app installation

**NOTE:** we are ignoring `navigator.apps.mgmt.saveState()` which makes sense for most use cases at this time.  But for the HTML case specifically, without being able to save dashboard state you'll get a list of *every* application, unordered.  So it'll be a mess on a kiosk.  It would be nice to at least have a reasonable starting point.

**NOTE:** it would nice to have some sense of provenance, like who or what device installed the app.  Maybe a basic category, like "mobile" (meaning the application was first installed on a mobile device); CSS defines handheld and screen (and other accessibility-related profiles), but we've discussed tablet as a separate category.  We'd need to make a guess ourselves in the HTML case.

**NOTE:** Services credentials should go here.

**NOTE:** Any way to indicate if the app was used?  It would be nice to be able to figure out when an app is unused across all devices.

**NOTE:** we don’t have any way to add items here if clients lose them during the generation phase.  Maybe we should stuff all these extra bits under one key, and require the client to keep them.  Or, we require the client to keep *everything* they receive in this document, unmolested, unless they explicitly change something?

**NOTE:** How do we handle version changes?  Schema updates?  Clients that feel a manifest is invalid, while another client feels it is valid?

## Generating the Document

To generate this document you should go through all apps, including the deleted tombstones of apps (which your repository should keep). You should generate (and remember) `last_modified` if you do not have it recorded.

Because edits are relatively infrequent and based on a shared canonical representation (the manifest as served up at its URL) there is no collision detection, the latest `last_modified` simply wins (**NOTE**: this is where we could lose receipts).

**NOTE:** should we recommend deleting tombstones after some period of time?  A year?  (It would not be that odd for a seldom-used device to be resync'd months later)

## Merging the Document

Go through each application listed in the document.

For each (non-deleted) application, check if it is installed; if not, install it.  You should *locally* set `app.sync` to true (this is in the [application representation](https://developer.mozilla.org/en/OpenWebApps/The_JavaScript_API#Application_Representation), not the manifest).

If an application is already installed, use `last_modified` to see if the application should be updated.  (**NOTE:** we should specify how to handle conflicts.)

For each deleted application, check if it is installed and has a `last_modified` newer than the sync document.  If so, ignore the deleted sync application.  Otherwise delete the app if necessary, and remember the tombstone (there at least are some possible cases when the tombstone is needed to resolve some race conditions, though we might be able to avoid those with the protocol.)

You must always retain `last_modified` as you received it (unless you ignore the application in favor of a newer local version).

## Protocol

The sync server lives at a well known location, we'll say `https://myapps.mozillalabs.com/sync/verify`

> Or, we could image the well-known location is `https://myapps.mozillalabs.com/storage-verify?service=owa-sync` which is easily generalized to other kinds of storage services?

To start the process the repository must authenticate itself.  The repository should call `navigator.id.getVerifiedEmail()`, and send the assertion from that to this URL.

The request will be a POST and should contain:

    assertion=<URL-encoded-assertion>&audience=<URL-encoded-audience>

Note that the `audience` must be a whitelist.  That whitelist will include `myapps.mozillalabs.com`, which is the location of the canonical HTML repository.  It does *not* contain extension dashboards; access to sync means access to all the basic integrity of your repository, and that is not something we can offer to any dashboard.

Unfortunately this whitelist means that popup blocker make it hard to actually call `navigator.id.getVerifiedEmail()` from a hidden iframe (the HTML repository implementation).  As a result we will have to provide an iframe-based login button (that is actually hosted on `http://myapps.mozillalabs.com`).  I believe this will only be necessary in the HTML implementation, as other implementations will implement the login in chrome, and/or can avoid any popup block issues.

The server will verify the assertion, if it fails it will return:

    {"status": "failure", "reason": "..."}

(this matches what browserid.org returns) (**NOTE:** should this be a 400 error too?)

If it succeeds it will return:

    {"status": "okay", "resource": URL, "auth": http_authorization_header, "email": email}

All the subsequent requests will go through the given URL (except when an authorization failure happens), and the header `Authorization: http_authorization_header` will be added.  `http_authorization_header` is opaque to the client, it will just return what it is given.

**NOTE:** we should specify what happens when the server requires re-logging in, or wants to update the `http_authorization_header` value (e.g., to refresh the timeout).

The updates are all time-based, using numeric timestamps (but with sub-second precision).  The repository should keep track of the last time it has sync'd, and start the sync process with:

    GET URL
    Authorization: ...
    X-If-Modified-Since: timestamp

(If never sync'd, then do not use the `X-If-Modified-Since header`)

If nothing has happened since the last sync, the return value will be:

    204 No Content
    Content-Length: 0
    X-Timestamp: "now", on the server
    X-Last-Modified: timestamp of most recent update

We use 204 instead of 304 Not Modified so that browser caching does not come into play (as that caching is transparent to XMLHttpRequest, but we want it to be explicit).  The status (204 instead of 200) and empty response body indicates that there are no updates. `X-Timestamp` can be used to adjust for timezones.  (NOTE: can intermediaries be useful here, in which case do we want to use normal response codes?)

If something has happened, the response is the same but with the response document in the body.

The client should merge the document if necessary, then it may do a PUT or POST request (they are considered equivalent; POST has better compatibility in some situations, especially the HTML repository implementation):

    POST URL
    Authorization: ...

The body should contain the new document.  (Content-Type is ignored in all these cases.)  **NOTE:** should we at least invent a Content-Type?

If the authorization fails, then the response will be:

    401 Authorization Required

There will be no `WWW-Authenticate` header, instead you should start over with `navigator.id.getVerifiedEmail()`.

If the server cannot respond it will add `X-Backoff: <seconds>`, and the client should not access the server again for that long.  The response code should be 503 in this case.  (Note: should this just use Retry-After, or will XHR swallow that?)

**NOTE:** should we hint from the server how often the sync client should attempt to access the server?  Or we can try to make the client smart, e.g., count how often we get updates, to keep track of whether anyone else ever updates the server (and if not, update only on login/startup, thus accomplishing a backup).  Also we could ask the clients to assign themselves a UUID, and when accessing the verify URL we could take that UUID and count the number of active clients, specifically when there is only one active client.

## User Interface Concerns

While all sync'd applications are in some sense "installed" on all applications, clients (and specifically dashboards) should not treat all applications equivalently.  Applications that were installed from elsewhere should be kept separately from applications installed on the device, unless the user has indicated they specifically want the application on the respective device.

Dashboards should thus filter out applications with true `.sync` attributes, *unless* the user does something (like drag the application into the main application area).  Then the dashboard should remember (in its own local storage) that the application is desired locally despite the value of `.sync`.

It is recommended that you sort remotely-installed applications by `install_time`, showing the most recent applications so they can be promoted to local apps.

**NOTE:** we have to consider what the application picker for Activities looks like too; there is no "dashboard" for Activity picking, so nothing to helpfully distinguish between local and remote apps, or handle app ordering.
