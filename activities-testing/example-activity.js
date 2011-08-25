/*
 * An example activity registration
 */

navigator.apps.services.registerHandler(
  // the share activity (don't change this)
  'http://webactivities.org/share',
  // the specific action within that activity (don't change this either)
  'doShare', 
  function(activity, credential) {
    // activity contains: url, message, type, data
    // activity.data contains the named parameters to doShare
    // credential contains the credential previously set up by the login activity

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
