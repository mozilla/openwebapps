### Sync

This is a technical description of how the repository synchronizes installed applications between different devices or repositories. There are two parts described in this document:

* How the protocol looks over the wire, common to all devices and repositories

* How the HTML5 sync work

#### Wire protocol

The application uses [Firefox Sync](https://wiki.mozilla.org/Labs/Weave/Sync/1.0/API) API, as well as the [User API](https://wiki.mozilla.org/Labs/Weave/User/1.0/API) for logging in and registration.

The sync server we are using for development is located at https://sync.myapps.mozillalabs.com -- in this document is is referred to as `SERVER`.

The basic flow of connecting to the sync server is:

1. Get the username and password of the user

2. If the username is not simple letters and numbers (e.g., it contains a `@` character) then the username made safe by lower-casing it, hashing it with SHA1, then encoded to "base32", and lower-casing again.  You may look in `/site/js/login.js` at the `emailToUsername` function to see how this is done.

3. All requests then use HTTP Basic authentication.

4. You make a request to the main Sync server to get the user's node. This request doesn't actually have to be authenticated.  This is a request to `SERVER/user/1.0/{username}/node/weave` which returns a text body of the node name (`NODE`).  During development we have one server, and so the node will always be the main `SERVER`.  In the production Sync deployment this is not the case.

5. The one and only URL you have to interact with is then `NODE/1.0/{username}/storage/openwebapps/apps`

6. Unless you want to clear the sync server, then do `DELETE NODE/1.0/{username}/storage/openwebapps/`

7. Now there's only two operations: `PUT` and `GET` -- you `GET` to get the current applications and see if there's anything new, and you `PUT` your version of applications to share.  You *may* use X-If-Modified-Since on the `GET` request to conditionally fetch changes, and X-If-Not-Modified-Since on `PUT` to conditionally send changes, but you are not required to avoid clobbering other changes.

8. It is most reasonable to do a GET before a PUT.

#### Sync document

The wire protocol describes where you find the document, but now we'll discuss what you actually GET and PUT:

The object is encoded as a Weave(Sync) Basic Object.  This is simply a JSON object like:

    {"id": "apps", "payload": "some string"}

You can include other optional attributes, but we don't use any. Typically for Sync the payload is encrypted, but for our uses we don't do that.  The payload is itself a JSON document (note it's effectively stringified twice).

The JSON document looks like:

    {
      "installed": {
        "{base_url}": {
          "base_url": "{base_url}",
          "lastModified": {numeric_timestamp},
          ... other attributes ...
        },
        ... other installed apps ...
      },
      "deleted": {
        "{base_url}": {
          "lastModified": {numeric_timestamp}
        },
        ... other deleted apps ...
      }
    }

Note that applications *are not* deleted by simply removing them from `"installed"`, they must be moved into `"deleted"`.

There are then two processes: (1) create a document from your repository, and (2) having received a document, merge it with your repository.

Creating a document is fairly obvious.  You should ensure each application or deleted placeholder has a `lastModified` attribute, using the current timestamp if necessary.

To merge a document with your repository you should:

1. Take each installed application.  If it is not in your list of installed or deleted applications, then insert it as a new application.

2. If the application is already installed, compare lastModified timestamps, choosing the application withe the newer timestamp.  (This conflict should be relatively uncommon, and also installed application manifests aren't intended to be particularly volatile).

3. If the application is locally deleted, compare lastModified timestamps.  Throw away the deleted placeholder if the installed app is newer, ignore the installed app if the deleted placeholder is newer.

4. Take each deleted application, and repeat the same process.

#### HTML 5 Implementation

The HTML 5 Implementation is in `/js/sync.js` and runs directly on a TypedStorage instance (as implemented, for example, in `/js/typed-storage.js`).  It looks for applications under the type `"app"` and deleted placeholders under `"deletedapp"`.  Your repository then interacts directly with the TypedStorage, as does the Sync object.

The Sync object is instantiated like:

    sync = Sync({
      url: NODE,
      username: ENCODED_USERNAME,
      password: PASSWORD,
      storage: TYPED_STORAGE
    });

You can call things like `sync.pull()` and `sync.push()` to trigger the GET and PUT requests respectively.  Also `sync.getTimestamp()` will return a timestamp, and attempt to handle offsets between the sync server's timestamp and the local timestamp (though cross-domain header restrictions are currently making this unreliable).

If you simply call `sync.pollSyncServer([pollTimeMilliseconds])` it will periodically check the server (the default poll time is 5000 milliseconds).  After an initial PUT request, later PUT requests will happen when a change is detected (TypedStorage emits events which can be used to detect changes).

Some errors may cause the polling to stop, most specifically if a failed request is received with a 0 status, which typically means the server is not available.  (The sync server can also respond with a server timeout with a retry-time, but this is currently not checked for.)

#### Additions to sync.myapps

The only addition necessary was the addition of Access-Control-\* headers to the server to allow the repo domain (e.g., myapps.mozillalabs.com) to access the sync server.  This was applied in front of the Python sync server.  The code has been uploaded to [wsgi-access-control](https://github.com/ianb/wsgi-access-control) and the documentation includes the example of how it is configured in front of the sync service.  Currently it runs with an allowed origin of `*` but this should probably be changed to a whitelist that only allows production access.  Also it currently always sends the header, but to save on bandwidth it doesn't need to send the header except when it can be determined that the header is needed (which is a simple test for the `Origin` request header).
