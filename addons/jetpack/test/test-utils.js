const utils = require("utils").utils;
const test_module = require("./helpers/unit_test_runner").test_module;
const {Element, Window} = require("./helpers/win_stub");

test_module('Utils Unit Tests', {
    exports: exports,
    setup: function() {
    },

    teardown: function() {
    },

    'test create_iframe': function() {
        this.assertEqual( 'function', typeof utils.create_iframe, 'create_iframe added' );
    },

    'test create_iframe gives us an iframe': function() {
        var location = 'http://www.mozilla.com',
            test=this,
            createdFrame;

        utils.create_iframe(Window, location, function(frame) {
            // success callback finally called, now make sure our frame 
            // has the close function
            test.assertEqual( 'object', typeof frame, 'frame created' );
            test.assertEqual( 'function', typeof frame.close, 'close added to frame' );

            createdFrame = frame;

            // this test is finally done
            test.done();        
        });

        // The location of the DOMContentLoaded is incorrect, this will not 
        // fire the success callback.
        var frame = Window.document.documentElement.getLastAppended();
        frame.dispatchEvent({
            type: 'DOMContentLoaded',
            target: {
                location: 'incorrectLocation' 
            }
        });
        this.assertEqual('undefined', typeof createdFrame, 'location incorrect, success callback not called' );

        this.waitUntilDone();
        
        // This will fire off the success callback to finish the test
        frame.dispatchEvent({
            type: 'DOMContentLoaded',
            target: {
                location: location
            }
        });

    }

});
