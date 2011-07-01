const about = require("about");
const test_module = require("./helpers/unit_test_runner").test_module;
const win = require("./helpers/win_stub").win;

var aboutInst;

test_module('About Unit Tests', {
    exports: exports,
    setup: function() {
        // create an instance of AboutApps here.
        // Note, this will create a new instance of AboutApps for EVERY test
    },

    teardown: function() {
       // teardown the instance of AboutApps here.           
    },

    'test exports': function() {
        this.assertNotEqual('undefined', typeof about.AboutApps, 'AboutApps exported');
    }
});

