# Installable Web Applications - Composition

The difference between an Installable Web Application and a webpage is, by design,
minimal.  To dress a plain ol' webpage up as an IWA, all you need is:

1. A JSON manifest file that describes the application
   (`manifest.json`) and includes metadata regarding its capabilities.
2. (optional) Pretty icons in a couple different sizes.
3. (optional) A 'conduit' (a special webpage hosted under the
   application's url) to enable things like notifications and
   dashboard originated search of users data within the application.

The remainder of this document talks about these various components:

## manifest.json

At the center of an IWA is a manifest.  Here's what one looks like:

    {
      "name": "TweetSup?",
      "description": "Search twitter and receive notifications from them inside your application dashboard",
      "app": {
        "urls": [
          "https://tweetsup.mozillalabs.com"
        ],
        "launch": {
          "web_url": "https://tweetsup.mozillalabs.com",
        }
        "auth_url": "https://tweetsup.mozillalabs.com/auth",
        "conduit_url": "https://tweetsup.mozillalabs.com/conduit/",
        "updates_url": "https://tweetsup.mozillalabs.com/manifest/manifest.json"
      },
      "icons": {
        "16": "https://tweetsup.mozillalabs.com/icon-16.png",
        "48": "https://tweetsup.mozillalabs.com/icon-48.png",
        "128": "https://tweetsup.mozillalabs.com/icon-48.png"
      },
      "developer": {
        "name": "Mozilla Labs",
        "url": "http://mozillalabs.com"
      }
      "locales": {
        "es": {
          "description": "Buscar twitter y recibir notificaciones dentro de ellos el tablero de mandos de aplicación",
          "developer": {
            "url": "http://bg.mozillalabs.com/"
          }
        },
        "bg-BG": {
          "description": "Търсене Twitter и да получи нотификациите от тях вътре в таблото Вашата кандидатура",
          "developer": {
            "url": "http://bg.mozillalabs.com/"
          }
        }
      }
    }

## QUESTIONS

* this is compatible with chrome's manifest format.  Does that make sense?
* conduit_url - how do we determine supported APIs?  Do we load and call a function on the
  conduit, or are the apis enumerated in the manifest?  lloyd likes the former for reasons
  of DRY, dan likes the latter, mike is somewhere in the middle.
* if we disband the chrome compatibility requirement, we could have a 'base_url' that serves
  as the url that will resolve all relative urls.  Then we can either require or write our
  samples using relative urls to emphasize the requirement that urls are underneath the app.urls
  sites and to remove redundant information and minimize typos.
* how do people feel about locales and the overlay system for l10n?  (mike designed it, lloyd likes it)