function validate() {
    $("#output").css('color', 'red');
    var editor = document.getElementById("editor").bespin.editor;
    var manifest = null;

    try {
        manifest = JSON.parse(editor.value);
    } catch(e) {
        $("#output").text("invalid JSON: " + e);
        return;
    }

    try {
        Manifest.validate(manifest);
    } catch(e) {
        var path = "";
        if (e.path) {
            path = "(" + e.path.join(".") + ") ";
        }
        $("#output").text("invalid manifiest: " + path + e.msg);
        return;
    }

    // XXX: in-place normalization?  how can I do this without re-ordering keys,
    //      cause it would be, like, awesome.
    $("#output").css('color', 'green');
    $("#output").text("that manifest is valid, woo!");
}

function normalize() {
    var editor = document.getElementById("editor").bespin.editor;
    try {
        var pos = editor.selection.start;
        editor.value = JSON.stringify(Manifest.validate(JSON.parse(editor.value)), null, 2);
        editor.setCursor(pos);
    } catch(e) {
        $("#output").text("Can't normalize: " + e);
        return;
    }
}

window.onBespinLoad = function() {
    var edit = document.getElementById("editor");
    // Get the environment variable.
    var env = edit.bespin;
    // Get the editor.
    var editor = env.editor;

    var waitForIt = null;
    editor.textChanged.add(function(oldRange, newRange, newText) {
        if (waitForIt) clearTimeout(waitForIt);
        waitForIt = setTimeout(validate, 700);
        console.log("yeah, it changed...");
    });

    $("#normalize").click(normalize);

    validate();
};

$(document).ready(function() {
    function izInstalled() {
        $(".upsell").unbind('click').html("I'm installed!  You can check me out on your <a href='https://myapps.mozillalabs.com'>dashboard</a>.");
    }

    navigator.mozApps.amInstalled(function(data) {
        if (data) {
            izInstalled();
        } else {
            var contents = $("<span>Wanna <span>install me</span>?  Then click!</span>");
            $(".upsell").append(contents).click(function() {
                navigator.mozApps.install({
                    url: "/manifest.webapp",
                    onsuccess: function() {
                        izInstalled();
                    },
                    onerror: function(errObj) {
                        alert("oh noes!  Couldn't install this bugger: (" + errObj.code + ") - " + errObj.message);
                    }
                });

            });

        }
        $(".upsell").show(400);
    });
});
