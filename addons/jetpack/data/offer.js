
// demo panel to offer installing an app from a website
// this is injected into the offer.html panel, see ui.js/OfferPanel

let actions = ["yes", "no", "never"];
for (let i = 0; i < actions.length; i++) { 
   document.getElementById(actions[i]).onclick = 
       (function(i) { return function() { 
           self.port.emit(actions[i]);
       }})(i); 
}

self.port.on("setup", function(data) {
  document.getElementById("store_offer").innerHTML = "";
  document.getElementById("self_published").style.display = "block";
  document.getElementById("store").style.display = "none";
  document.getElementById("store_offer").style.display = "block";
  document.getElementById("store_progress").style.display = "block";
  document.getElementById("login_status").style.display = "none";
});

function renderOffer(offer) {
  var s="";
  if (offer.purchased) {
     s += "You have already purchased this application.  Reinstall now?";
  }  else { 
    s += "Purchase for $" + offer.price + "?";
  }
  document.getElementById("store_offer").innerHTML = s;
  document.getElementById("store_offer").style.display = "block";
  document.getElementById("store_progress").style.display = "none";
  var acct="";
  if (offer.account) {
    acct = "Logged in to " + offer.storeName + " as <i>" + offer.account + "</i>";
  } else {
    acct = "You will be asked to log in to " + offer.storeName + " if you install.";
  }
  document.getElementById("login_status").innerHTML = acct;
  document.getElementById("login_status").style.display = "block";
}

self.port.on("store", function(data) {
  document.getElementById("self_published").style.display="none";
  document.getElementById("store").style.display="block";
  if (data.offer) { renderOffer(data.offer) };
});
