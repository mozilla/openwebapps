//@line 37 "/builds/slave/rel-m-rel-xr-osx64-bld/build/toolkit/content/macWindowMenu.js"

function macWindowMenuDidShow()
{
  var windowManagerDS =
    Components.classes['@mozilla.org/rdf/datasource;1?name=window-mediator']
              .getService(Components.interfaces.nsIWindowDataSource);
  var sep = document.getElementById("sep-window-list");
  // Using double parens to avoid warning
  while ((sep = sep.nextSibling)) {
    var url = sep.getAttribute('id');
    var win = windowManagerDS.getWindowForResource(url);
    if (win.document.documentElement.getAttribute("inwindowmenu") == "false")
      sep.hidden = true;
    else if (win == window)
      sep.setAttribute("checked", "true");
  }
}

function toOpenWindow( aWindow )
{
  // deminiaturize the window, if it's in the Dock
  if (aWindow.windowState == STATE_MINIMIZED)
    aWindow.restore();
  aWindow.document.commandDispatcher.focusedWindow.focus();
}

function ShowWindowFromResource( node )
{
  var windowManagerDS =
    Components.classes['@mozilla.org/rdf/datasource;1?name=window-mediator']
              .getService(Components.interfaces.nsIWindowDataSource);

  var desiredWindow = null;
  var url = node.getAttribute('id');
  desiredWindow = windowManagerDS.getWindowForResource( url );
  if (desiredWindow)
    toOpenWindow(desiredWindow);
}

function zoomWindow()
{
  if (window.windowState == STATE_NORMAL)
    window.maximize();
  else
    window.restore();
}
