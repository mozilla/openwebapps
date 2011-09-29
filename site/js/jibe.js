
function empty(o)
{
    for (var i in o) 
        if (o.hasOwnProperty(i))
            return false;
    return true;
}

navigator.mozApps.mgmt.list(function(apps) {
    if (!apps) return;
    
    var board = document.getElementById("dashboard");
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
                
    function makeLaunchFunction(url)
    {
        return function() {
            window.open(url);
        }
    }

    /* IconGrid */
    var appData = {
        getItemList: function(cb) {
            var list = {};
            for (var i = 0; i < apps.length; i++) {
                var app = apps[i];
                list[app.origin] = {
                    itemTitle: app.manifest.name,
                    itemImgURL: origin + getIconForSize(48, app.manifest)
                };
            }
            cb(list);
        },
        openItem: function(itemID) {
            var url = itemID;
            var app = apps[itemID];
            if ('launch_path' in app.manifest) {
                url += app.manifest.launch_path;
            }
            window.open(url);
        }
    };
                
    var grid = $("#apps");
    document.getElementById("dashboard").style.display = "block";
    var gridLayout = new GridLayout(grid.width(), grid.height(), 4, 2);
    var gridDash = new IconGrid("appDashboard", grid, appData, gridLayout);

    gridDash.initialize();
    gridDash.refresh();
});
