### The Application Manifest

See also the [wiki page on Application Manifests](http://wiki.mozilla.org/Labs/Apps/Manifest).

The Manifest is a complete description of what the web browser needs to interact with the application.  It provides both human-readable elements (a name, a set of icons, and a description; possibly in multiple languages) and machine-readable elements (URLs, lists of capabilities), which allow the application repository and dashboard to display and launch applications.

The Manifest is encoded as a JSON data structure, and is provided to the browser when the application is installed.  The manifest is persisted in local storage and is used by the dashboard and repository for subsequent interactions with the user.

When an application is self-published the application developer provides the manifest directly.  When a store or curated directory publishes the application, the store or directory provides the manifest, and is free to inspect it prior to publication. <!-- FIXME: is the store free to modify it as well?  What is the authority of a manifest?  This could be answered/discussed with a wiki link. -->

For detailed description of the manifest, and discussion of its design, visit [the wiki](http://wiki.mozilla.org/Labs/Apps/Manifest).  (Note that the design of the manifest is intended to build on and comment on existing work by Google on [hosted web application manifests](http://code.google.com/chrome/apps/docs/developers_guide.html#live); please see the wiki for more in-depth discussion)

For a discussion of the security and privacy considerations around the application manifest, please see [Security and Privacy Considerations](security.html).  In particular, for a discussion of using digital signatures to create tamper-evident manifests, see [the wiki](http://wiki.mozilla.org/Labs/Apps/Manifest#Signatures).

#### An Example Manifest

    {
      "name": "MozillaBall",
      "description": "Exciting Open Web development action!",

      "base_url": "https://mozillaball.mozillalabs.com",
      "launch_path": "",
      "update_path": "manifest/manifest.json",

      "app_urls": [
        "https://mozillaball.mozillalabs.com/"
      ],

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
      },
      "release": "2010-10-05T09:12:51Z"
    }

#### Discussion of the fields

For detailed technical discussion of the manifest, please visit [the wiki](http://wiki.mozilla.org/Labs/Apps/Manifest).  Informally, the meanings of the fields are:

* [**name**](http://wiki.mozilla.org/Labs/Apps/Manifest#name): A human-readable name for the application.

* [**description**](http://wiki.mozilla.org/Labs/Apps/Manifest#description): A plain-text human-readable description of the application.

* [**base_url**](http://wiki.mozilla.org/Labs/Apps/Manifest#base_url): The URL that is used as a base for relative URLs which follow.  The base_url must belong to the application.

* [**launch_path**](http://wiki.mozilla.org/Labs/Apps/Manifest#launch_path): The path that is appended to base_url to create the "launch URL" for the application, which is the page that is loaded when the application starts.

* [**update_path**](http://wiki.mozilla.org/Labs/Apps/Manifest#update_path): (optional) The path that is appended to base_url to create the "update URL" for the application, which must return a manifest.  Application repositories should check for a new manifest periodically and apply the update to their local repository copy if the manifest found there is newer than the local copy. <!-- FIXME: if this is the case, then stores should not be able to provide a manifest themselves, as it could be immediately wiped by this update, and because of URL restrictions the store can't rewrite this path to something store-specific -->

* [**app_urls**](http://wiki.mozilla.org/Labs/Apps/Manifest#app_urls): A list of URL prefixes, which must contain at least a scheme and hostname, but may optionally have a path portion.  Any URL that begins with one these URL prefixes, with a full match on the scheme, hostname, and port of the manifest URL, is said to "belong" to the application, and should be consolidated into a single browsing experience by an application-aware browser.  Incomplete hostnames, e.g. "http://www", will fail to match any application and are invalid.  base_url must be included in the set defined by app_urls, and the manifest is invalid if it is not.

* [**capabilities**](http://wiki.mozilla.org/Labs/Apps/Manifest#capabilities): a list of string tokens describing advanced web browser capabilities that the application requests.  Browser-native application repositories should prompt the user for permission to use these capabilities at installation time; the user is free to deny access to any or all of these permission requests, but this may cause the application to behave incorrectly.

* [**icons**](http://wiki.mozilla.org/Labs/Apps/Manifest#icons): a map of icon sizes to URLs, which are interpreted relative to the base_url, which should contain square images suitable for use as application icons.  data URLs are legal in this field.

* [**developer**](http://wiki.mozilla.org/Labs/Apps/Manifest#developer): information about the developer of the application, suitable for use in repository and dashboard UIs

    * [**name**](http://wiki.mozilla.org/Labs/Apps/Manifest#developer.name): the name of the developer

    * [**url**](http://wiki.mozilla.org/Labs/Apps/Manifest#developer.url): the URL of an information site for the developer; the developer is free to place a URL that provides more detailed information about this app in this field

* [**locales**](http://wiki.mozilla.org/Labs/Apps/Manifest#locales): a map of local-specific overrides on the data contained in the manifest, which UIs should use to provide localized views.  Each locale entry is keyed on a local code, and contains a sparse representation of the manifest; any field that is present in the locale value should override the matching field in the manifest.  Locales are not allowed to override the capabilities field; a manifest that does so is invalid.

* [**release**](http://wiki.mozilla.org/Labs/Apps/Manifest#release): A timestamp in ISO 8601 format representing when this version of the manifest came into effect (see below)

#### On Updating

Note that, because the logic for a web application is loaded using the normal rules for web caching, and may optionally use [HTML5 AppCache](http://www.whatwg.org/specs/web-apps/current-work/multipage/offline.html#offline) for bulk caching, there is no need to deploy new versions of the manifest or the application to clients.  In normal operation, when the web application is updated, the client notes the presence of new content, and downloads it automatically, with no need for user interaction.  <!-- FIXME: this confused me; I think I know what it means, but maybe it can be reworded? -->

The manifest update mechanism is provided only for those situations where the manifest must actually change.  This could include a new URL, a new web browser capability, or a change to the icon, descriptive text, or localized strings.  The release date contained in the manifest is the only source of versioning data for this operation. <!-- FIXME: Why couldn't manifest updating be based on the same cache rules? -->
