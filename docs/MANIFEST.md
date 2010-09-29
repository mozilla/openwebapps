# Installable Web Applications - The Manifest

At the center of an IWA is a manifest.  Here's is an example of a complete manifest:

    {
      "name": "TweetSup?",
      "description": "Search twitter and receive notifications from them inside your application dashboard",
      "app": {
        "urls": [
          "https://tweetsup.mozillalabs.com"
        ],
        "base_url": "https://tweetsup.mozillalabs.com/",
        "launch_path": "",
        "auth_path": "auth",
        "conduit_path": "conduit/",
        "update_path": "manifest/manifest.json"
      },
      "icons": {
        "16": "icon-16.png",
        "48": "icon-48.png",
        "128": "icon-48.png"
      },
      "developer": {
        "name": "Mozilla Labs",
        "url": "http://mozillalabs.com"
      }
      "locales": {
        "es": {
          "description": "Buscar twitter y recibir notificaciones dentro de ellos el tablero de mandos de aplicación",
          "app": {
            "auth_path": "auth?lang=es"
          },
          "developer": {
            "url": "http://bg.mozillalabs.com/",
          }
        },
        "bg-BG": {
          "description": "Търсене Twitter и да получи нотификациите от тях вътре в таблото Вашата кандидатура",
          "app": {
            "auth_path": "auth?lang=bg"
          },
          "developer": {
            "url": "http://bg.mozillalabs.com/"
          }
        }
      }
    }

### Manifest Properties

**name** (required) The end user visible name of your application.

**description** (optional) An end user visible explanation of what your application is
and why it's useful.

**app** (required) A collection or properties which include application URLs.

**app.urls** (required) A list of URLs under which the application resides.  Except where noted
all other URLs in the manifest must have one of these urls as a prefix.  For example, if
`http://www.somedomain.com/myapp/` is specified as a url, `http://www.somedomain.com/myapp/somepage.html`
will be considered part of the application, while `http://www.somedomain.com/notmyapp/somepage.html` will
not.

For **app.urls**, if multiple urls are specified they all must share the
same domain, however schemes may differ.  For instance,

    "urls": [
      "http://somedomain.com/myapp",
      "http://www.somedomain.com/myapp"
    ]

is an invalid set of urls (the domains don't match), while the following is valid:

    "urls": [
      "https://www.somedomain.com/myapp",
      "http://www.somedomain.com/myapp"
    ]

(schemes may differ as long as domains match)

**XXX**: how do folks feel about the domain name restriction?  Do you understand the motivation?

**app.base_url** (required) The canonical path to your application.  A
base_url uniquely identifies an application, and no two applications
_should_ have the same base_url.  The `base_url` _must_ be matched by at least
one of the urls in `app.urls`.

**app.launch_path** (optional)  A path that will be appended to `app.base_url` to
form the "launch url" for the application.  A user will be redirected to this URL when
they "launch" your application.  If not provided, your application will not be launchable.

**app.update_path** (optional) This is a path to a web hosted version of your application's
manifest.  Updating this manifest is effectively updating your application.

**app.conduit_path** (optional) This is the path to your applications
'web conduit'.  A conduit is a little invisible webpage that exposes
features over cross-document messaging.  The purpose of a conduit is
to allow your application to provide results to batch operations that
the user performs across all of their install apps, such as searches.

The next section of this document covers web conduits in depth.

**app.auth_path** (optional) Whenever an application requires authentication
to perform certain operations, the user agent or application dashboard can
redirect the user to the page specified in `auth_path`.

Users will typically end up on the authentication page when, conduits
return an error code to indicate that user authentication is required.

After a user is authenticated the application may store credentials in
any manner they like, including [local
storage](http://dev.w3.org/html5/webstorage/) or as HTTP cookies.
Because the conduit is served from the same domain as the authentication
URL, these are viable means of transfering authentication credentials.

**XXX:** How does auth_path know where to redirect the user after they're authenticated?

**developer.name** (optional) This is a human readable name of the developer
of the application, which may be an organization or individual.

**developer.url** (optional) A url to redirect a user to when the indicate that they
want more information about the developer of an application (such as by clicking
on the developers name).

**XXX:** is a manually updated version number useful?  Why?  Maybe this
should work like the web.  the web isn't versioned, and in cases where
versioning is desired (REST APIs) we use pathing to solve the problem
of versioning.

### L10n and `locales`

The locales property is designed to support localization of manifests.  At the top
level of the locales object are string properties which are language tags
that conform to [RFC 4646](http://www.ietf.org/rfc/rfc4646.txt).  Underneath
language tags are object which are designed to "overlay" the manifest itself.

That is, the language tag may have as children any of properties documented above
that may occur at the top level.  The example above shows how the `locales` 
mechanims may be used to overlay locale specific versions of authentication 
urls and developer information urls.

**XXX:** the dashboard will need a well documented way of extracting locale from
browser and matching that locale to one of those provided.  This probably deserves
a section all its own?

