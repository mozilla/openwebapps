This is a little testing environment where one may build test web
applications and interact with them via the repository.  `run.js` is a
node.js server that starts up one "primary" web server where the html5
repo will be hosted, and one server per subdirectory: Each
subdirectory then contains a different web application that is
interesting for testing for some reason.

`tests.html` then is served from the primary host and may test
various apis, including performing live installation of apps.

## Adding a test

Step #1 - make a directory with an application

Step #2 - add test code to tests.html

## Running tests:

`node run.js` and then open the URL output on stdout in your browser.


