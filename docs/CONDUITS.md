# Installable Web Applications - Web Conduits

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

## Notational Conventions

Throughout this document when documenting data structures both example
objects (in JSON) and schema are provided.  All schema are in
[Orderly](http://orderly-json.org/), which is a textual shorthand for
JSONSchema.

## Underlying Technologies

*Web Conduits* build on top of several technologies: **[cross document
messaging](http://dev.w3.org/html5/postmsg/#web-messaging)** provides
the raw mechanism to exchange messages between documents from within
the browser on the client side.  [JSON](http://json.org) gives us a
concise and convenient means of serializing data that can be
represented in JavaScript.  Finally,
*[JSON-RPC](http://json-rpc.org/)* provides a representation and set
of semantics for messages.  While web conduits as presented here do
not leverage JSON-RPC exactly, the protocol they leverage is heavily
influenced by JSON-RPC.

## "Wire Format" and Message Types

The Web Conduits protocol involves 5 different kinds of messages:

### Requests

Request messages are the query half of a query/response transaction.
All requests *must* conform to the following schema:

    object {
      integer id;
      string method;
      any params?;
      array { string; } callbacks?;
    };

An example request might look something like:

    {
      "id": 72650,
      "method": "search::run",
      "params": {
        "term": "open"
      },
      "callbacks": [
        "results"
      ]
    }

**id** is a unique integer selected by the endpoint who is sending the 
request.

**method** is a required method name, indicating which service or function
should be executed on the receiving end.

**params** can be any data that is possible to represent in JSON.  The
precise contents are method dependant and are documented in a
subsequent section of this document.

**callbacks**, like **params**, are method dependant.  These are an array of 
strings which name enumerate "callbacks" that can be invoked *during* the 
execution of a method.  That is, a recipient of a request may invoke any number
of callbacs before returning completing the invocation (by returning a result
or an error).

### Callback Invocations

Callback invocations can occur after requests, but before responses.
They invoke a "callback" named in the initial request message.  Any
number of callback messages may be sent before a response.  It is an
error to send a callback message after a response has been sent and
the recipient should drop the message and *may* emit an error.
Callback invocation messages *must* conform to the following schema:

    object {
      integer id;
      string callback;
      any params?;
    };

An example callback invocation looks like:

    {
      "id": 72650,
      "callback": "results",
      "params": [
        {
          "title": "I like to open cans of worms"
          "link": "http://somesi.te/432521232"
        },
        {
          "title": "The open web is eye-opening"
          "link": "http://somesi.te/878235425"
        }
      ]
    }

**id** the integer id from the request to which this callback
invocation is a response.

**callback** the string identifier of a callback to invoke.  The original request
to must have included this same string a

**params** can be any data that is possible to represent in JSON.  The
precise contents are method dependant and are documented in a
subsequent section of this document.

### Error Responses

Error messages *may* be sent in response to any request that may not be fulfilled.
The presence of both an id and an error property uniquely identifies error messages,
which *must* conform to the following schema.

    object {
      integer id;
      string error;
      string message?;
    };

**id** the integer id from the request to which this error is a
response.

**error** a textual error code which may be both a visual hint to developers as well
as meaningful programatically.

### Responses

Responses are sent when the action (or method) specified in a request is complete.

    object {
      integer id;
      any result?;
    };

**id** the integer id from the request to which this messge is a response.

**result** can be any data that is possible to represent in JSON.  The
precise contents are method dependant and are documented in a
subsequent section of this document.

### Notifications

Notifications are different from the other 4 message types in that
they stand alone.  Notifications are not required to have any response
at the protocol level, and typically deliver information about asynchronous
events.  Notification messages must conform to the following schema:

    object {
      string method;
      any params?;
    };

**method** is a required method name, indicating the nature of the notification.

**params** can be any data that is possible to represent in JSON.  The
precise contents are method dependant and are documented in a
subsequent section of this document.

## Special Error codes

Some error codes which have special meaning pertinent to both the dashbaord and
conduits are defined centrally:

**needsAuth** The conduit cannot complete the method specified because
the user must authenticate.  The calling application (dashboard)
should allow the user to go to the auth_path specified in the
application manifest to authenticate and resolve the issue.

## Connection Setup

When a conduit is first established the two endpoints become ready at different
times.  "Readiness" in this case is the act of establishing an event listener to
receive messages and setting up whatever application level structures are required
to handle messages.

To deal with this race condition, a simple application level handshake is employed.
Each endpoint must obey the following:

* Once ready, each endpoint should emit a "ping" notification.
* Upon receipt of a "ping" notification an endpoint should assume that the other
  endpoint is ready and return a "pong" notification.
* Upon receipt of a "pong" notification an endpoint should assume that the other
  endpoint is ready.

In the above set of rules a ping notification is simply a *notification* with method
name "__ready", and the string "ping" as its *param* value.  A "pong" notification is 
identical, but with "pong" as its *param* value.

The following is a typical message flow at message startup:

    >> { "method": "conduit::__ready", "params": "ping" }
    (message lost)
    << { "method": "conduit::__ready", "params": "ping" }
    >> { "method": "conduit::__ready", "params": "pong" }
    (application handshake complete)

## All About Message IDs

XXX

## Method names and scoping

XXX

## Available Libraries: JSChannel

XXX

XXX: Here we'll describe the message formatting conventions that are 
common to all protocol messages.  We'll provide code that details how
to set up a communication channel and validate the origin of messages.

XXX: We'll message very early on that abstractions exist which do most
of this hard work for you

XXX: this is going to jsonrpcish, with a couple exceptions.

### QUESTIONS

* _How do we determine supported APIs?_  Do we load and call a function on the
  conduit, or are the apis enumerated in the manifest?  lloyd likes the former cause he's 
  cared of the DRY police, dan likes the latter, mike is somewhere in the middle.







