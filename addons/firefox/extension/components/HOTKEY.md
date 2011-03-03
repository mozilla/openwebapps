## Hotkey support for Windows

This directory contains a binary component that adds support for propagating
special keyboard events to web applications. Currently, this only works on
Windows (Mac support is a little complicated). The binary component, when
enabled, will dispatch a DOM MessageEvent that corresponds to a key-press.
The events are captured globally, and thus Firefox need not be active for
the dispatch to occur, though it must be running.

Since existing web applications do not know of this functionality, you will
need to execute some JS on pages in order to take advantage of them.

For example, on the rdio web page, you can use the Error Console in Firefox 4
or Firebug to execute this JS snippet:

    document.addEventListener("MozHotKey", function(e) { document.getElementById(e.data + "Button").click(); }, false);

Pressing any of the media keys (currently "play", "pause", "next" and
"previous") will simulate a click on their DOM media control buttons, so
you can control your music!

