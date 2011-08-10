var gServiceList;

function renderRequestExplanation(requestMethod, arguments)
{
    $("#requestInfo").empty();

    if (requestMethod == "image.send") {
        var box = $("<div/>");
        var preview = $("<img style='margin:auto;border-left:2px solid #fafafa;border-top:2px solid #fafafa;border-right:2px solid #ddd;border-bottom:2px solid #ddd;max-width:96px;max-height:96px;display:inline-block'/>").appendTo(box);

        if (arguments.mimeType && arguments.data) {
            preview.attr("src", "data:"+ arguments.mimeType  +";base64," + arguments.data);
        } else if (arguments.data) {
            preview.attr("src", "data:;base64," + arguments.data);
        }

        var previewText = $("<div style='display:inline-block;vertical-align:top;margin-left:8px'>")
        .appendTo(box);
        var previewTitle = $("<div style='font-weight:bold;font-size:0.9em'/>")
        .appendTo(previewText);
    
        if (arguments.title) previewTitle.text(arguments.title);
        var previewDimensions = $("<div style='font-size:0.7em;color:#888'>")
        .appendTo(previewText);;
    
        /*if (arguments.size) */previewDimensions.text("640px x 960px"); // fake
        var previewSize = $("<div style='font-size:0.7em;color:#888'>")
        .appendTo(previewText);;
        /*if (arguments.size) */previewSize.text("96 KB"); // fake

        var action = $("<div style='margin-top:10px;margin-bottom:6px;font-weight:bold;font-size:1.1em'>").text("Send Image to:");
        $("#requestInfo").append(box);
        $("#requestInfo").append(action);
    } else if (requestMethod == "image.get") {
        var action = $("<div style='margin-top:10px;font-weight:bold;font-size:1.1em'>").text("Get Image from:");
        $("#requestInfo").append(action);
    } else if (requestMethod== "profile.get") {
        var action = $("<div style='margin-top:10px;font-weight:bold;font-size:1.1em'>").text("Load Profile from:");
        $("#requestInfo").append(action);  
    } else {
        var action = $("<div style='margin-top:10px;font-weight:bold;font-size:1.1em'>").text(requestMethod);
        $("#requestInfo").append(action);  
    }
}

function handleSetup(method, args, serviceList)
{
    $("#requestDescription").empty().
        append($("<div>Some page is asking for something from you.  Perhaps we could provide some more details about what is being requested here.</div>")).
        append($("<div>Method name: " + method + "</div>")).
        append($("<div>Arguments: " + args + "</div>"));
    
    gServiceList = serviceList;

    renderRequestExplanation(method, arguments);
    $("#servicebox").append($("<div id='services'></div>"));
    $("#services").append($("<ul id='services-tabs'></ul>"));

    function createServiceTab(svc) {
        var svcTab = document.createElement("li");
        var svcTabLink = document.createElement("a");
        svcTabLink.setAttribute("href", "#svc-tab-" + i);
        var svcTabImg = document.createElement("img");

        var icon = svc.getIconForSize(48);
        svcTabImg.setAttribute("src", icon);
        svcTabImg.setAttribute("style", "width:48px;height:48px;vertical-align:middle");
        svcTabLink.appendChild(svcTabImg);

        var svcTextDiv = document.createElement("div");
        svcTextDiv.appendChild(document.createTextNode(svc.app.manifest.name));
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
        svc.iframe.classList.add("serviceFrame");
        svc.iframe.setAttribute("id", "svc-frame-" + i);
        svcDiv.appendChild(svc.iframe);

/***
        // testing code:
        if (this.location.href.indexOf("file:///") == 0) {
            var anIframe = document.createElement("iframe");
            anIframe.src = svc.url;
            anIframe.classList.add("serviceFrame");
            svcDiv.appendChild(anIframe);
        }
***/
    }

    // and then the "add services" tab
    svcDiv = createServiceTab(addServicesService);
    var serviceFinder = document.createElement("iframe");
    serviceFinder.src = "http://localhost:8420/" + method + ".html";
    serviceFinder.classList.add("serviceFrame");
    svcDiv.appendChild(serviceFinder);

    $("#services").tabs();
}

var addServicesService = new Service(
{
    app: {
        manifest: {
            name: "Add service",
            icons:{
                "48":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAACK0lEQVRoge2YsW4TURBF7x1vbGECVmSkdChVZEX8AxUFdHaXr0CUfAEl4ivSOR0UVPwDiqJUEV0koshgguzszqWwjKLgdXajCWDlnfY9zbyrmXl33wKJRCKRSKwwvI2g/WGvm9nkUSP3NgAUmZ3n3vq6Pzg8jc4VLmB3uPU09+IZhCdG6wCAy0cgPmfW+Lg3OP4UmS9UQH/Y62b+4xXAlyTXL69JGgN6l9v9t5GVsKhAAJDZ+SaFnauHBwCS6xR2MjvfDM0ZGayRsyVyQyXrpG1YjlZkzlABhctgaLKkMx1qwmOrHhrsXxAqoEHPCJbGJGgNemjVQwUIax0Qfwzwb4h1Ya0TmTNMQH/Y6zp9W9JW2R5JW07f7g973ai8tXzgssMWLgNmbeO0BwJ7AF6QeL4shoQPAN4TOjT590KWA0DD6Ddx7MoCrjqsQ81ZABqAh4IeL7r/F4vQmOAXAN8EOQAYOL2JY1cSsMxho6nr2JVmYJnDRlPXsStdadc5bDR1HPtuGFmRaSL52W0fZo7kZ0WmSZW9lQTk3j4RcTAbsNtF0ljEQe7tkyr778Y1Omeljew6Zl7xcxfQm7JKzFqQr3O7txf1Kgu7hfYHh6cmOyJ5XLaH5LHJjv7bJyVxMYJQPujCmLgYReYMFVDI8vlQLkKQz3s+ipU3sthHvdEFTMs+OQyc0lBaoZsQ20LXOHYdh61KqIBljl3XYauSfi0u4m/+3E0kEolEYqX5BYEtYEDC2SOXAAAAAElFTkSuQmCC"
            }
        }
    }
});

function confirm()
{
    var emit = window.navigator.apps.mediation.emit;
    var selected = $("#services").tabs('option', 'selected'); // => 0
    var service = gServiceList[selected].call("confirm", {},
        function(status) {
            var messageData = {
                app:iframe.contentWindow.location.href,
                result:"ok"
            };
            emit("result", messageData);
        },
        function(err) {
            emit("error", err);
        }
    );
}

$(function() {
    document.getElementById("confirmclicker").onclick = confirm;
});

window.navigator.apps.mediation.ready(
    function(method, args, services) {
        $("#services").remove();// this will remove old iframes from DOM
        for (var i = 0; i < services.length; i++) {
            var service = services[i];
            service.on("ready", function() {
                console.log("service", service.url, "is ready - initializing it");
                service.call("init", args, function() {
                    console.log("service init complete");
               })
            });
        }
        handleSetup(method, args, services);
    }
);
