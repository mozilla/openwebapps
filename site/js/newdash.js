console.log("calling apps.list");
navigator.apps.list(function(l) {
    console.log(" list returns: ");
    console.log(l);
});