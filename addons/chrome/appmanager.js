// an abstraction to keep track of all of the browsers tabs and what open applications
// map to which tabs

;AppManager = (function() {
    var AppTabs = {};

    function updateAppTabsCache(cb) {
        AppTabs = { };
        chrome.windows.getAll({ populate: true }, function (winarr) {
            for (var i in winarr) {
                console.log("one window... " + i );
                for (var j in winarr[i].tabs) {
                    var url = winarr[i].tabs[j].url;
                    var key = urlIsAssociatedWithApp(url);

                    if (key) {
                        console.log("one tab... " + key );

                        AppTabs[key] = {
                            tab: winarr[i].tabs[j].id,
                            index: winarr[i].tabs[j].index,
                            win: winarr[i].id,
                            // knowing the url is important so we can handle clicks which navigate
                            // off app (restoring the old url in the app tab and spawning the
                            // url in a new tab
                            url: winarr[i].tabs[j].url
                        }
                    }
                }
            }
            if (cb) cb();
        });
        console.log(AppTabs);
    }

    function appKeyFromTabId(tabId) {
        for (var i in AppTabs) {
            if (AppTabs[i].tab == tabId) return i; 
        }
        return null;
    }

    // position all apptabs on the left of their windows, before non-app tabs
    function leftifyAppTabs() {
        var layout = { };
        for (var i in AppTabs) {
            if (!layout[AppTabs[i].win]) { layout[AppTabs[i].win] = { }; }
            layout[AppTabs[i].win][AppTabs[i].index] = { tab: AppTabs[i].tab, key: i };
        }

        for (var i in layout) {
            var winId = i;
            console.log("considering window " + winId);
            var ixarr = [];
            for (var j in layout[i]) { ixarr.push(j); }
            ixarr.sort();

            // XXX: if there are pinned tabs, moving to index n where n < # pinned tabs
            //       is a noop.  we should handle this gracefully.
            var curix = 0;
            var moves = [];
            for (var j in ixarr) {
                if (ixarr[j] != curix) {
                    moves.push([ layout[i][ixarr[j]].tab, curix ]);
                    // now let's update our local cache of tab state.
                    // this will keep our in memory representation of
                    // interesting app tabs in sync, as well as cause
                    // the onMoved listener to realize the move is the
                    // result of programattic tab shuffling (and not
                    // the user).  It is true that our perception of
                    // reality is fragile, perhaps prone to
                    // divergence.
                    AppTabs[layout[i][ixarr[j]].key].index = curix;
                }
                curix++;
            }
            (function() {
                var _moves = moves;
                var _win = winId;

                var moveIt = function () {
                    if (_moves.length == 0) return;
                    var move = _moves.shift();
                    chrome.tabs.move(move[0], {index: move[1]}, moveIt);
                    console.log("move issued for win " + _win + " tab " + move[0] + " to position " + move[1] );
                }
                moveIt();
            })();
        }
    }

    chrome.tabs.onRemoved.addListener(function(tabId) {
        console.log("TM: tab removed");
    });

    chrome.tabs.onMoved.addListener(function(tabId, moveInfo) {
        console.log("TM: tab " + tabId + " moved from " + moveInfo.fromIndex +
                    " to " + moveInfo.toIndex);

        // if the user moved tabs around, we'll re-leftify.
        // however, if the tab is being moved to its current location
        // (as far as we're concerned), then this is probably programmatic
        // reshuffling and we'll ignore the event
        var key = appKeyFromTabId(tabId);
        // if the tab moved was not an app tab, or if it was an app tab
        // but we didn't expect the move (recorded index different than
        // present index), we'll recollaps app tabs on the left
        if (!key || AppTabs[key].index != moveInfo.toIndex) {
            // non app-tab moved.  let's re-leftify in case the
            // user placed the tab in the "priviledged" area 
            updateAppTabsCache(function() { leftifyAppTabs(); });
        } else {
            console.log("ignoring move");
        }
    });

    chrome.tabs.onDetached.addListener(function(tabId, detachInfo) {
        console.log("TM: tab detatched");
    });

    chrome.tabs.onAttached.addListener(function(tabId, detachInfo) {
        console.log("TM: tab attached");
        updateAppTabsCache(function() { leftifyAppTabs(); });
    });

    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tabState) {
        if (changeInfo.status === 'loading' && changeInfo.url) {
            // was this tab running an application before?
            var oldKey = appKeyFromTabId(tabId);
            // is this tab running an application now?
            var appKey =  urlIsAssociatedWithApp(changeInfo.url);

            console.log("Page update detected: ");
            // case 1: wasn't an app before, still isn't, ignore
            if (!oldKey && !appKey) {
                console.log("case 1: update of non-app tab to non-app tab, ignore.");
            }
            // case 2: was an app before, is now the same app, ignore
            else if (oldKey === appKey) {
                console.log("case 2: update of app tab to in-app url, ignore.");
                AppTabs[appKey].url = tabState.url;
            }
            // case 3: was an app before but navigation is to a different app or non-app url
            else if (oldKey) {
                // first we'll restore the current tab to its previous url
                chrome.tabs.update(tabId, {url: AppTabs[oldKey].url});
                // if this is not an application, we'll spawn and focus a new tab
                if (!appKey) {
                    console.log("case 3a: out of app navigation, spawning new tab");
                    chrome.tabs.create({ url: changeInfo.url, selected: true });
                } else if (AppTabs[appKey]) {
                    console.log("case 3b: navigation to different app, focusing that app");
                    chrome.tabs.update(AppTabs[appKey].tab, {selected: true, url: changeInfo.url});
                } else {
                    console.log("case 3c: navigation to app that's not running, launching");
                    // XXX: if there are pinned tabs, moving to index n where n < # pinned tabs
                    //       is a noop.  we should handle this gracefully.
                    chrome.tabs.create({ url: changeInfo.url, selected: true, index: 0 }, function() {
                        updateAppTabsCache(function() { leftifyAppTabs(); });
                    });
                }
            }
            // case 3: was an app before but navigation is to a different app or non-app url
            else if (appKey) {
                if (AppTabs[appKey]) {
                    console.log("case 4a: typed in an app that was running!  close current tab and focus running tab");
                    chrome.tabs.remove(tabId);
                    chrome.tabs.update(AppTabs[appKey].tab, {selected: true, url: changeInfo.url});
                } else {
                    console.log("case 4b: navigation to app that's not running, \"launching\"");
                    updateAppTabsCache(function() { leftifyAppTabs(); });
                }
            }
        }
        console.log("TM: tab updated");
    });

    // at load time we'll populate the current application tab cache
    $(document).ready(function() {
        updateAppsCache(function() {
            updateAppTabsCache(function() {
                leftifyAppTabs();
            });
        });
    });

    return {

    };
})();
