
const test_module = require("./helpers/unit_test_runner").test_module;

var setupCount = 0, teardownCount = 0;

test_module( 'Assert Extra Functions', {

    exports: exports,
    setup: function() {
        // for every function below 'teardown', this will be run before the 
        // function is run.
        setupCount++;
    },

    teardown: function() {
        teardownCount++;
    },



    'assertFunction with function': function() {
        this.assertFunction( function() {}, 'this will pass' );
    },

    'assertFunction with non-function': function() {
        var test=this;
        this.expectFail(function() {
            test.assertFunction( null, 'this will fail' );
        });    
    },

    'assertNotUndefined with undefined': function() {
        var test=this;
        this.expectFail(function() {
            test.assertNotUndefined( undefined, 'this will fail' );
        });    
    },

    'assertNotUndefined with null': function() {
        this.assertNotUndefined( null, 'this will pass' );
    },

    'assertNotUndefined with false': function() {
        this.assertNotUndefined( false, 'this will pass' );
    },

    'assertNull with null': function() {
        this.assertNull( null, 'this will pass' );
    },

    'assertNull with undefined': function() {
        var test=this;
        this.expectFail(function() {
            test.assertNull( undefined, 'this will fail' );
        });    
    },

    'assertNull with false': function() {
        var test=this;
        this.expectFail(function() { 
            test.assertNull( false, 'this will fail' );
        });    
    },

    'assertNotNull with undefined': function() {
        this.assertNotNull( undefined, 'this will pass' );
    },

    'assertNotNull with false': function() {
        this.assertNotNull( false, 'this will pass' );
    },

    'assertNotNull with null': function() {
        var test=this;
        this.expectFail(function() {
            test.assertNotNull( null, 'this will fail' );
        });    
    },

    'assertObject with object': function() {
        this.assertObject( {}, 'this will pass' );
    },

    'assertString with String()': function() {
        this.assertString( new String( 'some string' ), 'this will pass' );
    },

    'assertString with ""': function() {
        this.assertString( '', 'this will pass' );
    },

    'assertString with "string"': function() {
        this.assertString( 'string', 'this will pass' );
    },

    'assertArray with []': function() {
        this.assertArray( [], 'this will pass' );
    },

    'assertArray with Array()': function() {
        this.assertArray( new Array(), 'this will pass' );
    },

    'check setupCount/teardownCount are equal': function() {
        this.assertEqual( setupCount, teardownCount + 1,
                'setupCount and teardownCount match for position in tests' );
        this.assertNotEqual( setupCount, 0, 'setupCount > 0' );
        this.assertNotEqual( teardownCount, 0, 'teardownCount > 0' );
    }
} );
