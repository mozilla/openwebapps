var manifest = {
    "name": "TweetSup?",
    "app": {
        "urls": [
            "https://tweetsup.mozillalabs.com"
        ],
        "launch": {
            "web_url": "https://tweetsup.mozillalabs.com"
        }
    },
    "icons": {
        "48": "https://tweetsup.mozillalabs.com/icon.png"
    },
    "description": "Perform searches across your twitter friends timelines and receive notifications from inside your application dashboard",
    "developerName": "Mozilla Labs",
    "auth": "https://tweetsup.mozillalabs.com/auth",
    "conduit": "https://tweetsup.mozillalabs.com/conduit",
    "supportedAPIs": [
        "search",
        "search"
    ]
};

$(document).ready(function() {
    var sto = window.localStorage;
    for (var i = 0; i < sto.length; i++) {
        var key = sto.key(i);
        $("#output").append($('<div/>').text(key + ": " + sto.getItem(key)));
    }

    var updateButton = function() {
        // make a button for application installation:
        $('#install_prompt').empty().append($('<button>You Gots The App.</button>').button({ disabled: true }));

        AppClient.getInstalled({
            callback: function(v) {
                if (v.installed.length == 0) {
                    $('#install_prompt').empty().append($('<button>Install The App!</button>').button());
                    $('#install_prompt button').click(function() {
                        AppClient.install({
                            manifest: manifest,
                            callback: function(v) {
                                updateButton();
                            }
                        });
                    });
                }
            }
        });
    };
    updateButton();


    // got auth?
    if (typeof sto.getItem("oauth_token")  === 'string' &&
        typeof sto.getItem("oauth_secret")  === 'string')
    {
/*
    $.getJSON('query.php?token=' + sto.getItem('oauth_token') + "&secret=" + sto.getItem('oauth_secret')
              + "&path=statuses/friends_timeline.json",
              function(data) {
                  console.log(data);
              });
*/
    }
    else
    {
        var foo;
        $("<div>You must <a href='auth'>authenticate</a>, that is, tell twitter that it's ok for us to " +
          " access your tweet stream on your behalf.</div>").dialog({
            modal: true,
            draggable: false,
            title: "Login Required!",
        });
    }


});

