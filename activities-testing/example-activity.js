/*
 * An example activity registration
 */

// capabilities
navigator.apps.services.registerHandler(
  'http://webactivities.org/share',
  'getParameters',
  function(activity, credentials) {
    activity.postResult({
      features: [],
    });
  }
);

// autocomplete recipients
navigator.apps.services.registerHandler(
  'http://webactivities.org/share',
  'autocompleteRecipients',
  function(activity, credentials) {
    
  }
);

// validate recipients
navigator.apps.services.registerHandler(
  'http://webactivities.org/share',
  'validateRecipients',
  function(activity, credentials) {
    
  }
);

navigator.apps.services.registerHandler(
  // the share activity (don't change this)
  'http://webactivities.org/share',
  // the specific action within that activity (don't change this either)
  'send', 
  function(activity, credential) {
    // post the message to our server (e.g. MyShare) using AJAX

    // if successful:
    activity.postResult({messagePosted: activity.data.message});
    
    // if not logged (credential is bad, expired, or inexistent)
    // activity.postException(activity.CREDENTIAL_FAILURE);
    
    // if other failure:
    // activity.postException(activity.FAILURE);
  });

// tell the system that all handlers have been registered.
navigator.apps.services.ready();
