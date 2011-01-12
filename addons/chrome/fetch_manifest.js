function FetchManifest(url, cb) {
    // contact our server to retrieve the URL
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function(aEvt) {
        if (xhr.readyState == 4) {
            if (xhr.status == 200) {
                cb(xhr.responseText);
            } else {
                cb(null);
            }
        }
    }
    xhr.send(null);
}
