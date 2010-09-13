function search(term, successCallback, errorCallback) {
  var req = XMLHttpRequest();
  req.open("GET", "https://www.greplin.com/ajax/spotlight?format=json&q=" + term, true);
  req.onreadystatechange = function (aEvt) {  
    if (req.readyState == 4) {  
      if (req.status == 200) {
        successCallback(req.responseText);
      } else {
        errorCallback("Request failed (HTTP error code " + req.status + ")");
      }
    }
  };  
  req.send(null);
}

