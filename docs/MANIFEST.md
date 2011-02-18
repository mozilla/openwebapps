### The Application Manifest

See also the [wiki page on Application Manifests](http://wiki.mozilla.org/Labs/Apps/Manifest).

The Manifest contains some information that the web browser needs to interact with an application.  It provides both human-readable elements (a name, a set of icons, and a description; possibly in multiple languages) and machine-readable elements (URLs, lists of capabilities), which allow the application repository and dashboard to display and launch applications.  The manifest and origin (scheme, host, and port) where its hosted at install time collectively are the complete description of an installed application.

The Manifest is encoded inside a file as a JSON data structure, and a url to that file is provided to the browser when an application is installed.  The manifest is persisted in the application repository and is used by the dashboard and browser in subsequent interactions with the user.

When an application is self-published the application developer triggers application installation in a page that he controls (see API documentation around `navigator.apps.install()`).  When a store or curated directory publishes an application, they trigger application installation by providing a url to the manifest of the hosted application.

For a detailed description of the manifest, and discussion of its design, visit [the wiki](http://wiki.mozilla.org/Labs/Apps/Manifest).  (Note that the design of the manifest is intended to build on and comment on existing work by Google on [hosted web application manifests](http://code.google.com/chrome/apps/docs/developers_guide.html#live); please see the wiki for more in-depth discussion)

For a discussion of the security and privacy considerations around the application manifest, please see [Security and Privacy Considerations](security.html).  In particular, for a discussion of using digital signatures to create tamper-evident manifests, see [the wiki](http://wiki.mozilla.org/Labs/Apps/Manifest#Signatures).

#### An Example Manifest

    {
      "version": "1.0",

      "name": "MozillaBall",
      "description": "Exciting Open Web development action!",

      "capabilities": {
        "geolocation": true,
        "navigation_consolidation": true
      },

      "icons": {
        "16": "/images/icon-16.png",
        "48": "/images/icon-48.png",
        "128": "/images/icon-128.png"
      },

      "developer": {
        "name": "Mozilla Labs",
        "url": "http://mozillalabs.com"
      },

      "installs_allowed_from": [
        "https://appstore.mozillalabs.com"
      ],

      "widget": {
        "path": "/widget.html",
        "width": 100,
        "height": 200
      },

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
      },

      "default_locale": "en"
    }

#### Discussion of the fields

For detailed technical discussion of the manifest, please visit [the wiki](http://wiki.mozilla.org/Labs/Apps/Manifest).  Informally, the meanings of the fields are:

* [**name**](http://wiki.mozilla.org/Labs/Apps/Manifest#name): A human-readable name for the application (maximum length is 128 characters).

* [**description**](http://wiki.mozilla.org/Labs/Apps/Manifest#description): (optional) A human-readable description of the application  (maximum length is 1024 characters).

* [**launch_path**](http://wiki.mozilla.org/Labs/Apps/Manifest#launch_path): (optional) The path within the application's origin which is loaded when an application starts.  If not provided, the application's origin will be treated as the launch URL.  See [Path Handling](#path-handling).

* [**capabilities**](http://wiki.mozilla.org/Labs/Apps/Manifest#capabilities): (optional) an object which expresses advanced web browser capabilities desired by the application.  UAs with native support for openwebapps should prompt the user for permission to grant these capabilities at installation time.

* [**icons**](http://wiki.mozilla.org/Labs/Apps/Manifest#icons): (optional) a map of icon sizes to paths (may be [absolute paths](#path-handling), or data urls).  Each should contain square images which visually represent the application.

* [**developer**](http://wiki.mozilla.org/Labs/Apps/Manifest#developer): (optional) information about the developer of the application, suitable for use in repository and dashboard UIs

    * [**name**](http://wiki.mozilla.org/Labs/Apps/Manifest#developer.name): the name of the developer

    * [**url**](http://wiki.mozilla.org/Labs/Apps/Manifest#developer.url): the URL of a site containing more information about the application's developer.  This URL is typically rendered when the user clicks on the name of the application's developer while viewing details about an application inside the dashboard (or browser).

* [**locales**](http://wiki.mozilla.org/Labs/Apps/Manifest#locales): (optional) a map of local-specific overrides on the data contained in the manifest, which UIs should use to provide localized views.  Each locale entry is keyed on a [locale tag](http://www.ietf.org/rfc/rfc4646.txt), and contains a sparse representation of the manifest; any field that is present in the locale value should override the matching field in the manifest.   Certain fields may not be overridden, including *capabilities*, *default_locale*, *locales* itself, and *installs_allowed_from*; a manifest that overrides any of these fields is invalid.  When locales is present, `default_locale` must also be present.

* [**default_locale**](http://wiki.mozilla.org/Labs/Apps/Manifest#default.locale): (required when `locales` is present) The locale tag for the "default" translation of manifest properties.  That is, the locale of values outside of the locales map.  

* [**installs_allowed_from**](http://wiki.mozilla.org/Labs/Apps/Manifest#installs.allowed.from): (optional) An array of origins that should be allowed to trigger installation of this application.  This field allows developers hosting their applications to explicitly delegate installation privileges to sites or stores with whom they have a relationship, and must be respected by the application repository (eventually, the user agent).  If omitted, installation may only be triggered from the origin where the application is hosted.

* [**version**](http://wiki.mozilla.org/Labs/Apps/Manifest#version): (optional) A string that represents the version of the application.  The repository doesn't use this value in any way, but developers may embed this string into the manifest and extract it to help deal with various update cases.  See the section on updating, below.

* [**widget**](http://wiki.mozilla.org/Labs/Apps/Manifest#widget): (optional) An HTML document that is designed to be rendered inside an iframe to give users an abbreviated view of your app.

    * [**path**](http://wiki.mozilla.org/Labs/Apps/Manifest#widget.path): The path to the widget.  See [Path Handling](#path-handling).  If not present, the widget URL will be assumed to be the same as the application origin.

    * [**width**](http://wiki.mozilla.org/Labs/Apps/Manifest#widget.width): An integer between 10 and 1000 representing the desired rendered width of the widget.

    * [**height**](http://wiki.mozilla.org/Labs/Apps/Manifest#widget.width): An integer between 10 and 1000 representing the desired rendered height of the widget.

#### Path Handling <a name="path-handling"></a>

All fields which hold paths in the manifest must be absolute paths (i.e. '/images/myicon.png'), and are served from the same origin as the application.

#### Serving Manifests

Manifests SHOULD be contained in files with an extension of `.webapp`.  Web application manifests MUST be served with a `Content-Type` header of `application/x-web-app-manifest+json`.  Manifests MAY be served over SSL to mitigate certain classes of attacks.

The document is expected to be UTF-8, but another encoding can be specified with a `charset` parameter on the `Content-Type` header (i.e. `Content-Type: application/x-web-app-manifest+json; charset=ISO-8859-4`).

User Agents when possible SHOULD meaningfully message the site identity and TLS status when prompting a user to install an application.

#### Updating Manifests

A web application respects the normal rules for web caching, and may optionally use advanced mechanisms for improved startup, like the [HTML5 AppCache](http://www.whatwg.org/specs/web-apps/current-work/multipage/offline.html#offline).  Given this, there are no special considerations for application update for the normal resources that an app uses.

Webapps are different, however, in the handling of the manifest.  There are some changes that can be made to a manifest that may require user approval (requests for additional `capabilities`, for instance).  Depending on the implementation of the application repository, it may be unclear whether an update has occured.  To allow developers a clean way to deal with this issue, they may provide a `version` property in the application manifest.  This version may be later checked by inspecting the return value of the `navigator.apps.getInstalled()` function.  The ability to check the currently installed version, combined with using `navigator.apps.install()` to explicitly trigger a manifest update, allow one to manage updating of the application manifest.  Finally, given `version` is an opaque string to the repository, applications may use whatever versioning scheme they desire.
