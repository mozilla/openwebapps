function validate() {
    var editor = document.getElementById("editor").bespin.editor;
    var manifest = null;

    try {
        manifest = JSON.parse(editor.value);
    } catch(e) {
        $("#output").text("invalid JSON: " + e);
        return;
    }

    try {
        Manifest.parse(manifest);
    } catch(e) {
        var path = "";
        if (e.path) {
            path = "(" + e.path.join(".") + ") ";
        }
        $("#output").text("invalid manifiest: " + path + e.msg);
        return;
    }

    // XXX: in-place normalization?  how can I do this without re-ordering keys :(

    $("#output").text("that manifest is valid, woo!");
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

    validate();
};
