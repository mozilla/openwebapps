# Web Activities

Web Activities allows for opportunistic connections between web
components. For example, a user can share a web page via whichever
sharing service she chooses, not just the ones embedded in a given web
page.

We can distinguish three components:

* Instigator/Consumer: the trigger that begins the service-discovery
  activity. Some triggers may be in web content, others may be in
  browser add-ons (e.g. buttons). 

* Mediator: the user interface that guides the user through service
  selection for the specific function. Firefox Share is an example of
  a service dashboard, as is the image-get UI.

* App: a single service (activity) provider that has registered for
  the interface and, when its corresponding URL is loaded in an
  IFRAME, registers appropriate handlers for the individual calls
  expected in the context of a given activity.

## Instigating / Invoking

(We may change this to navigator.apps.startActivity...)

The instigator begins the process as follows:

    navigator.apps.invokeService(
      method_name,
      {..args..},
      on_success_cb,
      on_error_cb);

This call might be made by content, or by a chrome button click,
e.g. Firefox Share.  When the service has been successfully invoked,
the success callback function is called with a set of values that
depend on the specific action.

method_name examples are "link.share", "image.get", ...


### Pre-Invocation Hooks

F1 for example can hook in right before the service is invoked, add
arguments to the invocation.


## Service Mediator

(WARNING: This section is entirely theoretical, nothing has been built yet.)

The mediator is web content that, upon loading, knows that the user
has invoked the service. The mediator must now help the user pick a
service and interact with it. The exact UX will vary greatly depending
on the specific service activity.

The mediator includes the following code:

    $(document).ready(function() {
      navigator.apps.mediation.ready(serviceInvocation);
    });

which notifies the Apps Framework that the Mediator is ready to
receive the service request. The Apps Framework then delivers the
service request, with method_name and args as parameters, to the
mediator's service invocation function.

    function serviceInvocation(method_name, args, availableServices, availableCredentials) {
       // lay out the services in HTML
    }

availableServices is an array of service, where service includes all
fields from the manifest, including service.origin, service.name,
service.url ...

availableCredentials is an object of keyed arrays, where each key is
an origin taken from the availableServices, and the value is an array
of credentials for previously instantiated services. For example, if
"twitter.com" is one of the availableServices, then there may be an
array of three credential blobs in availableCredentials if the user
has 3 twitter accounts.

The mediator then instantiates all services for which there
are credentials, i.e.

    for (serviceOrigin in availableCredentials.keys()) {
       for (credential in availableCredentials[serviceOrigin]) {
           availableServices[serviceOrigin].instantiate(credential, function(serviceInstance) {
               // do something with the serviceInstance that was created
           });
    }

A serviceInstance object contains a few fields that are useful to the mediator:

* serviceInstance.iframe is the service's IFRAME, if that service
  offers a UI, which the mediator can then position appropriately.

* serviceInstance.port

### Other Considerations

bulk login for all accounts at a provider, at some point?

limited UI to just single credential per provider for now.

### Security Considerations

As service mediators might eventually be pulled from less-trusted
sources, we will consider shutting off their network access once they
have signalled readiness.


## App / Service Provider

When a service provider's endpoint is loaded in an IFRAME, it should
register the service handlers for handling messages of particular
activities.

WARNING: the Flickr Connector and <tt>image.get</tt> activity still
uses the old mechanism of directly receiving invocation via
postMessage().

    navigator.apps.services.registerHandler('login', 'doLogin', function(args, cb) {
       // perform login
    
       cb({'status':'notloggedin'});
    });
    
    navigator.apps.services.registerHandler('link.share', 'doShare', function(args, cb) {
       // share the link
       twitter.share_link(args.url, args.title);
       
       // send back the number of tweets
       twitter.getNumTweets(args.url, function(num){
         cb({numTweets: num});
       });
    });

