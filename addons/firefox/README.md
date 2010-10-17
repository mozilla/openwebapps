## Building the Add-On

You have to install the Jetpack SDK locally.  Get it from tip.

To use Jetpack with 4.0b5 or nightlies, you need to change:

    python-lib/cuddlefish/app-extension/install.rdf

and change <em:maxVersion> to 4.0b6pre (instead of 4.0b5pre).  If this
is no longer necessary, please delete this node from the README.

Run "source bin/activate" from your jetpack-sdk checkout.  And go to
addons/firefox/jetpack/appetizer and run:

    cfx xpi

There will now be an appetizer.xpi which you can install.

You may have to edit addons/firefox/jetpack/appetizer/package.json
(and remove "id").  This is fine, but don't commit the result.
