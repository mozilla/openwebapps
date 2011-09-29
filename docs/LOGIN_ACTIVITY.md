# Login Web Activity

The login web activity is special: it is managed by the OWA framework,
not by a custom mediator. Typically, a mediator, e.g. the sharing
mediator, will act as the initiator of the login activity, mediated by
the OWA framework. We make this an activity because, from the point of
view of the app, it behaves exactly like an activity, with registered
handlers.

## getParameters

returns

    {
      type: "dialog",
      url: "/login.html"
    }

or

    {
      type: "browserid"
    }

or

    {
      type: "oauth",
    
      // loginURL includes client_id
      loginURL: "https://...",
    
      // redirectURL is where we should expect to see the token in the fragment
      redirectURL: "https://...",
    }

## getCredentials



## validateCredentials



## clearCredentials




