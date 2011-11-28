# Sync

This holds the client code for application sync.  Some integration
code exists in `addons/jetpack/` and `site/jsapi/sync*`.


## Tests

The tests are [doctests](http://ianb.github.com/doctestjs), and are
located in `sync/tests/`.  These are not directly runnable, you should
use the appsync server.

Once you are running the server, go to `http://localhost:5000/sync/tests/


## Server

To make use of sync you also really need the server:
[appsync](https://github.com/mozilla/appsync)

There are instructions on that page to run the server.  Note you
should probably edit `etc/appsync-dev.ini` and uncomment the
appropriate lines in `[storage]` to use MySQL or SQLite (SQLite being
the simplest).

The server is also needed to run the tests.


## Questions?

Ask `ianbicking` on IRC/irc.mozilla.org (`#openwebapps`).
