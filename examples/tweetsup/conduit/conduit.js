/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is AppConduit; substantial portions derived
 * from XAuth code originally produced by Meebo, Inc., and provided
 * under the Apache License, Version 2.0; see http://github.com/xauth/xauth
 *
 * Contributor(s):
 *   Michael Hanson <mhanson@mozilla.com>
 *   Lloyd Hialiel <lloyd@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var chan = Channel.build({window: window.parent, origin: "*", scope: "conduit"});

/* a utility routine to map a tweet returned from the twitter API into a format
 * that appetizer likes */
function convertObject(t) {
	var user = t.user ? t.user : t.sender;
    return {
	    link: "http://twitter.com/" + user.screen_name + "/status/" + t.id,
	    title: user.screen_name + ": " + t.text.substr(0,40) + "...",
	    summary: t.text,
	    updated: t.created_at,
        id: t.id
	};
}

/* search messges carry a results callback that should be invoked to deliver incremental
 * results.
 *
 * upon completion the total number of results should be returned.
 */
chan.bind("search", function(trans, args) {
    var num = 0;
    Twitter.search(args.term, function(ar) {
        var res = [];
        for (var i = 0; i < ar.length; i++) {
            num++;
	        res.push(convertObject(ar[i]));
        }
        if (res.length > 0) args.results(res);
    }, function (res) {
	    trans.complete(num);
    });
    trans.delayReturn(true);
});

chan.bind("notifications", function(trans, args) {
    Twitter.notifications(function(r) {
        var res = [];
        for (var i = 0; i < r.matches.length; i++) {
	        res.push(convertObject(r.matches[i]));
        }
	    trans.complete(res);
    });
    trans.delayReturn(true);
});
