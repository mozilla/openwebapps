# Web Activities

Web Activities is a service discovery mechanism and light-weight RPC system 
between web apps and browsers.  In the system, a client creates an Activity
describing the action it wants to be handled, and submits it to the browser
for resolution.  The browser presents an interface that allows the user
to select which service to use, and then submits the Activity to the
service provider selected by the user.  The service may return data 
that is returned to the client.  The browser may optionally inspect
or modifying the data as it flows between the client and the service.

Web Activities allows for opportunistic connections between web
components. For example, a user can share a web page via whichever
sharing service she chooses, not just the ones embedded in a given web
page.  Other use cases that been considered include image access, file
storage, search, contact lists, profile data, and payment processing.

We can distinguish three components:

* Client: A calling context, running in the user's browser, which begins the service discovery and invocation activity.  activity. A client could be in web content, or could be in browser chrome.
* Mediator: the user interface that guides the user through service selection for the specific function.  The default mediator is a simple picker, which displays the available providers for an activity.  A more complex mediator could help the user manage their list of providers, by allowing for account selection or status checks; it could also perform "on-the-wire" inspection and modification of the message flow between the consumer and the provider. The Firefox Share/F1 project provides an example of a complex mediator; the [Mozilla Apps UX Gallery](https://apps.mozillalabs.com/gallery/) has some more mockups.
* Provider: A service that has registered for an activity interface. Registration is accomplished by associating an action and/or content type with a specific URL at the provider's site.  This URL, when loaded by the browser, is expected to register one or more message handlers using the *registerHandler* method defined below. These handlers will be invoked by the browser, receiving data from the mediator, for the individual calls expected in the context of a given activity.

## Definition of Activities

The client begins an activity by constructing an Activity and passing it to the startActivity method.

    interface Activity {
     string action;
     string type;
     object data;

     void postResult(in object data);
    }

* `action`: A string that specifies the activity to be launched.
* `type`: An optional MIME type that further defines the type of the payload data. e.g., “image/png” if data is a PNG image.
* `data`: A structured clone that constitutes the payload to send to the service.
* `postResult`: The method used by the service to return data to the client. This method is provided by the browser, and is only useful in the context of the service.  The client should (*ed: must?*) not set this.

Clients interact with the `startActivity` method to start processing:

    interface AppServices {
     // Used by clients to start things off:
     void startActivity(in Activity activity,
                        in optional successCallback,
                        in optional errorCallback);

     // Used by providers to receive messages on the other end:
     void registerHandler(in string action, in string message, in handler);
    };
    Navigator implements AppServices;

Applications are expected to register their ability to perform activity services
by defining one or more service elements in their application manifest:

    'mymanifest.webapp':
    {
      name: "SharingApp",
      icons: {
        32: "/icons/32.png"
      },
      services: {
        "http://webactivities.org/share": {
           type: [ "application/url", "text/*", "image/*" ]
           path: "/services/share"
        }
      }
    }

In this example, SharingApp declares that it supports the well-understood "share" activity, and can accept URLs, text, or images as input.  The handlers that implement the activity are served from the '/services/share' path of the application's domain.  Note that in this example the domain of SharingApp is implicit in what domain served mymanifest.webapp, and the browser will enforce that domain association automatically.  It is implied, though not required, that the `action` identifier of an activity will resolve to a human and machine-readable description of the activity, and that well-known URLs will emerge for activities that are in common use.

*ed: in the current prototype, the startActivity method is called invokeService and is a member of *navigator.apps.  Nomenclature changes TBD!*

It has been proposed by the Chromium team (see [proposal](http://dev.chromium.org/developers/design-documents/webintentsapi)) that services (or "intents") can also be declared in markup.  This approach is being prototyped and considered, though it contains some lifecycle management and user experience challenges.  

## Client Invocation

The client begins an activity by invoking the `startActivity` method, as follows:

     myActivity = new Activity(anAction, someType, someDataObject);
     navigator.apps.startActivity(
       myActivity,
       on_success_cb,
       on_error_cb);

This call might be made by content, or from browser chrome (in which case the
calling syntax may be slightly different depending on library packaging).
When the service has been successfully invoked, the success callback
function is called with a set of values that depend on the specific action.
If the invocation fails, the error callback is called with an exception
object. 

*ed: match canonical error callback behavior from other web APIs*

## Service Mediator

The service mediator is browser-based logic and interface elements that are loaded after service invocation.  The mediator helps the user pick a service and interact with it.  

It is expected that user agents will provide a default mediator that presents a reasonable "picker" interface.  User agents may optionally provide other mediators, or provide APIs to extension developers, which will register to handle certain activity actions.

The exact user experience provided by a mediator can vary depending on the activity action.

The authors believe that this is a natural place to assist users with account selection tasks.  We propose that, when a mediator is invoked, it is given read/write access to the activity, a read-only list of services that can serve that activity, and an optional list of credential lists, which describe the accounts that are available to this browser at each of the named activities.  See the *Account Management* section, below, for more on this flow.

The mediator is intended to provide a place for message coordination, so that interactions which require the exchange of multiple messages with a provider need not return data and control to the calling client.

The API provided by a user agent to a mediator implementation is not subject to standardization (_ed: yet?_), but in general, it will need to support the following flow of control:

    // called by the mediator when it is ready
    // to accept an activity:
    navigator.apps.mediation.ready(startActivityFn); 

    function startActivityFn(anActivity, 
                             availableProviders, 
                             availableCredentials) {
       // display an interface by reading anActivity
       // using the map of services and credentials as needed
       // for example:
       for (providerOrigin in availableProviders) {
         makeServicePickerRow(
                availableProviders[providerOrigin], 
                availableCredentials[providerOrigin]);
      }
    }

`availableServices` is an map of domains to manifests.  The mediatorcan resolve the manifest.services[activityAction] element to access optional label and icon properties for the service's implementation.

`availableCredentials` is an object of keyed arrays, where each key is an origin taken from the availableServices, and the value is an array of credentials for that origin. For example, if "twitter.com" is in the service list, then available credentials may have a "twitter.com" property containing an array of three credential objects.


## Provider

When provider's endpoint URL is loaded, it calls the `registerHandler` method to register one or more functions.  Providers are expected to register handlers for all the messages defined by the activity. This explicit registration step allows the user agent to determine whether the provided URL actually implements the activity and to gracefully remove the provider from the list if not.

Providers are free to implement multiple activities in a single URL, or to create different endpoints on different URLs, as they see fit.

When the handler is invoked, the Activity object is passed to it, along with a message and an optional credential object.  The message indicates which step of the activity is being performed, for multi-step activities. The credential object, if it exists, is one that was previously created by this provider and stored in the browser, and which was selected by the user during a mediator-initiated display.

_ed: Need more specific use cases for the message.  Login is one; account-balance is another; more?_

For example:

    navigator.apps.services.registerHandler(
      'http://webactivities.org/share', 
      'doShare', 
      function(activity, message, credential)
      {
        my_ajax.post_share({
          url: activity.data.url, 
          title: activity.data.title, 
          comment: activity.data.comment, 
          credential: credential,
          success: function() {
            activity.postResult({status:"ok"});
          },
          error: function(statusCode) {
            if (statusCode == 403) {
              activity.postException(activity.CREDENTIAL_FAILURE);
            } else {
              activity.postException(activity.FAILURE); 
            }
          }
        });
      }
     );
          
## Account Management

This Activities system is intended to facilitate communication between web content and services which have been personalized for the user.  To facilitate this personalization, an *account management* system is defined here.

This system is implemented by the browser, and allows an activity provider to direct the browser to initiate a provider-defined login process, and to persist a data structure on the provider's behalf.

A provider indicates its ability to participate in account management by implementing the "http://webactivities.org/login" activity.  

The provider is further expected to add a *credentialRequired* property with a value of *true* to all service declarations that require a credential. *XXX: Support for anonymous-or-account?  That would require being in the mediator's list, but then throwing some sort of "logMeInNow" exception.*

The endpoint of the *login* activity is expected to be the URL of a web page which the browser can display in a popup window.  This window should engage in whatever user identification process the provider requires, and should, at the end of this process, invoke this method:

    navigator.apps.services.storeCredential(
      in object credential,
      in optional string displayName,
      in optional string thumbnailURL)

When the `storeCredential` method is invoked, the credential is stored and the window is dismissed.

 * `credential` is an opaque data blob, a structured clone of which will be persisted by the browser
 * `displayName` is a string which will be displayed to the user during account selection
 * `thumbailURL` is a string which should identify a square image which will be displayed near the displayName during account selection


The API provided to mediators includes a method to allow the mediator to initiate the credential acquisition process:

    navigator.apps.mediation.startLogin(aProvider);

It is expected that this call will hide the existing mediation API and begin the credentialing process; at the end of the login activity (after storeCredential is called), if the client context still exists, the activity mediation flow should be restarted. *XX: yikes, complicated state management there*

The credentials obtained through this process are made available to the mediator, and should be included in mediator-provided service picker interfaces.  When the mediator dispatches the call to a service implementation, the selected credential is included in the handler function call's arguments.

Service providers are free to use whatever implementation they need to implement multi-account management.  The system is intended to support single cookie-multiple account systems, as well as systems based on bearer tokens like OAuth2.
