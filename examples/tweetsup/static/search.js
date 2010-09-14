;Search = (function() {
  var searches = { };
  var searchId = 1000;
  var sto = window.localStorage;

  var queryCache = {
  };

  /* run a query against twitter using a local cache
   * type -- one of 'directs', 'mentions', or 'friends'
   *
   * cb -- a calback to invoke when results are available
   * returns null or a reference to a jquery ajax object when
   *   a call actually results in a http request.
   */
  function searchTwitter(type, cb) {
    var typeToUrlPart = {
      directs: {
	urlpart: 'direct_messages',
	extra: 'count=100'
      },
      mentions: {
	urlpart: 'statuses/mentions',
	extra: 'count=50'
      },
      friends: {
	urlpart: 'statuses/friends_timeline',
	extra: 'count=200&include_rts=true'
      }
    };
    if (!typeToUrlPart[type]) throw("unknown query type: " + type);

    var q = null;

    // can haz cache?
    if (queryCache[type] && (new Date() - queryCache[type].maxAge) <= queryCache[type].stamp) {
//      console.log("returning data for '" + type + "' query from cache, it's only " + ((new Date() - queryCache[type].stamp)/1000.0).toFixed(2) + "s old" +
//		 "(we'll let it live until its " + (queryCache[type].maxAge / 1000).toFixed(0) + "s)");
      setTimeout(function() { cb(queryCache[type].data); }, 0);
    } else {
      delete queryCache[type];
      if (!sto.getItem('oauth_token') || !sto.getItem('oauth_secret')) throw 'E_NEEDS_AUTH';

      var url = 'query.php?token=' + sto.getItem('oauth_token') + "&secret=" + sto.getItem('oauth_secret')
	+ "&path=" + typeToUrlPart[type].urlpart + '.json';
      if (typeToUrlPart[type].extra) url += "&" + typeToUrlPart[type].extra

      q = $.getJSON(url, function(data) {
	// fuzzy cache.  let items live between 1 and two mins.  the fuzz decreases the likelyhood we'll run new queries
        // all at once.
	queryCache[type] = {
	  maxAge: ((60 + Math.floor(Math.random()*61)) * 1000),
	  data: data,
	  stamp: new Date()
	};
	cb(data);
      });
    }
    return q;
  }

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

      var toSearch = [ 'directs', 'mentions', 'friends' ];
      for (var i in toSearch) {
	var searchTag = toSearch[i];
	var q = searchTwitter(searchTag, function(data) {
	  for (var j in data) if (searchTweet(data[j], term)) returnTweet(data[j]);
	});
	if (q) obj.queries.push(q);
      }

      searches[obj.id] = obj;
      return obj.id;
    },
    cancel: function(id) {
      return cancelSearch(id);
    }
  };
})();

