
function empty(o)
{
    for (var i in o) 
        if (o.hasOwnProperty(i))
            return false;
    return true;
}

function getIconForSize(targetSize, minifest)
{
    if (minifest && minifest.icons) {
        var bestFit = 0;
        var biggestFallback = 0;
        for (var z in minifest.icons) {
            var size = parseInt(z, 10);
            if (bestFit == 0 || size >= targetSize) {
                bestFit = size;
            }
            if (biggestFallback == 0 || size > biggestFallback) {
                biggestFallback = size;
            }
        }
        if (bestFit !== 0) return minifest.icons[bestFit];
        if (biggestFallback !== 0) return minifest.icons[biggestFallback];
    }
}

$(document).ready(function() {
    /* IconGrid */
    var appCount = 0;

    var appData = {
        getItemList: function(cb) {
            navigator.mozApps.mgmt.list(function(apps) {
                var list = {};
                appCount = apps.length;
                if (appCount > 0) $("#help").css({display: 'none'});

                for (var i = 0; i < apps.length; i++) {
                    var app = apps[i];
                    list[app.origin] = {
                        itemTitle: app.manifest.name,
                        itemImgURL: app.origin + getIconForSize(48, app.manifest)
                    };
                }
                cb(list);
            });
        },

        openItem: function(itemID) {
          navigator.mozApps.mgmt.launch(itemID);
        },

        //ignore callback, we have the watcher
        userRemovedItem: function(itemID, callback) {
          // this better trigger a call to the update watches, so we can fix the UI
          navigator.mozApps.mgmt.uninstall(itemID);
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
    if (navigator.mozApps.mgmt.watchUpdates) {
        watcherID = navigator.mozApps.mgmt.watchUpdates(function(cmd, itemArray) {
            var i = 0;
            if (cmd == "add") {
                for (i = 0; i < itemArray.length; i++){
                    var app = itemArray[i];

                    var wasAdded = gridDash.addItemToGrid(
                        app.origin, {itemTitle: app.manifest.name, itemImgURL: app.origin + getIconForSize(48, app.manifest)}
                    );

                    if (wasAdded) {
                        appCount++;
                        if (appCount > 0) $("#help").css({display: 'none'});
                    }

                }
            } else if (cmd == "remove") {
                for (i = 0; i < itemArray.length; i++){
                    appCount--;
                    if (appCount == 0) $("#help").css({display: 'block'});

                    var app = itemArray[i];
                    gridDash.removeItemFromGrid(app.origin);
                }
            }
        });
    }

    $(document).unload(function() {
        if (watcherID) {
            navigator.mozApps.mgmt.clearWatch(watcherID);
        }
    });

    if (navigator.mozApps.mgmt.syncButton) {
        var syncButton = navigator.mozApps.mgmt.syncButton();
        syncButton.appendTo('login');
        $(document).click(function () {
          syncButton.makeCompact();
        });
    }

});
