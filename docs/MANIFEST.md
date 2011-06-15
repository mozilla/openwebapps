### App Manifest

Production Manifest documentation lives at: https://developer.mozilla.org/en/OpenWebApps/The_Manifest

Here we document the in-development state of the manifest.

THIS IS NOT YET IMPLEMENTED IN CODE. For now, this is documentation of how we think the manifest *should* look.

## Changes

Three changes from the production version:
- widget becomes a service, rather than an independent field
- services is no longer experimental, it's top-level.
- services now contains keyed items, rather than an array of objects that doesn't allow for easy indexing. A service entry can contain either a single service (object), or a list of services, for example in the case of a few widgets.

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
        "services": {
            "widget": {
                 "url": "/widget.html",
                 "width": 100,
                 "height": 200
            },
            "image.send": {
                 "url": "/services/image-send",
            }
        }
   }

