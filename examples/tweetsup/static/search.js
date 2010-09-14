;Search = (function() {
  var searches = { };
  var searchId = 1000;
  var sto = window.localStorage;

  function cancelSearch(id) {
    if (searches[id]) {
      // cancel outstanding queries
      while (searches[id].queries.length) {
	var q = searches[id].queries.pop();
	q.abort();
      }
      delete searches[id];
      return true;
    }
    return false;
  }

  function queryComplete(searchId, query) {

  }

  return {
    run: function(term, cb) {
      term = term.toLowerCase();
      var obj = {
	id: searchId++,
	queries: [ ],
	term: term,
	// items returned so we don't return duplicates
	returned: { }
      };
      function returnTweet(t) {
	if (!obj.returned[t.id]) {
	  obj.returned[t.id] = true;
	  cb(t);
	}
      }

      var url = 'query.php?token=' + sto.getItem('oauth_token') + "&secret=" + sto.getItem('oauth_secret')
	+ "&path=statuses/friends_timeline.json&count=200&include_rts=true";
      var friends = $.getJSON(url, function(data) {
	for (var i in data) {
	  var srchContent = (data[i].user.screen_name + data[i].text).toLowerCase();
	  if (srchContent.indexOf(term) >= 0) {
	    returnTweet(data[i]);
	  }
	}
	queryComplete(obj.id, friends);
      });
      obj.queries.push(friends);

      var url = 'query.php?token=' + sto.getItem('oauth_token') + "&secret=" + sto.getItem('oauth_secret')
	+ "&path=statuses/mentions.json&count=50";
      var mentions = $.getJSON(url, function(data) {
	for (var i in data) {
	  var srchContent = (data[i].user.screen_name + data[i].text).toLowerCase();
	  if (srchContent.indexOf(term) >= 0) {
	    returnTweet(data[i]);
	  }
	}
	queryComplete(obj.id, mentions);
      });
      obj.queries.push(mentions);

      searches[obj.id] = obj;
      return obj.id;
    },
    cancel: function(id) {
      return cancelSearch(id);
    }
  };
})();

