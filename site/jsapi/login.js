var SYNC = 'https://sync.myapps.mozillalabs.com';

var syncServer = null;

$(function () {

  $('input[name=email]').focus();

  $('#register-form').bind('submit', function () {
    var email = $('input[name=email_register]').val();
    var username = emailToUsername(email);
    var password = $('input[name=password_register]').val();
    getNode({
      url: SYNC + '/user/1.0/' + encodeURIComponent(username),
      dataType: 'text',
      success: function (response) {
        response = parseInt(response);
        if (! response) {
          // All good
          var data = {
            password: password,
            email: email,
            "captcha-challenge": Recaptcha.get_challenge(),
            "captcha-response": Recaptcha.get_response()
          };
          $.ajax({
            url: SYNC + '/user/1.0/' + encodeURIComponent(username),
            data: JSON.stringify(data),
            type: 'PUT',
            dataType: 'text',
            success: function () {
              getNode({
                username: username,
                success: function (node) {
                  saveLogin({
                    email: email,
                    username: username,
                    password: password,
                    node: node
                  });
                  returnToRedirect();
                }
              });
            },
            error: function (req) {
              if (req.status == 400 && req.responseText == '9') {
                showError('Password not strong enough');
              } else if (req.status == 400 && req.responseText == '2') {
                Recaptcha.reload();
                showError('Bad CAPTCHA response');
                // FIXME: should highlight here too
                Recaptcha.focus_response_field();
              } else {
                if (typeof console != 'undefined') {
                  console.log('bad request', req.responseText, req);
                }
              }
            }
          });
        } else {
          showError('The account with the email ' + email + ' has been taken');
        }
      }
    });
    return false;
  });

  $('#login-form').bind('submit', function () {
    var email = $('input[name=email_login]').val();
    var password = $('input[name=password_login]').val();
    var username = emailToUsername(email);
    getNode({
      username: username,
      success: function (node) {
        var url = node + '1.0/' + encodeURIComponent(username)
          + '/info/collections';
        $.ajax({
          url: url,
          dataType: 'json',
          beforeSend: addUserPassword(username, password),
          success: function (collectionInfo) {
            // FIXME: there's a bunch of weird things that can get through
            // here related to cross-origin, that are failures but don't look
            // it.
            saveLogin({
              email: email,
              username: username,
              password: password,
              node: node
            });
            returnToRedirect();
          },
          error: function (req, reason, err) {
            if (typeof console != 'undefined') {
              console.log('bad request', req);
            }
            if (req.status == 401) {
              showError('Incorrect password (or email is incorrect)');
            }
          }
        });
      }
    });
    return false;
  });

  getCaptchaKey(function (key) {
    if (key) {
      Recaptcha.create(key, 'captcha', {theme: 'red'});
    }
  });

});

function getCaptchaKey(callback) {
  $.ajax({
    url: SYNC + "/misc/1.0/captcha_html",
    dataType: 'text',
    success: function (response) {
      var match = /k=([^"]*)/.exec(response);
      if (match) {
        callback(match[1]);
      } else {
        callback(null);
      }
    }
  });
}

function emailToUsername(email) {
  if (email && email.match(/[^A-Z0-9._-]/i)) {
    return encodeBase32(Crypto.SHA1(email.toLowerCase())).toLowerCase();
  } else {
    return email;
  }
}

// Taken from fx-sync, services/sync/modules/util.js
function encodeBase32(bytes) {
    if (typeof bytes == 'string') {
      bytes = Crypto.charenc.UTF8.stringToBytes(bytes);
    }
    var key = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    var quanta = Math.floor(bytes.length / 5);
    var leftover = bytes.length % 5;

    // Pad the last quantum with zeros so the length is a multiple of 5.
    if (leftover) {
      quanta += 1;
      for (var i = leftover; i < 5; i++)
        bytes.push(0);
    }

    // Chop the string into quanta of 5 bytes (40 bits). Each quantum
    // is turned into 8 characters from the 32 character base.
    var ret = "";
    for (var i = 0; i < bytes.length; i += 5) {
      var c = bytes.slice(i, i+5);
      ret += key[c[0] >> 3]
           + key[((c[0] << 2) & 0x1f) | (c[1] >> 6)]
           + key[(c[1] >> 1) & 0x1f]
           + key[((c[1] << 4) & 0x1f) | (c[2] >> 4)]
           + key[((c[2] << 1) & 0x1f) | (c[3] >> 7)]
           + key[(c[3] >> 2) & 0x1f]
           + key[((c[3] << 3) & 0x1f) | (c[4] >> 5)]
           + key[c[4] & 0x1f];
    }

    switch (leftover) {
      case 1:
        return ret.slice(0, -6) + "======";
      case 2:
        return ret.slice(0, -4) + "====";
      case 3:
        return ret.slice(0, -3) + "===";
      case 4:
        return ret.slice(0, -1) + "=";
      default:
        return ret;
    }
}

function addUserPassword(username, password) {
  return function (req) {
    req.setRequestHeader('Authorization',
      'Basic ' + Crypto.util.bytesToBase64(
        Crypto.charenc.UTF8.stringToBytes(username + ':' + password)));
  };
}

function returnToRedirect(defaultUrl) {
  var match = /return_to=([^&=?]*)/.exec(location.search);
  if (match) {
    var url = decodeURIComponent(match[1]);
    location.href = url;
  } else {
    if (defaultUrl) {
      location.href = defaultUrl;
    }
  }
}

function showError(errorMessage) {
  var el = $('#messages');
  el.html('');
  if (typeof errorMessage == 'string') {
    el.text(errorMessage);
  } else {
    el.append(errorMessage);
  }
  el.show();
}

function getNode(options) {
  options.error = options.error || function (req, reason, err) {
    showError('Server error retrieving node');
  };
  $.ajax({
    url: SYNC + '/user/1.0/' + encodeURIComponent(options.username) + '/node/weave',
    dataType: 'text',
    // FIXME: apparently this isn't required, but somehow does change
    // parts of the response (mostly absolute URL to relative):
    //beforeSend: addUserPassword(username, password),
    success: function (node) {
      options.success(node);
    },
    error: options.error
  });
}

function saveLogin(data) {
  localStorage.setItem('syncInfo', JSON.stringify(data));
}
