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

        var aDiv = $("<div/>").addClass("dbgrow")
            .append($("<div/>").addClass("direction").text(inbound ? "<" : ">"))
            .append($("<div/>").addClass("msgid").html(m.id ? m.id : "&nbsp;"))
            .append($("<div/>").addClass("type").text(t))
            .append($("<div/>").addClass("msg").text(summary));

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

