# App Manifest

Production Manifest documentation lives at: https://developer.mozilla.org/en/OpenWebApps/The_Manifest

Here we document the in-development state of the manifest.

## Changes

Three changes from the production version:
- widget becomes a service, rather than an independent field
- services now contains keyed items, rather than an array of objects that doesn't allow for easy indexing. A service entry can contain either a single service (object), or a list of services, for example in the case of a few widgets.

SOON, but not yet: - services will no longer experimental, it's top-level.

## Manifest Example

Here's an example:

    {
        "version": "1.0",
        "name": "MozillaBall",
        "description": "Exciting Open Web development action!",
        "icons": {
             "16": "/img/icon-16.png",
             "48": "/img/icon-48.png",
             "128": "/img/icon-128.png"
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
                     "url": "http://es.mozillalabs.com/"
                  }
             },
             "it": {
                  "description": "Azione aperta emozionante di sviluppo di fotoricettore!",
                  "developer": {
                     "url": "http://it.mozillalabs.com/"
                  }
             }
        },
        "default_locale": "en",
        "experimental": {
          "services": {
              "widget": {
                   "endpoint": "/widget.html",
                   "width": 100,
                   "height": 200
              },
              "image.send": {
                   "endpoint": "/services/image-send",
              },
              "login": {
                   "dialog": "/services/login",
              },
              "new-url": {
              }
          }
        }
    }


The services component lists services provided by the app, with the
corresponding endpoint URL for each. When no endpoint is specified,
this indicates that the main app tab is responsible for providing that
service. Providing a given service implies responding to a set of
messages over postMessage() that, together, implement the service.

Some special cases:

* the login service implies that the main page of the app supports the login messages, and the dialog parameters specifies which dialog to open up to perform login

* the new-url service implies that the main page of the app supports the new-url message, handling clicks to URLs within the app's origin.