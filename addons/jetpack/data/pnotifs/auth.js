function userChoice(authed) {
 self.postMessage({
     authDecision: authed,
     hostname: window.location.host
 }); 
}

function init() {
 document.getElementById('yesButton').addEventListener('click', function(e) { userChoice(true); },false);
 document.getElementById('noButton').addEventListener('click', function(e) { userChoice(false); },false);
}
init();