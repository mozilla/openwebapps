# Sync

This is a description of sync in open web apps, ideally thorough enough to double as a specification.  This documentation describes how sync *will* be implemented, not (at this time) any current implementation.

As a quick overview, this specifies several aspects of the protocol:

1. The documents that describe individual applications, along with a "key" by which they can be accessed
2. The basic sync API, and authentication to the sync service
3. How to get updates from the sync server, and how to apply these
4. How to send new updates to the sync server
5. Dealing with unknown application attributes

## The Application Document

The document is a JSON document, aka object.

The **key** or ID of the application is its origin (protocol, domain, and port-if-not-default), and must be a normalized origin.  The ID must then be encoded with base64 with the URL modifications (`-` and `_` instead of `+` and `/`, and no `=` padding).

**NOTE:** we should take `urlmatch.js` and polish it up and include the base64 stuff.

**NOTE:** there is no definition of how to construct an origin for `file:`, `chrome:` or other non-standard protocols; and yet we may use such protocols (we *are* using such origins for F1, to handle internal applications).  On the other hand, such apps should probably never be synchronized as they are not portable between devices.

**Note:** should we filter origins on the server?  Might be a useful safety addition.

The application document has these key:

`deleted`: if present and true, then the application has been deleted. The presence of a document *asserts* that the application has been deleted.  If an application is simply not present then the sync server simply doesn't know about the application; deleting a local application because the sync server doesn't know about a service would be dangerous.

Note that applications may also be "hidden" but recoverable.  A deleted application has had its receipt(s) thrown away and is garbage. It is not necessary that any dashboard present UI for deleting an application, but we assume that there is some way an application can actually be eliminated (and the `navigator.mozApps.mgmt` API provides one).  If an app is deleted then only `last_modified` is required.

`last_modified`: a numeric timestamp (seconds from the epoc, UTC). This is required even for the case of a deleted app.

**NOTE:** can we reliably figure out the timezone?  Does it matter? Elsewhere we use `Date().getTime()` - we can also try to resolve differences with the server because we start with a `GET` as noted in the Protocol section.

`manifest`: the installed manifest.  This is not double-encoded, i.e., it is an object.

`manifest_url`: where the manifest was fetched from

`install_data`: the data given with `navigator.apps.install(manifest_url, install_data)`

**NOTE:** the most common use case (maybe the only use case) for `install_data` is for receipts.  Receipts should probably be handled more carefully.

`install_origin`: the origin where app was installed from; it is an error if this differs from the key.

**NOTE:** this may be derivative of `manifest_url`?  Maybe that's okay?  We could use `manifest_path`?

`install_time`: timestamp (seconds) of the app installation

**NOTE:** we are ignoring `navigator.apps.mgmt.saveState()` (an API which we aren't really supporting anyway) which makes sense for most use cases at this time.  But for the HTML case specifically, without being able to save dashboard state you'll get a list of *every* application, unordered.  So it'll be a mess on a kiosk.  It would be nice to at least have a reasonable starting point.

**NOTE:** it would nice to have some sense of provenance, like who or what device installed the app.  Maybe a basic category, like "mobile" (meaning the application was first installed on a mobile device); CSS defines handheld and screen (and other accessibility-related profiles), but we've discussed tablet as a separate category.  We'd need to make a guess ourselves in the HTML case, using User-Agent and the screen size.

**NOTE:** Services credentials should go here.

**NOTE:** Any way to indicate if the app was used?  It would be nice to be able to figure out when an app is unused across all devices.

**NOTE:** we don’t have any way to add items here if clients lose them during the generation phase.  Maybe we should stuff all these extra bits under one key, and require the client to keep them.  Or, we require the client to keep *everything* they receive in this document, unmolested, unless they explicitly change something?  Or, keep unknown top-level keys aside, and expect that unknown keys may come about?

**NOTE:** How do we handle version changes?  Schema updates?  Clients that feel a manifest is invalid, while another client feels it is valid?

## Generating the Document

To generate this document you should go through all apps, including the deleted tombstones of apps (which your repository should keep). You should generate (and remember) `last_modified` if you do not have it recorded.

Because edits are relatively infrequent and based on a shared canonical representation (the manifest as served up at its URL) there is no collision detection, the latest `last_modified` simply wins (**NOTE**: this is where we could lose receipts).

**NOTE:** should we recommend deleting tombstones after some period of time?  A year?  (It would not be that odd for a seldom-used device to be resync'd months later)

## Authenticating with the Sync Server

The sync service will live at a well known location, perhaps `https://myapps.mozillalabs.com/apps-sync`

To start the sync process you must have a BrowserID assertion.  It should be an assertion from `myapps.mozillalabs.com` or another in a whitelist of domains.  Send a request to:

    POST https://myapps.mozillalabs.com/apps-sync/verify

    assertion={assertion}&audience={audience}

The response will be a JSON document, containing the same information as a request to `https://browserid.org/verify` but also with the keys (in case of a successful login) `collection_url`  and `authentication_header`.

`collection_url` will be the URL where you will access the applications.  `authentication_header` is a value you will include in `Authentication: {authentication_header}` with each request.

A request may return a 401 status code.  The `WWW-Authenticate` header will not be significant in this case.  Instead you should start the login process over with a request to `https://myapps.mozillalabs.com/apps-sync/verify`

## How to get updates

After authenticating with the server and getting back the URL of the collection, request:

    GET {collection}?since={timestamp}

`since` is optional; on first sync is should be empty or left off. The server will return an object:

    {
      until: timestamp,
      incomplete: bool,
      applications: {origin: {...}, ...}
    }

The response may not be complete if there are too many applications. If this is the case then `incomplete` will be true (it may be left out if the response is complete).  Another request using `since={until}` will get further applications (this may need to be repeated many times).

The client should save the value of `until` and use it for subsequent requests.

In the case of no new items the response will be only `{until: timestamp}`.

The client should always start with this GET request and only then send its own updates.  It should ensure that its local timestamp is sensible in comparison to the value of `until`.

Applications returned may be older than the local applications, in that case then the client should ignore the server's application and use its local copy, causing an overwrite.  The same is true for deleted applications; if the local installed copy has a `last_modified` date newer than the deleted server instance then the server instance should be ignored (the user reinstalled an application).

**NOTE:** there are some conflicts that may occur, specifically receipts should be merged.

When an application is added from the server the client should *locally* set `app.sync` to true (this is in the [application representation](https://developer.mozilla.org/en/OpenWebApps/The_JavaScript_API#Application_Representation), not the manifest).

You must always retain `last_modified` as you received it from the server (unless you ignore the application in favor of a newer local version).

## Sending new updates

The client should keep track of the last time it sent updates to the server, and send updates when there are newer applications.

**NOTE:** there is a case when an update might be lost because of an update from another device; this would be okay except that the client doesn't know it needs to re-send that update.  How do we confirm that?

The updates are sent with:

    POST {collection}

    {origin: {...}, ...}

Each object must have a `last_modified` key.  The response is only:

    {received: timestamp}

**NOTE:** the server could potentially check `last_modified` itself and throw away updates?  It could indicate in the response what the updates were.

## User Interface Concerns

While all sync'd applications are in some sense "installed" on all applications, clients (and specifically dashboards) should not treat all applications equivalently.  Applications that were installed from elsewhere should be kept separately from applications installed on the device, unless the user has indicated they specifically want the application on the respective device.

Dashboards should thus filter out applications with true `.sync` attributes, *unless* the user does something (like drag the application into the main application area).  Then the dashboard should remember (in its own local storage) that the application is desired locally despite the value of `.sync`.

It is recommended that you sort remotely-installed applications by `install_time`, showing the most recent applications so they can be promoted to local apps.

**NOTE:** we have to consider what the application picker for Activities looks like too; there is no "dashboard" for Activity picking, so nothing to helpfully distinguish between local and remote apps, or handle app ordering.
