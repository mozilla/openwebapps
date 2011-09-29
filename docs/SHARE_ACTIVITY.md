# Share Web Activity

Here we define the specifics of the Share Web Activity. Read up on [Web Activities](ACTIVITES.md).

## getParameters

localized by the provider according to whatever they want.

no parameters, returns an objects with:

features: [] of values

* subjectLabel: string  
  the label to be shown for the subject label. If omitted, no subject field
  will be shown.
* image: boolean
* imageURL: boolean
* title: boolean  
  indicates if a title field for the link should be presented.
* caption: boolean  
  indicates if a caption field should be presented.
* description: boolean  
  indicates if a description field should be presented.

XXX - should any other of the above boolean fields be changed from boolean
      to a "label" field - eg, should 'description' be 'descriptionLabel'?

XXX - clarify the "image" elements above - how do they impact the UI - eg,
      is the imageURL field actually editable?

constraints: Object with attributes:

* textLimit: int
* editableURLInMessage: boolean
  whether URL must be displayed/editable in message box
* shortURLLength: int  
  size of urls when shortened, or null. If the service automatically shortens
  links in a message, this is the size of such shortened URLs. This is used in
  conjunction with the textLimit field - the displayed counter will be
  calculated based on any links in the message being replaced with this many
  characters, rather than the length of the links themself. If the service
  does not automatically shorten long links in the message this should be null
  or omitted - in which case the UI may choose to shorten the link using a
  different service and directly include the shortened link.

share types: array of objects, each with:

* type: string  
  API name of the share, e.g. "wall" (pure API backend, no l10n)
* name: string  
  display name, e.g. "My Wall" (l10n)
* toLabel: string  
  label of the "to" field (l10n). If omitted, no 'recipients' field will be
  displayed.


## autocompleteRecipients

takes a share type and a string:

    {type: ..., input: ...}

returns a list of simple objects, each simple PoCos, with id and displayName.

guidance: this needs to be fast, i.e. < 1s.


## validateRecipients

takes a share type and a list of recipients:

    {type: ..., recipients: []}

returns true if validate, otherwise details of exception in postException.


## send

takes:

    {url: ... ,
     type: ... ,
     recipients: [],
     message: ... ,
     fields: {...}
    }

returns to mediator:

    {
    messagePosted:  
        string, required: A string with the message content as posted. If the
        application modified the message in any way (eg, by automatically
        shortening links etc), this should be the modified version actually
        posted.
    messageUrl:  
        string, optional: A URL to the posted message if such a URL exists.
    }
