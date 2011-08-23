/*
 * An example activity registration
 */

navigator.apps.services.registerHandler(
  'http://webactivities.org/share', 
  'doShare', 
  function(activity, credential) {
    // post the message back to server using AJAX
    // activity.data contains the named parameters to doShare
    // credential contains the credential previously set up by the login activity
    
    // if not logged (credential is bad, expired, or inexistent)
    // activity.postException(activity.CREDENTIAL_FAILURE);
    
    // if successful:
    activity.postResult({status:"ok"});
    
    // if other failure:
    // activity.postException(activity.FAILURE);
  });

// tell the system that all handlers have been registered.
navigator.apps.services.ready();
