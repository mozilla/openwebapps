# Share Web Activity

Here we define the specifics of the Share Web Activity. Read up on [Web Activities](ACTIVITES.md).

## getParameters

localized by the provider according to whatever they want.

no parameters, returns an objects with:

features: [] of values

* subject
* image
* imageURL
* title
* caption
* description

constraints

* textLimit: int
* editableURLInMessage: whether URL must be displayed/editable in message box
* shortURLLength: int, size of urls when shortened, or null

share types: array of objects, each with:

* type: API name of the share, e.g. "wall" (pure API backend, no l10n)
* name: display name, e.g. "My Wall" (l10n)
* toLabel: label of the "to" field (l10n)
* requiresRecipients: boolean of whether to show recipients field


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

    {messagePosted: ...}


