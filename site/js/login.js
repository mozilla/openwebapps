var SYNC = 'https://sync.myapps.mozillalabs.com';

var syncServer = null;

$(function () {

  // FIXME: should actually be a .submit event:
  $('#register').click(function () {
    var email = $('input[name=email]').val();
    var username = emailToUsername(email);
    var password = $('input[name=password]').val();
    $.ajax({
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
              returnToRedirect();
            },
            error: function (req) {
              if (req.status == 400 && req.responseText == '9') {
                alert('Password not strong enough');
              } else if (req.status == 400 && req.responseText == '2') {
                alert('Bad CAPTCHA response');
              } else {
                console.log('bad request', req);
              }
            }
          });
        } else {
          alert('The account with the email ' + email + ' has been taken');
        }
      }
    });
  });

  $('#login').click(function () {
    var email = $('input[name=email]').val();
    var password = $('input[name=password]').val();
    var username = emailToUsername(email);
    $.ajax({
      url: SYNC + '/user/1.0/' + encodeURIComponent(username) + '/node/weave',
      dataType: 'text',
      // FIXME: apparently this isn't required, but somehow does change
      // parts of the response (mostly absolute URL to relative):
      //beforeSend: addUserPassword(username, password),

      success: function (response) {
        var url = response + '1.0/' + encodeURIComponent(username)
          + '/info/collections';
        $.ajax({
          url: url,
          dataType: 'json',
          beforeSend: addUserPassword(username, password),
          success: function (collectionInfo) {
            // FIXME: there's a bunch of weird things that can get through
            // here related to cross-origin, that are failures but don't look
            // it.
            var data = {
              email: email,
              username: username,
              password: password,
              node: response
            };
            localStorage.setItem('syncInfo', JSON.stringify(data));
            returnToRedirect();
          },
          error: function (req, reason, err) {
            console.log('bad request', req);
            if (req.status == 401) {
              alert('Bad password');
            }
          }
        });
      },

      error: function (req, reason, err) {
        console.log('bad request', req, reason, err);
        alert('bad request');
      }
    });
  });

  if (location.search.search(/logout/) != -1) {
    localStorage.removeItem('syncInfo');
    returnToRedirect();
  }

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

