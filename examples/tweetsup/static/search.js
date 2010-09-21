;Twitter = (function() {
    var pathToQueryPHP = "";
    try {pathToQueryPHP += QUERY_PHP_PREFIX; } catch(e) { }
    pathToQueryPHP += "query.php";
    var searches = { };
    var searchId = 1000;
    var queryId = 100000;
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
                extra: 'count=200'
            },
            mentions: {
                urlpart: 'statuses/mentions',
                extra: 'count=800'
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
            q = queryId++;
            //      console.log("returning data for '" + type + "' query from cache, it's only " + ((new Date() - queryCache[type].stamp)/1000.0).toFixed(2) + "s old" +
            //                 "(we'll let it live until its " + (queryCache[type].maxAge / 1000).toFixed(0) + "s)");
            setTimeout(function() { cb(q, queryCache[type].data); }, 0);
        } else {
            delete queryCache[type];
            if (!sto.getItem('oauth_token') || !sto.getItem('oauth_secret')) throw 'E_NEEDS_AUTH';

            var url =  pathToQueryPHP + '?token=' + sto.getItem('oauth_token') + "&secret=" + sto.getItem('oauth_secret')
                + "&path=" + typeToUrlPart[type].urlpart + '.json';
            if (typeToUrlPart[type].extra) url += "&" + typeToUrlPart[type].extra

            q = $.getJSON(url, function(data) {
                // query broke !? don't cache
                if (!data) cb(q, [ ]);
                else {
                    // fuzzy cache.  let items live between 1 and two mins.  the fuzz decreases the likelyhood we'll run new queries
                    // all at once.
                    queryCache[type] = {
                        maxAge: ((60 + Math.floor(Math.random()*61)) * 1000),
                        data: data,
                        stamp: new Date()
                    };
                    cb(q, data);
                }
            });
        }
        return q;
    }

    function cancelSearch(id) {
        if (searches[id] && searches[id].queries) {
            // cancel outstanding queries
            while (searches[id].queries.length) {
                var q = searches[id].queries.pop();
                // queries can be jQuery ajax requests, or simple numerical ids (in the case of queries that need no network activity)
                if (q && q.abort) q.abort();
            }
            delete searches[id];
            return true;
        }
        return false;
    }

    function queryComplete(searchId, query) {
        // query is all done!  remove it from the search, and if it is the last
        // query, then we'll call the c(ompletion)c(all)b(ack)
        if (searches[searchId]) {
            var obj = searches[searchId];

            // delete query
            for (var i = 0; i < obj.queries.length; i++) {
                if (obj.queries[i] == query) {
                    obj.queries.splice(i,1);
                    break;
                }
            }

            if (0 === obj.queries.length && obj.ccb) {
                if (obj.type === 'search') { 
                    obj.ccb({ total: obj.total, matches: obj.matches, term: obj.term, id: obj.id });
                } else {
                    obj.ccb({ matches: obj.matches, id: obj.id });
                }
                delete searches[searchId];
            }
        }
    }

    return {
        search: function(term, pcb, ccb) {
            term = term.toLowerCase();
            var obj = {
                type: "search",
                id: searchId++,
                queries: [ ],
                term: term,
                // items returned so we don't return duplicates
                returned: { },
                // completion callback
                ccb: ccb,
                total: 0,
                matches: 0
            };
            function searchTweet(t, term) {
                var user = (t.user ? t.user : t.sender);
                var srchContent = (user.name + user.screen_name + t.text).toLowerCase();
                return (srchContent.indexOf(term) >= 0);
            }

            var toSearch = [ 'directs', 'mentions', 'friends' ];
            for (var i in toSearch) {
                var searchTag = toSearch[i];
                var q = searchTwitter(searchTag, function(qid, data) {
                    obj.total += data.length;
                    var matches = [];
                    for (var j in data) {
                        if (searchTweet(data[j], term)) {
                            if (!obj.returned[data[j].id]) {
                                obj.returned[data[j].id] = true;
                                obj.matches++;
                                matches.push(data[j]);
                            }
                        }
                    }
                    if (matches.length > 0) pcb(matches);
                    queryComplete(obj.id, qid);
                });
                if (q) obj.queries.push(q);
            }

            searches[obj.id] = obj;
            return obj.id;
        },

        // we define notifications as directs or mentions that are less than 7 days old
        notifications: function(cb) {
            var obj = {
                type: "notify",
                id: searchId++,
                queries: [ ],
                // completion callback
                ccb: cb,
                // notifications to return
                matches: []
            };

            var toSearch = [ 'directs', 'mentions' ];

            var wantNewerThan = (new Date).getTime() - ( 7 * 24 * 60 * 60 * 1000 ) ;

            for (var i in toSearch) {
                var searchTag = toSearch[i];
                var q = searchTwitter(searchTag, function(qid, data) {
                    obj.total += data.length;
                    for (var j in data) {
                        if ((new Date(data[j].created_at)).getTime() > wantNewerThan) 
                            obj.matches.push(data[j]);
                    }
                    queryComplete(obj.id, qid);
                });
                if (q) obj.queries.push(q);
            }
            searches[obj.id] = obj;
            return obj.id;
        },

        // run a search returning results via the pcb, invoking the ccb once we're done
        cancel: function(id) {
            return cancelSearch(id);
        }
    };
})();

