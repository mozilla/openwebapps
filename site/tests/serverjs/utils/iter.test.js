process.mixin(GLOBAL, require('./test').dsl);
process.mixin(GLOBAL, require('./iter'));

var events = require('events');
var sys = require('sys');

testcase('reduce');
    test_async('should work like regular reduce', function (content, callback) {
        var list = [];
        //for (var i = 0; i < 400000; i++) {
        for (var i = 0; i < 1000; i++) {
            list.push(i);
        }

        //var t = new Date();
        var expected = list.reduce(function (p, c) { return p + c; }, 0);
        //sys.debug(new Date() - t);

        reduce(list, function (p, c, idx, list, callback) { callback(false, p + c); }, 0,
            function (error, actual) {
                //sys.debug(new Date() - t);
                assertEquals(expected, actual, callback);
                callback();
            }
        );
    });

    test_async('should handle thrown error in iterfunction', function (content, callback) {
        var list = [];
        for (var i = 0; i < 100; i++) {
            list.push(i);
        }

        var been_here = false;

        reduce(list, function (p, c, idx, list, callback) { undefined.will.raise.exception }, 0,
            function (error, actual) {
                assertIsFalse(been_here);
                been_here = true;
                assertIsTrue(error, callback);
                callback();
            }
        );
    });

    test_async('should handle error returned with callback from iterfunction', function (content, callback) {
        var list = [];
        for (var i = 0; i < 100; i++) {
            list.push(i);
        }

        var been_here = false;

        reduce(list, function (p, c, idx, list, callback) { callback('raised error'); }, 0,
            function (error, actual) {
                assertIsFalse(been_here, callback);
                been_here = true;
                assertIsTrue(error, callback);
                callback();
            }
        );
    });

run();

