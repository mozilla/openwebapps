
function empty(o)
{
    for (var i in o)
        if (o.hasOwnProperty(i))
            return false;
    return true;
}

var DEFAULT_ICON = "https://apps.mozillalabs.com/i/openbox.png";

function getIconForSize(targetSize, app)
{
    var manifest = app.manifest;
    if (manifest && manifest.icons) {
        var bestFit = 0;
        var biggestFallback = 0;
        for (var z in manifest.icons) {
            var size = parseInt(z, 10);
            if (bestFit == 0 || size >= targetSize) {
                bestFit = size;
            }
            if (biggestFallback == 0 || size > biggestFallback) {
                biggestFallback = size;
            }
        }
        if (bestFit !== 0 || biggestFallback !== 0) {
            var icon = manifest.icons[bestFit || biggestFallback];
            if (icon.substr(0, 5).toLowerCase() != "data:") {
                icon = app.origin + icon;
            }
            return icon;
        }
    }
    return DEFAULT_ICON;
}

$(document).ready(function() {
    /* IconGrid */
    var appCount = 0;

    var appData = {
        itemList: null,
        getItemList: function(cb) {
            function gotApps(apps) {
                var list = {};
                appCount = apps.length;
                if (appCount > 0) $("#help").css({display: 'none'});

                for (var i = 0; i < apps.length; i++) {
                    var app = apps[i];
                    list[app.origin] = {
                        itemTitle: app.manifest.name,
                        itemImgURL: getIconForSize(48, app),
                        appObject: app
                    };
                }
                appData.itemList = list;
                cb(list);
            }
            if (navigator.mozApps.mgmt.list) {
              navigator.mozApps.mgmt.list(gotApps);
            } else {
              var pending = navigator.mozApps.mgmt.getAll();
              pending.onsuccess = function () {
                gotApps(this.result);
              };
              pending.onerror = function () {
                $('#help').hide();
                if (this.error == 'DENIED' || this.error.name == 'DENIED') {
                  // Permission error
                  $('#help-hostname').text(location.protocol + '//' + location.host);
                  $('#help-permissions').show();
                }
              };
            }
        },

        openItem: function(itemID) {
          if (navigator.mozApps.mgmt.launch) {
            navigator.mozApps.mgmt.launch(itemID);
          } else {
            appData.itemList[itemID].appObject.launch();
          }
        },

        //ignore callback, we have the watcher
        userRemovedItem: function(itemID, callback) {
          // this better trigger a call to the update watches, so we can fix the UI
          if (navigator.mozApps.mgmt.uninstall) {
            navigator.mozApps.mgmt.uninstall(itemID);
          } else {
            appData.itemList[itemID].appObject.uninstall();
          }
        }


        // if all your items have 'itemImgURL' and 'itemTitle' properties, then you don't need to implement these.
        // These get called when an item doesn't have the right properties.
        // Note that you can pass in data URIs for icons
        // getItemImgURL: function(itemID) {},
        // getItemTitle: function(itemID) {}
    };

    var grid = $("#apps");
    var gridLayout = new GridLayout(grid.width(), grid.height(), 5, 3);
    var gridDash = new IconGrid("appDashboard", grid, appData, gridLayout);
    gridDash.initialize();
    gridDash.refresh();

    var watcherID;
    function doUpdate(cmd, itemArray) {
      var i = 0;
      if (cmd == "add" || cmd == "install") {
        for (i = 0; i < itemArray.length; i++){
          var app = itemArray[i];

          var wasAdded = gridDash.addItemToGrid(
              app.origin, {itemTitle: app.manifest.name, itemImgURL: getIconForSize(48, app), appObject: app}
              );
          if (wasAdded) {
            appCount++;
            if (appCount > 0) $("#help").css({display: 'none'});
            appData.itemList[app.origin] = {itemTitle: app.manifest.name, itemImgURL: getIconForSize(48, app), appObject: app};
          }

        }
      } else if (cmd == "remove" || cmd == "uninstall") {
        for (i = 0; i < itemArray.length; i++){
          appCount--;
          if (appCount == 0) $("#help").css({display: 'block'});

          var app = itemArray[i];
          gridDash.removeItemFromGrid(app.origin);
        }
      }
    }
    if (navigator.mozApps.mgmt.watchUpdates) {
        watcherID = navigator.mozApps.mgmt.watchUpdates(doUpdate);
    }
    var eventListenerBound = false;
    function eventInstall(ev) {
      doUpdate("install", [ev.application]);
    }
    function eventUninstall(ev) {
      doUpdate("uninstall", [ev.application]);
    }
    if (navigator.mozApps.getInstalled) {
      try {
        navigator.mozApps.mgmt.oninstall = eventInstall;
        navigator.mozApps.mgmt.onuninstall = eventUninstall;
        eventListenerBound = true;
      } catch (e) {
        console.log('Could not bind oninstall and onuninstall events:', e);
      }
    }


    $(document).unload(function() {
        if (watcherID) {
            navigator.mozApps.mgmt.clearWatch(watcherID);
        }
        if (eventListenerBound) {
	  navigator.mozApps.mgmt.oninstall = null;
	  navigator.mozApps.mgmt.onuninstall = null;
        }
    });

});
