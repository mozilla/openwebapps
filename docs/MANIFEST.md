### The Application Manifest

See also the [wiki page on Application Manifests](http://wiki.mozilla.org/Labs/Apps/Manifest).

The Manifest is a complete description of what the web browser needs to interact with the application.  It provides both human-readable elements (a name, a set of icons, and a description; possibly in multiple languages) and machine-readable elements (URLs, lists of capabilities), which allow the application repository and dashboard to display and launch applications.

The Manifest is encoded as a JSON data structure, and is provided to the browser when the application is installed.  The manifest is persisted in the application repository and is used by the dashboard and browser in subsequent interactions with the user.

When an application is self-published the application developer provides the manifest directly.  When a store or curated directory publishes the application, the store or directory provides the manifest, and is free to inspect it prior to publication. <!-- FIXME: is the store free to modify it as well?  What is the authority of a manifest?  This could be answered/discussed with a wiki link. -->

For detailed description of the manifest, and discussion of its design, visit [the wiki](http://wiki.mozilla.org/Labs/Apps/Manifest).  (Note that the design of the manifest is intended to build on and comment on existing work by Google on [hosted web application manifests](http://code.google.com/chrome/apps/docs/developers_guide.html#live); please see the wiki for more in-depth discussion)

For a discussion of the security and privacy considerations around the application manifest, please see [Security and Privacy Considerations](security.html).  In particular, for a discussion of using digital signatures to create tamper-evident manifests, see [the wiki](http://wiki.mozilla.org/Labs/Apps/Manifest#Signatures).

#### An Example Manifest

    {
      "version": "1.0",

      "name": "MozillaBall",
      "description": "Exciting Open Web development action!",

      "base_url": "https://mozillaball.mozillalabs.com/",

      "capabilities": {
        "geolocation": true,
        "navigation_consolidation": true
      },

      "icons": {
        "16": "icon-16.png",
        "48": "icon-48.png",
        "128": "icon-128.png"
      },

      "developer": {
        "name": "Mozilla Labs",
        "url": "http://mozillalabs.com"
      },

      "installs_allowed_from": [
        "https://appstore.mozillalabs.com"
      ],

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

* [**name**](http://wiki.mozilla.org/Labs/Apps/Manifest#name): A human-readable name for the application.

* [**description**](http://wiki.mozilla.org/Labs/Apps/Manifest#description): (optional) A human-readable description of the application.

* [**base_url**](http://wiki.mozilla.org/Labs/Apps/Manifest#base_url): The URL that is used as a base for relative URLs which follow.  The base_url defines the application scope, any resources hosted at urls which have the base_url as a prefix are considered part of the application, and will have the capabilities requested.

* [**launch_path**](http://wiki.mozilla.org/Labs/Apps/Manifest#launch_path): (optional) The path that is appended to base_url to create the *launch URL* for the application, which is the page that is loaded when the application starts.  If empty or not provided, the base_url will be treated as the *launch URL*.

* [**capabilities**](http://wiki.mozilla.org/Labs/Apps/Manifest#capabilities): (optional) an object which expresses advanced web browser capabilities desired by the application.  UAs with native support for openwebapps should prompt the user for permission to grant these capabilities at installation time; the user is free to deny access to any or all of these permission requests, but this may cause the application to behave incorrectly.

* [**icons**](http://wiki.mozilla.org/Labs/Apps/Manifest#icons): (optional) a map of icon sizes to URLs, which are interpreted relative to the base_url, which should contain square images suitable for use as application icons.  data URLs are legal in this field.

* [**developer**](http://wiki.mozilla.org/Labs/Apps/Manifest#developer): (optional) information about the developer of the application, suitable for use in repository and dashboard UIs

    * [**name**](http://wiki.mozilla.org/Labs/Apps/Manifest#developer.name): the name of the developer

    * [**url**](http://wiki.mozilla.org/Labs/Apps/Manifest#developer.url): the URL of an information site for the developer; the developer is free to place a URL that provides more detailed information about this app in this field

* [**locales**](http://wiki.mozilla.org/Labs/Apps/Manifest#locales): (optional) a map of local-specific overrides on the data contained in the manifest, which UIs should use to provide localized views.  Each locale entry is keyed on a [locale tag](http://www.ietf.org/rfc/rfc4646.txt), and contains a sparse representation of the manifest; any field that is present in the locale value should override the matching field in the manifest.   Certain fields may not be overridden, including capabilities, default_locale, locales itself, and installs_allowed_from; a manifest that overrides any of these fields is invalid.

* [**default_locale**](http://wiki.mozilla.org/Labs/Apps/Manifest#default.locale): The locale tag for the "default" translation of manifest properties.  That is, the locale of values outside of the locales map.  The presence of this key makes it possible to enumerate the locales supported by a manifest.

* [**installs_allowed_from**](http://wiki.mozilla.org/Labs/Apps/Manifest#installs.allowed.from): (optional) An array of origins (scheme + host + port) that should be allowed to trigger installation of this application.  This field gives the host of an application control over who may offer the application for installation, and must be respected by the application repository (eventually, the user agent).  If omitted, installation may only be triggered from the origin where the application is hosted (extracted from base_url).

* [**manifest_name**](http://wiki.mozilla.org/Labs/Apps/Manifest#manifest.name): (optional) The filename under which the manifest is stored, such that concatenation of base_url + manifest_name produces an absolute url to where the manifest is hosted.  Valid values will conform to the 'segment' production from [rfc 3986](http://tools.ietf.org/html/rfc3986#section-3.5).  If not provided, the default for manifest_name is `manifest.webapp`

* [**version**](http://wiki.mozilla.org/Labs/Apps/Manifest#version): (optional) A string that represents the version of the application.  The repository doesn't use this value in any way, but developers may embed this string into the manifest and extract it to help deal with various update dcases.  See the section on updating, below.

#### Serving Manifests

Proper web applications should serve manifests as separate resources under urls which have `base_url` as a prefix.  By convention, manifests should be contained in files with an extension of `.webapp`.  Web application manifests should be served with a `Content-Type` header of `application/x-web-app-manifest+json`.  Both manifests and applications should be provided over SSL.

The document is expected to be UTF-8, but another encoding can be specified with the `Content-Type: application/json; charset=X` (i.e., we use the normal process for handling document encodings).

#### On Updating

A web application respects the normal rules for web caching, and may optionally use advanced mechanisms for improved startup, like the [HTML5 AppCache](http://www.whatwg.org/specs/web-apps/current-work/multipage/offline.html#offline).  Given this, there are no special considerations for application update for the normal resources that an app uses.

One area where webapps are different, is in the handling of the manifest.  There are some changes that can be made to a manifest that may require user approval (requests for additional `capabilities`, for instance).  Depending on the implementation of the application repository, it may be unclear whether an update has occured.  To allow developers a clean way to deal with this issue, they may provide a `version` property in the application manifest.  This version may be later checked by inspecting the return value of the `navigator.apps.getInstalled()` function.  The ability to check the currently installed version, combined with using `navigator.apps.install()` to explicitly trigger a manifest update, allow one to manage updating of the application manifest.  Finally, given `version` is an opaque string to the repository, applications may use whatever versioning scheme they desire.

Application developers MAY also use the [`Last-Modified`](http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html) header when serving manifests if they wish to use timestamp based versioning.

#### Application Security Tiers

It is expected that adoption of web applications will occur gradually: that site owners will incrementally build custom web apps for their content only as popularity and demand of the platform increases.  However, users should be able to benefit from simplified launch of existing web pages even before a site has explicitly published a web application.   The problem that arises is designing a simple system to allow distributed development of simple "bookmark" applications for existing websites by anyone, while also safely exposing richer capabilities to full "published" applications.

Given these somewhat conflicting goals, there are two different types of web applications:

**published** web applications are apps where the manifest is available at the url which results from concatenating base_url and manifest_name, that is the manifest is hosted by the same server as the application.  This implies that the host of the site has explicit support for web applications.  *published* web applications may include a `capabilities` property in the manifest to request advanced capabilities that are not available to normal web pages.  In addition to the hosting requirement, in order to be considered a *published* app, manifests must be served with a `Content-Type` header having a value of `application/x-web-app-manifest+json`.  See the security considerations section below for further discussion of these requirements.

**anonymous** applications are those applications which do not satisfy the requirements of a *published* app, and may not request extra capabilities.

#### Security Considerations

Published web applications are able to do more than normal web pages (via requested capabilities).  Given the increased privileges of these apps, there is also increased risk.  At its core, the key areas of risk arise from the fact that application installation grants extra capabilities to some set of web resources.  This risk is minimized by the following policies:

**no cross origin capability requests**:  Given the requirements of a *published* web application, it is not possible for anyone other than those who controller of content on an origin to request increased capabilities for their content.  This eliminates a class of injection attacks and also scenarios where specific capabilities could be used to hijack user navigation.

**custom header requirement**: *published* web applications must have manifests served with a specific HTTP header, which makes it more difficult to inject applications into sites which expose user published content.

**capability isolation**: capabilities are only granted to resources having a URL which is prefixed by `base_url`, which is more granular than using only origin and gives app authors another tool to minimize vulnerability.

**no nested manifests**: given the specification of `manifest_name` the manifest file for an application must be in the directory specified by `base_url`, and may not be in a sub-directory.  This is a further countermeasure which minimizes the effectiveness of an attack mounted atop user generated content.

**clear prompting**: risks are mitigated when care is taken in designing user prompts.  In the case of *anonymous* applications, for instance, both the application provider origin and the launch origin are known.  One tactic may be for the user agent to prefer the display of this unforgeable information over anything supplied by the (untrusted) application provider.  
