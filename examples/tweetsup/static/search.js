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
      var obj = {
	id: searchId++,
	queries: [ ],
	term: term
      };

      var q;
      var url = 'query.php?token=' + sto.getItem('oauth_token') + "&secret=" + sto.getItem('oauth_secret')
	+ "&path=statuses/friends_timeline.json&count=200&include_rts=true";
      q = $.getJSON(url, function(data) {
	for (var i in data) {
	  var srchContent = (data[i].user.screen_name + data[i].text).toLowerCase();
	  if (srchContent.indexOf(term.toLowerCase()) >= 0) {
	    cb(data[i]);
	  }
	}
	queryComplete(obj.id, q);
      });

      obj.queries.push(q);
      searches[obj.id] = obj;
      return obj.id;
    },
    cancel: function(id) {
      return cancelSearch(id);
    }
  };
})();

