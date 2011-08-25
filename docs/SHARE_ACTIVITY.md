# Share Web Activity

Here we define the specifics of the Share Web Activity. Read up on [Web Activities](ACTIVITES.md).

## getCapabilities

no parameters, returns an objects with:

inputs in mediator

* subject
* textLimit
* includeURL: whether URL must be displayed in message box
* shortURLLength: size of urls when shortened, or null

properties of item being shared (all form elements)

* image
* imageURL
* title
* caption
* description

share types

* type: official name of the share
* name: display name
* toLabel: label of the "to" field
* requiresRecipients: boolean of whether to show recipients field


## autocompleteRecipients

takes a share type and a string
returns a list of simple objects, each with id and displayName.

guidance: this needs to be fast, i.e. < 1s.


## validateRecipients

takes a share type and a list of recipients
returns true if validate, otherwise details of exception in postException.


## send

takes:

* url
* share type
* list of recipients if necessary
* message
* an object with all the form fields specified by the capabilities

returns to mediator:

* messagePosted: with shortened URLs in particular
