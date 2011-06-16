var gServiceList;
var gServiceChannels = [];
var gRequestMethod;
var gArguments;

// Get the closest icon that is equal to or larger than the requested size,
// or the biggest icon below that if needed.
function getIconForSize(minifest, targetSize) {
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
    return "default_app.png";
}

function deleteOldChannels() {
    for (var i=0;i<gServiceChannels.length;i++) {
        gServiceChannels[i].destroy();
    }
    gServiceChannels = [];
    $("#services").remove();// this will remove iframes from DOM
}

function renderRequestExplanation()
{
    $("#requestInfo").empty();

    if (gRequestMethod == "image.send") {
        var box = $("<div/>");
        var preview = $("<img style='margin:auto;border-left:2px solid #fafafa;border-top:2px solid #fafafa;border-right:2px solid #ddd;border-bottom:2px solid #ddd;max-width:96px;max-height:96px;display:inline-block'/>").appendTo(box);

        if (gArguments.mimeType && gArguments.data) {
            preview.attr("src", "data:"+ gArguments.mimeType  +";base64," + gArguments.data);
        } else if (gArguments.data) {
            preview.attr("src", "data:;base64," + gArguments.data);    
        }

        var previewText = $("<div style='display:inline-block;vertical-align:top;margin-left:8px'>")
        .appendTo(box);
        var previewTitle = $("<div style='font-weight:bold;font-size:0.9em'/>")
        .appendTo(previewText);
    
        if (gArguments.title) previewTitle.text(gArguments.title);
        var previewDimensions = $("<div style='font-size:0.7em;color:#888'>")
        .appendTo(previewText);;
    
        /*if (gArguments.size) */previewDimensions.text("640px x 960px"); // fake
        var previewSize = $("<div style='font-size:0.7em;color:#888'>")
        .appendTo(previewText);;
        /*if (gArguments.size) */previewSize.text("96 KB"); // fake

        var action = $("<div style='margin-top:10px;margin-bottom:6px;font-weight:bold;font-size:1.1em'>").text("Send Image to:");
        $("#requestInfo").append(box);
        $("#requestInfo").append(action);
    } else if (gRequestMethod == "image.get") {
        var action = $("<div style='margin-top:10px;font-weight:bold;font-size:1.1em'>").text("Get Image from:");
        $("#requestInfo").append(action);
    } else if (gRequestMethod== "profile.get") {
        var action = $("<div style='margin-top:10px;font-weight:bold;font-size:1.1em'>").text("Load Profile from:");
        $("#requestInfo").append(action);  
    } else {
        var action = $("<div style='margin-top:10px;font-weight:bold;font-size:1.1em'>").text(gRequestMethod);
        $("#requestInfo").append(action);  
    }
}

function handleSetup(cmdRequest)
{
    deleteOldChannels();

    $("#requestDescription").empty().
    append($("<div>Some page is asking for something from you.  Perhaps we could provide some more details about what is being requested here.</div>")).
    append($("<div>Method name: " + cmdRequest.method + "</div>")).
    append($("<div>Arguments: " + cmdRequest.args + "</div>"));

    gServiceList = cmdRequest.serviceList;
    gRequestMethod = cmdRequest.method;
    gArguments = cmdRequest.args;
  
    renderRequestExplanation();
    document.getElementById("requestInfo").innerHTML = "FOOBAR";
    $("#servicebox").append($("<div id='services'></div>"));
    $("#services").append($("<ul id='services-tabs'></ul>"));
  
    function createServiceTab(svc) {
        var svcTab = document.createElement("li");
        var svcTabLink = document.createElement("a");
        svcTabLink.setAttribute("href", "#svc-tab-" + i);
        var svcTabImg = document.createElement("img");
    
        var icon = getIconForSize(svc.manifest, 48);
        if (!(icon.indexOf("data:") == 0)) {
            icon = svc.app + icon;
        }
        svcTabImg.setAttribute("src", icon);
        svcTabImg.setAttribute("style", "width:48px;height:48px;vertical-align:middle");
        svcTabLink.appendChild(svcTabImg);

        var svcTextDiv = document.createElement("div");
        svcTextDiv.appendChild(document.createTextNode(svc.manifest.name));
        svcTextDiv.setAttribute("style", "max-width:76px;vertical-align:middle;text-align:center;display:block;overflow-x:hidden");

        svcTab.setAttribute("style", "text-align:center;max-width:76px;overflow-x:hidden;color:black;font:0.7em 'Lucida Grande',Tahoma,Arial,sans-serif");
        svcTabLink.appendChild(svcTextDiv);

        svcTab.appendChild(svcTabLink);
        svcTab.appendChild(svcTabLink);
        $("#services-tabs").append(svcTab);

        // Create the service div (this is where the content will go)
        var svcDiv = document.createElement("div");
        svcDiv.setAttribute("id", "svc-tab-" + i);
        svcDiv.classList.add("serviceDiv");
        $("#services").append(svcDiv);
        return svcDiv;
    }
  
    for (var i = 0; i < gServiceList.length; i++) {
        var svc = gServiceList[i];
        var svcDiv = createServiceTab(svc);
        
        var anIframe = document.createElement("iframe");
        anIframe.src = svc.url;
        anIframe.classList.add("serviceFrame");
        anIframe.setAttribute("id", "svc-frame-" + i);
        svcDiv.appendChild(anIframe);

        // testing code:
        if (this.location.href.indexOf("file:///") == 0) {
            var anIframe = document.createElement("iframe");
            anIframe.src = svc.url;
            anIframe.classList.add("serviceFrame");
            svcDiv.appendChild(anIframe);
        }
    }
  
    // and then the "add services" tab
    svcDiv = createServiceTab(addServicesManifest);
    var serviceFinder = document.createElement("iframe");
    serviceFinder.src = "http://localhost:8420/" + gRequestMethod + ".html";
    serviceFinder.classList.add("serviceFrame");
    svcDiv.appendChild(serviceFinder);
  
    $("#services").tabs();
}

function createChannels(cmdRequest)
{
    // XX we shouldn't be creating all the channels at once
    for (var i = 0; i < gServiceList.length; i++) {
        var svc = gServiceList[i];
        try {
            var anIframe = document.getElementById("svc-frame-" + i);
      
            var chan = Channel.build({
                window: anIframe.contentWindow,
                origin: svc.url,
                scope: "openwebapps_conduit"
            });

            chan.call({
                method: gRequestMethod,
                params: gArguments,
                success: function() {}, /* perhaps record the fact that it worked? */
                error: (function() {return function(error, message) {
                    var messageData = {
                        error: error, msg: message
                    };
                    self.port.emit("error", messageData);
                }}())
            });    
            gServiceChannels.push(chan);
        } catch (e) {
            dump("Warning: unable to create channel to " + svc.url + ": " + e + "\n");
        }
    }
}

var addServicesManifest =
{
    manifest: {
        name: "Add service",
        icons:{
            "48":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAACK0lEQVRoge2YsW4TURBF7x1vbGECVmSkdChVZEX8AxUFdHaXr0CUfAEl4ivSOR0UVPwDiqJUEV0koshgguzszqWwjKLgdXajCWDlnfY9zbyrmXl33wKJRCKRSKwwvI2g/WGvm9nkUSP3NgAUmZ3n3vq6Pzg8jc4VLmB3uPU09+IZhCdG6wCAy0cgPmfW+Lg3OP4UmS9UQH/Y62b+4xXAlyTXL69JGgN6l9v9t5GVsKhAAJDZ+SaFnauHBwCS6xR2MjvfDM0ZGayRsyVyQyXrpG1YjlZkzlABhctgaLKkMx1qwmOrHhrsXxAqoEHPCJbGJGgNemjVQwUIax0Qfwzwb4h1Ya0TmTNMQH/Y6zp9W9JW2R5JW07f7g973ai8tXzgssMWLgNmbeO0BwJ7AF6QeL4shoQPAN4TOjT590KWA0DD6Ddx7MoCrjqsQ81ZABqAh4IeL7r/F4vQmOAXAN8EOQAYOL2JY1cSsMxho6nr2JVmYJnDRlPXsStdadc5bDR1HPtuGFmRaSL52W0fZo7kZ0WmSZW9lQTk3j4RcTAbsNtF0ljEQe7tkyr778Y1Omeljew6Zl7xcxfQm7JKzFqQr3O7txf1Kgu7hfYHh6cmOyJ5XLaH5LHJjv7bJyVxMYJQPujCmLgYReYMFVDI8vlQLkKQz3s+ipU3sthHvdEFTMs+OQyc0lBaoZsQ20LXOHYdh61KqIBljl3XYauSfi0u4m/+3E0kEolEYqX5BYEtYEDC2SOXAAAAAElFTkSuQmCC"
        },
    }
}

function confirm()
{
    var selected = $("#services").tabs('option', 'selected'); // => 0
    gServiceChannels[selected].call({
        method: "confirm",
        success: function(result) {
            var messageData = {
                app:gServiceList[selected].app,
                result:result
            };
            self.port.emit("result", messageData);
        }
    });
}

self.port.on("setup", function(msg) {
    handleSetup(msg);
});
self.port.on("start_channels", function(msg) {
    createChannels(msg);
});
self.port.emit("loaded");

