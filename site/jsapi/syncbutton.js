var gContainerSource = null;

window.addEventListener('storage', function (event) {
  if (event.key !== 'syncbutton-comm') {
    return;
  }
  var value = JSON.parse(event.newValue);
  updateStatus(value);
}, false);

function updateStatus(value) {
  if (value.logout) {
    setUsername('');
    setStatus('');
    makeLogout();
  }
  if (value.username) {
    setUsername(value.username);
    makeCompactLayout();
    var username = document.getElementById('username');
    username.innerHTML = value.username;
  }
  if (value.status) {
    setStatus(value.status);
    var statusMessage = document.getElementById('status');
    statusMessage.innerHTL = value.status;
  }
}

function setUsername(username) {
  document.getElementById('syncbutton-expander').setAttribute('title', username);
  document.getElementById('username').innerHTML = username;
}

function setStatus(status) {
  var expander = document.getElementById('syncbutton-expander');
  if (status) {
    expander.className = 'with-status';
  } else {
    expander.className = '';
  }
  document.getElementById('status').innerHTML = status;
}

window.addEventListener('load', function () {
  var prevValue = localStorage.getItem('syncbutton-comm');
  if (prevValue) {
    prevValue = JSON.parse(prevValue);
    updateStatus(prevValue);
  }
  var login = document.getElementById('login');
  login.addEventListener('click', function () {
    // FIXME: maybe switch to the grey icon?
    navigator.id.getVerifiedEmail(function (assertion) {
      if (! assertion) {
        // FIXME: report error
        return;
      }
      localStorage.setItem('syncbutton-assertion', assertion);
    });
  }, false);
  var logout = document.getElementById('logout');
  logout.addEventListener('click', function () {
    console.log('syncbutton.js logging out');
    if (localStorage.getItem('syncbutton-assertion') == 'logout') {
      localStorage.setItem('syncbutton-assertion', '');
    } else {
      localStorage.setItem('syncbutton-assertion', 'logout');
    }
  }, false);
  var expander = document.getElementById('syncbutton-expander');
  expander.addEventListener('click', function () {
    makeExpanded();
  }, false);
  var compacter = document.getElementById('syncbutton-compacter');
  compacter.addEventListener('click', function () {
    makeCompact();
  }, false);
}, false);

function parseQueryString(s) {
  var params = {};
  s = s.split('&');
  for (var i=0; i<s.length; i++) {
    if (s[i].indexOf('=') == -1) {
      var name = decodeURIComponent(s[i]);
      var value = null;
    } else {
      var name = decodeURIComponent(s[i].substr(0, s[i].indexOf('=')));
      var value = decodeURIComponent(s[i].substr(s[i].indexOf('=')+1));
    }
    if (name in params) {
      if (params[name] === null || typeof params[name] == 'string') {
        params[name] = [params[name], value];
      } else {
        params[name].push(value);
      }
    } else {
      params[name] = value;
    }
  }
  return params;
}

var iconsByColor = {
  red: 'https://browserid.org/i/sign_in_red.png',
  blue: 'https://browserid.org/i/sign_in_blue.png',
  orange: 'https://browserid.org/i/sign_in_orange.png',
  green: 'https://browserid.org/i/sign_in_green.png',
  grey: 'https://browserid.org/i/sign_in_grey.png'
};

function getLoginIcon(color) {
  color = (color || '').toLowerCase();
  return iconsByColor[color] || iconsByColor['blue'];
}

var params = {};
if (location.hash) {
  params = parseQueryString(location.hash.substr(1));
}

if (params.buttonColor) {
  // FIXME: technically this element might not be available at this time:
  document.getElementById('login-image').src = getLoginIcon(params.buttonColor);
}

if (params.foregroundColor) {
  document.body.style.color = params.foregroundColor;
}

if (params.backgroundColor) {
  // FIXME: check that it's a color, not url(javascript:) or something
  document.body.style.backgroundColor = params.backgroundColor;
}

window.addEventListener("message", function (event) {
  var message = event.data;
  if (message == "hello") {
    gContainerSource = event.source;
    return;
  }
  message = JSON.parse(message);
  if (message.size == "compact") {
    makeCompactLayout();
  }
}, false);

function makeCompact() {
  sendSize('compact');
  makeCompactLayout();
}

function makeCompactLayout() {
  document.getElementById('syncbutton-expanded').style.display = 'none';
  document.getElementById('syncbutton-compact').style.display = '';
  document.getElementById('syncbutton-login').style.display = 'none';
}

function makeExpanded() {
  sendSize('expanded');
  makeExpandedLayout();
}

function makeExpandedLayout() {
  document.getElementById('syncbutton-expanded').style.display = '';
  document.getElementById('syncbutton-compact').style.display = 'none';
  document.getElementById('syncbutton-login').style.display = 'none';
}

function makeLogout() {
  sendSize('compact');
  makeLogoutLayout();
}

function makeLogoutLayout() {
  document.getElementById('syncbutton-expanded').style.display = 'none';
  document.getElementById('syncbutton-compact').style.display = 'none';
  document.getElementById('syncbutton-login').style.display = '';
}

function sendSize(size) {
  if (gContainerSource) {
    gContainerSource.postMessage(JSON.stringify({size: size}), '*');
  }
}
