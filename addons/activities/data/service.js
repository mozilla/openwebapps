/* -*- Mode: JavaScript; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
var gServiceList;

function S4() {
   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
function guid() {
   return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

function renderRequestExplanation(activity) {
  $("#requestInfo").empty();

  var tmplName = activity.action.replace('.', '_');
  var actionTmpl = $("#" + tmplName);
  if (!actionTmpl || !actionTmpl[0]) actionTmpl = $("#defaultAction");

  var data = {
    activity: activity
  }
  if (activity.action == "image.send") {
    data.action = "Send Image to:";
    data.dimensions = "640px x 960px"; // fake
    data.size = "96 KB"; //fake
    if (activity.data.mimeType && activity.data.data) {
      data.src = "data:" + activity.data.mimeType + ";base64," + activity.data.data;
    } else if (activity.data.data) {
      data.src = "data:;base64," + activity.data.data;
    }
  } else if (activity.action == "image.get") {
    data.action = "Get Image from:";
  } else if (activity.action == "profile.get") {
    data.action = "Load Profile from:";
  }

  actionTmpl.tmpl(data).appendTo("#requestInfo");
}

function handleSetup(action, serviceList) {
  gServiceList = serviceList;


  addServicesService.url = "http://localhost:8420/" + action + ".html";
  addServicesService.iframe = document.createElement('iframe');
  addServicesService.iframe.setAttribute('id', guid());
  addServicesService.iframe.src = addServicesService.url;
  var services = serviceList.concat(addServicesService);

  $("#serviceTabs").tmpl({
    'services': services
  }).appendTo("#servicebox");
  // insert the service iframes now
  for (var i = 0; i < services.length; i++) {
    var svc = services[i];
    svc.iframe.classList.add("serviceFrame");
    $('div[id="svc-tab-'+i+'"]').append(svc.iframe);
  }
  // setup tab controls
  tabs();

}

function tabs() {
  $(".tab_content").hide(); //Hide all content
  $("ul.tabs li:first").addClass("active").show(); //Activate first tab
  $(".tab_content:first").show(); //Show first tab content

  //On Click Event
  $("ul.tabs li").click(function() {

      $("ul.tabs li").removeClass("active"); //Remove any "active" class
      $(this).addClass("active"); //Add "active" class to selected tab
      $(".tab_content").hide(); //Hide all tab content

      var activeTab = $(this).find("a").attr("href"); //Find the href attribute value to identify the active tab + content
      $(activeTab).fadeIn(); //Fade in the active ID content
      return false;
  });  
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
  var port = window.navigator.mozActivities.mediation.port;
  var selected = $("#services").tabs('option', 'selected'); // => 0
  var service = gServiceList[selected].call("confirm", {}, function(status) {
    var messageData = {
      app: iframe.contentWindow.location.href,
      result: "ok"
    };
    port.emit("result", messageData);
  }, function(err) {
    port.emit("error", err);
  });
}

$(function() {
  document.getElementById("confirmclicker").onclick = confirm;
});


function startActivity(activity) {
  renderRequestExplanation(activity);
}

function configureServices(activity, services) {
  $("#services").remove(); // this will remove old iframes from DOM
  handleSetup(activity.action, services);
  for (var i = 0; i < gServiceList.length; i++) {
    var service = gServiceList[i];
    service.on("ready", function() {
      console.log("service", service.url, "is ready - initializing it");
      service.call("init", activity.data, function() {
        console.log("service init complete");
      })
    });
  }
}

window.navigator.mozActivities.mediation.ready(configureServices, startActivity);
