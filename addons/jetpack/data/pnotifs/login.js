function init() {
	document.getElementById('loginButton').addEventListener('click', function(e) { 
	    self.postMessage({
	        username: document.getElementById('notifUsername').value,
	        password: document.getElementById('notifPassword').value
	    });
	},false);
}
init();