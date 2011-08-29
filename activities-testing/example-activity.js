/*
 * An example activity registration
 */

// capabilities
navigator.apps.services.registerHandler(
  'http://webactivities.org/share',
  'getParameters',
  function(activity, credentials) {
    activity.postResult({
      // no features for simple twitter-style sharing
      features: [],
      constraints: {
        textLimit: 140,
        editableURLInMessage: true,
        shortURLLength: 20
      },
      shareTypes: [
        {type: 'public', name: 'Public Timeline'},
        {type: 'direct', name: 'Direct Message', toLabel: 'recipient handle'},        
      ]
    });
  }
);

// list of items to autocomplete
var RECIPIENTS = [
  'Alice',
  'Bob',
  'Charlie',
  'Connor',
  'Chloe',
  'David',
  'Doris',
  'Emily',
  'Erin',
  'Eric'
];

// autocomplete recipients
navigator.apps.services.registerHandler(
  'http://webactivities.org/share',
  'autocompleteRecipients',
  function(activity, credentials) {
    // auto-complete on direct share type only
    if (activity.data.type == 'direct') {
      activity.postResult(_.select(RECIPIENTS, function(recipient) {
        return recipient.indexOf(activity.data.input > -1);
      }));
    } else {
      activity.postResult([]);
    }
  }
);

// validate recipients
navigator.apps.services.registerHandler(
  'http://webactivities.org/share',
  'validateRecipients',
  function(activity, credentials) {
    // for now no invalid recipients.
    activity.postResult(true);
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
    activity.postResult({messagePosted: activity.data.message, messageURL: "http://example.com/" + Math.round(Math.random() * 10000)});
    
    // if not logged (credential is bad, expired, or inexistent)
    // activity.postException(activity.CREDENTIAL_FAILURE);
    
    // if other failure:
    // activity.postException(activity.FAILURE);
  });

// tell the system that all handlers have been registered.
navigator.apps.services.ready();
