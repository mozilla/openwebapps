### Service Discovery

Open Web Apps Service Discovery allows for opportunistic connections
between web components. For example, a user can share, via Firefox
Share, a link via whichever sharing service she chooses.

We can distinguish three components:

* Instigator/Consumer: the trigger that begins the service-discovery
  activity. The F1 share button is an example, as is web content
  invoking navigator.apps.* service invocation.

* Mediator: the user interface that guides the user through service
  selection for the specific function. F1 is an example of a service
  dashboard, as is the image-get UI.

* App: a single service provider that has registered for the interface
  and, when its corresponding URL is loaded in an IFRAME, responds to
  postMessage() API calls.

## Instigating / Invoking

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

## Service Mediator

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

The mediator should probably instantiate all services for which there
are credentials, i.e.

    for (serviceOrigin in availableCredentials.keys()) {
       for (credential in availableCredentials[serviceOrigin]) {
           availableServices[serviceOrigin].instantiate(credential, function(serviceInstance) {
               // do something with the serviceInstance that was created
           });
    }

### Security Considerations

As service mediators might eventually be pulled from less-trusted
sources, we will consider shutting off their network access once they
have signalled readiness.