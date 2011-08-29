/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
var gServiceList;

function renderRequestExplanation(requestMethod, args) {
  $("#requestInfo").empty();

  var tmplName = requestMethod.replace('.', '_');
  var actionTmpl = $("#" + tmplName);
  if (!actionTmpl) actionTmpl = $("#defaultAction");

  var data = {
    action: requestMethod,
    requestMethod: requestMethod,
    args: args
  }

  if (requestMethod == "image.send") {
    data.action = "Send Image to:";
    data.dimensions = "640px x 960px"; // fake
    data.size = "96 KB"; //fake
    if (args.mimeType && args.data) {
      data.src = "data:" + args.mimeType + ";base64," + args.data;
    } else if (args.data) {
      data.src = "data:;base64," + args.data;
    }
  } else if (requestMethod == "image.get") {
    data.action = "Get Image from:";
  } else if (requestMethod == "profile.get") {
    data.action = "Load Profile from:";
  }

  actionTmpl.tmpl(data).appendTo("#requestInfo");
}

function handleSetup(method, args, serviceList) {
  gServiceList = serviceList;

  renderRequestExplanation(method, args);

  addServicesService.url = "http://localhost:8420/" + method + ".html";
  var services = serviceList.concat(addServicesService);
  $("#serviceTabs").tmpl({
    'services': services
  }).appendTo("#servicebox");
  $("#services").tabs();
}

var addServicesService = new Service({
  app: {
    manifest: {
      name: "Add service",
      icons: {
        "48": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAACK0lEQVRoge2YsW4TURBF7x1vbGECVmSkdChVZEX8AxUFdHaXr0CUfAEl4ivSOR0UVPwDiqJUEV0koshgguzszqWwjKLgdXajCWDlnfY9zbyrmXl33wKJRCKRSKwwvI2g/WGvm9nkUSP3NgAUmZ3n3vq6Pzg8jc4VLmB3uPU09+IZhCdG6wCAy0cgPmfW+Lg3OP4UmS9UQH/Y62b+4xXAlyTXL69JGgN6l9v9t5GVsKhAAJDZ+SaFnauHBwCS6xR2MjvfDM0ZGayRsyVyQyXrpG1YjlZkzlABhctgaLKkMx1qwmOrHhrsXxAqoEHPCJbGJGgNemjVQwUIax0Qfwzwb4h1Ya0TmTNMQH/Y6zp9W9JW2R5JW07f7g973ai8tXzgssMWLgNmbeO0BwJ7AF6QeL4shoQPAN4TOjT590KWA0DD6Ddx7MoCrjqsQ81ZABqAh4IeL7r/F4vQmOAXAN8EOQAYOL2JY1cSsMxho6nr2JVmYJnDRlPXsStdadc5bDR1HPtuGFmRaSL52W0fZo7kZ0WmSZW9lQTk3j4RcTAbsNtF0ljEQe7tkyr778Y1Omeljew6Zl7xcxfQm7JKzFqQr3O7txf1Kgu7hfYHh6cmOyJ5XLaH5LHJjv7bJyVxMYJQPujCmLgYReYMFVDI8vlQLkKQz3s+ipU3sthHvdEFTMs+OQyc0lBaoZsQ20LXOHYdh61KqIBljl3XYauSfi0u4m/+3E0kEolEYqX5BYEtYEDC2SOXAAAAAElFTkSuQmCC"
      }
    }
  }
});

function confirm() {
  var emit = window.navigator.apps.mediation.emit;
  var selected = $("#services").tabs('option', 'selected'); // => 0
  var service = gServiceList[selected].call("confirm", {}, function(status) {
    var messageData = {
      app: iframe.contentWindow.location.href,
      result: "ok"
    };
    emit("result", messageData);
  }, function(err) {
    emit("error", err);
  });
}

$(function() {
  document.getElementById("confirmclicker").onclick = confirm;
});

window.navigator.apps.mediation.ready(

function(method, args, services) {
  $("#services").remove(); // this will remove old iframes from DOM
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
});
