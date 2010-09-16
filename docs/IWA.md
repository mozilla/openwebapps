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

### QUESTIONS

* this is compatible with chrome's manifest format.  Does that make sense?
* conduit_url - how do we determine supported APIs?  Do we load and call a function on the
  conduit, or are the apis enumerated in the manifest?  lloyd likes the former cause he's 
  cared of the DRY police, dan likes the latter, mike is somewhere in the middle.
* if we disband the chrome compatibility requirement, we could have a 'base_url' that serves
  as the url that will resolve all relative urls.  Then we can either require or write our
  samples using relative urls to emphasize the requirement that urls are underneath the app.urls
  sites and to remove redundant information and minimize typos.
* how do people feel about locales and the overlay system for l10n?  (mike designed it, lloyd likes it)

XXX: write me

## Web Conduits

The IWA platform supports a couple of interesting features that
require the dashboard to be able to call into applications to access
data that is aggregated and displayed to the end user.  An example
feature that requires this is search: The user enters a search term on
their dashboard and the search is run across all of the applications
the user has installed, as results become available the results list
is dynamically updated.  While there are many different technical
approaches to this problem, for reasons of performance, portability,
and flexibility we chose to support this communication using what we
are calling "Web Conduits".  Web conduits are web pages written by the
application author that are loaded into an iframe by the dashboard and
can communicate with the dashboard via HTML5 cross document messages.
The key ideas behind conduits are:

* written and hosted by the application author
* loaded into iframes by the dashboard
* nothing more than webpages that run in the background,
  which have no user visible UI.
* have permission to perform HTTP requests (with full credentials) to
  the application's website, given that they are served from that domain.
* are completely sandboxed from the dashboard and can leverage whatever
  libraries or frameworks they desire.

For the visually inclined, here's a depiction of conduits in action:

![its conduits](/mozilla/appetizer/raw/master/docs/img/conduits.png)

This diagram puts emphasis on the key points that because conduits are
served from the same origin as the application, they can freely
perform HTTP requests with credentials back to that server.
Additionally, the wire format and authentication mechanisms are
completely controlled by the application author, and they can use
whatever is apropriate.  The key requirement for these conduits is
that they listen for cross-document messages and respond properly to
those messages defined in this document associated with the services
that they provide.

### Messaging basics

XXX: Here we'll describe the message formatting conventions that are 
common to all protocol messages.  We'll provide code that details how
to set up a communication channel and validate the origin of messages.

XXX: We'll message very early on that abstractions exist which do most
of this hard work for you

XXX: this is going to jsonrpcish, with a couple exceptions.










