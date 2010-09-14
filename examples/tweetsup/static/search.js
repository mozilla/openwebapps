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
      function searchTweet(t, term) {
	var user = (t.user ? t.user : t.sender);
	var srchContent = (user.name + user.screen_name + t.text).toLowerCase();
	return (srchContent.indexOf(term) >= 0);
      }

      var url = 'query.php?token=' + sto.getItem('oauth_token') + "&secret=" + sto.getItem('oauth_secret')
	+ "&path=statuses/friends_timeline.json&count=200&include_rts=true";
      var friends = $.getJSON(url, function(data) {
	for (var i in data) {
	  if (searchTweet(data[i], term)) returnTweet(data[i]);
	}
	queryComplete(obj.id, friends);
      });
      obj.queries.push(friends);

      var url = 'query.php?token=' + sto.getItem('oauth_token') + "&secret=" + sto.getItem('oauth_secret')
	+ "&path=statuses/mentions.json&count=50";
      var mentions = $.getJSON(url, function(data) {
	for (var i in data) {
	  if (searchTweet(data[i], term)) returnTweet(data[i]);
	}
	queryComplete(obj.id, mentions);
      });
      obj.queries.push(mentions);

      var url = 'query.php?token=' + sto.getItem('oauth_token') + "&secret=" + sto.getItem('oauth_secret')
	+ "&path=direct_messages.json&count=100";
      var directs = $.getJSON(url, function(data) {
	for (var i in data) {
	  if (searchTweet(data[i], term)) returnTweet(data[i]);
	}
	queryComplete(obj.id, directs);
      });
      obj.queries.push(directs);

      searches[obj.id] = obj;
      return obj.id;
    },
    cancel: function(id) {
      return cancelSearch(id);
    }
  };
})();

