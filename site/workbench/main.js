$(document).ready(function() {
    var conduitUrl = "";
    var chan = null;

    function clearMessages() {
        $("#debugOutput").empty();
    }

    function addLog(severity, content) {
        $("<div/>").addClass("dbgrow")
            .append($("<div/>").addClass("note").addClass(severity).text(content))
            .appendTo("#debugOutput");
    }

    // add a conduit message to the debug output
    function addMessage(m, inbound) {
        // determine the type and body of message
        var t = "";
        var body = "";
        var summary = "";
        if (m.id) {
            summary = "(" + m.id + ") ";
            if (m.callback) { t = "CB"; body = m.params; }
            else if (m.method) { t = "REQ"; body = m.params; }
            else if (m.error) { t = "ERR"; body = { error: m.error, message: m.message }; }
            else { t = "RESP"; body = m.result; }
        } else {
            t = "NOTE";
        }
        if (m.method) summary += m.method.split("::")[1];

        var fullMsg = $("<div/>").addClass("full").text(JSON.stringify(m, null, 4)).hide();

        var floater = $("<div/>").width("21px").height("15px")
            .css("border-top", "1px solid black").css("border-bottom", "1px solid black")
            .css("position", "absolute").css("background-color", "#ccc").appendTo("body").hide();

        var aDiv = $("<div/>").addClass("dbgrow")
            .append($("<div/>").addClass("direction").text(inbound ? "<" : ">"))
            .append($("<div/>").addClass("msgid").html(m.id ? m.id : "&nbsp;"))
            .append($("<div/>").addClass("type").text(t))
            .append($("<div/>").addClass("msg").text(summary))
            .append(fullMsg)
            .hover(function(ev) {
                // cache content height and width in the DOM, to handle window resizes
                if (!fullMsg.attr("contentHeight")) {
                    fullMsg.attr("contentHeight", fullMsg.outerHeight());
                    fullMsg.attr("contentWidth", fullMsg.outerWidth());
                }
                var contentHeight = fullMsg.attr("contentHeight");
                var contentWidth = fullMsg.attr("contentWidth");

                var p = fullMsg.parent();
                var poff = p.offset();
                // postion the cutesy floating peice
                floater.css("top", poff.top).css("left", poff.left - 21).show();
                // this is *very* cute I think.  give the mouse a path to cruise into the message
                // without causing a hover out.
                floater.appendTo(p);

                // determine width and left offset
                if (contentWidth > (poff.left - 40)) {
                    fullMsg.width(poff.left - 40 - (fullMsg.outerWidth(true) - fullMsg.width()));
                }
                poff.left -= fullMsg.outerWidth() + 20;

                // determine height and top offset
                if ($(window).height() - 40 < contentHeight) {
                    fullMsg.height($(window).height() - 40 - (fullMsg.outerHeight(true) - fullMsg.height()));
                }

                // Start by centering the message
                poff.top -= (fullMsg.outerHeight() - p.outerHeight()) / 2;

                // are we leaking off the top?
                if (poff.top < 20 + $(window).scrollTop()) poff.top = 20 + $(window).scrollTop();
                // are we leaking off the bottom?
                else if (poff.top + fullMsg.outerHeight() > $(window).scrollTop() + $(window).height() - 20) {
                    poff.top = $(window).scrollTop() + $(window).height() - 20 - fullMsg.outerHeight();
                }

                fullMsg.css("position", "absolute").css("top", poff.top).css("left", poff.left);
                fullMsg.show();
                // draw lines to the box
                p.css("border-top", "1px solid black").css("border-bottom", "1px solid black");
            }, function(ev) {
                var p = fullMsg.parent();
                p.css("border-top", "1px solid white").css("border-bottom", "1px solid white");
                fullMsg.hide();
                floater.hide();
            });

        $("#debugOutput").append(aDiv);

    }

    function chanNotReady() {
        $("#searchBoxButton button").button({disabled: true});
        $("#notificationBoxButton button").button({disabled: true});
    }

    function chanReady() {
        $("#searchBoxButton button").button({disabled: false});
        $("#notificationBoxButton button").button({disabled: false});
    }

    // load up a conduit
    function loadConduit(url) {
        // clear out debugging messages
        clearMessages();

        // indicate our intent
        addLog("info", "loading " + url);

        // kill chan
        if (chan) {
            chan.destroy();
            chan = null;
        }
        $("#childIFrame").detach();
        var iframe = $("<iframe/>")
            .height(0)
            .width(0)
            .css("left","-999px")
            .css("top","-999px")
            .css("display","none")
            .attr("src", url)
            .attr("id", "childIFrame")
            .appendTo("body");

        // XXX how do we get an underlying dom node outta jquery?
        chan = Channel.build({
            window: document.getElementById("childIFrame").contentWindow,
            origin: url,
            scope: "conduit",
            postMessageObserver: function(origin, msg) {
                addMessage(msg, false);
            },
            gotMessageObserver: function(origin, msg) {
                addMessage(msg, true);
            },
            onReady: function(chan) {
                addLog("info", "conduit ready!");
                // and enable the search and notification buttons
                chanReady();
            }
        });
    }

    chanNotReady();

    // buttonify
    $("#urlBoxButton button").button({disabled: true});


    // make our tabs, tabs
    $("#tabs").tabs();

    // add a listener to form input 
    $("#urlBox").keyup(function(e) {
        var txt = $.trim($("#urlBox").val());
        if (txt.length > 0) {
            $("#urlBoxButton button").button({disabled: false});
        } else {
            $("#urlBoxButton button").button({disabled: true});
        }
    });

    // the clear button, should
    $("#debugClear > button").button().click(function() { clearMessages(); });

    // and a listener for submission
    $("#urlForm").submit(function(e) {
        e.preventDefault();
        try {
            loadConduit($.trim($("#urlBox").val()));
        } catch(e) {
            console.log(e);
        }
    });

    // search handling
    $("#searchInput form").submit(function(e) {
        e.preventDefault();
        var term = $.trim($("#searchBox").val());
        if (!term.length) {
            addLog("error", "Need non-blank search term!");
            return;
        }
        addLog("info", "searching for: " + term);
        chan.call({
            method: "search",
            params: {
                term: term,
                results: function(r) {
                    // XXX: do something with results!
                }
            },
            success: function (num) {
                addLog("info", "search complete. " + num + " result(s).");
            },
            error: function (code, msg) {
                addLog("error", "Error (" + code + "): " + msg);
            }
        });
    });

    // notification handlin'
    $("#notificationBoxButton button").click(function() {
        addLog("info", "polling notifications.");
        chan.call({
            method: "notifications",
            success: function (r) {
                addLog("info", "poll complete, " + r.length + " result(s).");
            },
            error: function (code, msg) {
                addLog("error", "Error (" + code + "): " + msg);
            }
        });
    });
});

