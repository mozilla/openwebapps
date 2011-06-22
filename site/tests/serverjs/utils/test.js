/*jslint laxbreak: true, eqeqeq: true, undef: true, regexp: false */
/*global require, process, exports */
var sys = require('sys');

var AssertFailedException = function (msg) {
    this.message = msg;
};

var isEqual = function (expected, actual) {

    var key, i;

    if (typeof actual !== typeof expected) { return false; }

    if (actual instanceof RegExp) { return actual.source === expected.source; }
    if (actual instanceof Date) { return actual.getTime() === expected.getTime(); }

    if (actual instanceof Array) {
        if (actual.length !== expected.length) {
            return false;
        }

        for (i = 0; i < expected.length; i++) {
            if (!isEqual(expected[i], actual[i])) {
                return false;
            }
        }
        return true;
    }

    // Objects are compared in a sort of "at least equal to"-way, that is, the
    // actual object must have the expected properties with the expected
    // values, but it is still considered equal if it has some properties on it
    // that are not on the expected object.
    if (typeof expected === 'object') {
        for (key in expected) {
            if (expected.hasOwnProperty(key)) {
                if (!isEqual(actual[key], expected[key])) { return false; }
            }
        }
        return true;
    }

    return actual === expected;
};

var testcases = [];
var async_test_has_failed = false;

exports.dsl = {

    testcase: function (name) {
        testcases.unshift({ name: name, tests: [] });
    },

    test: function (name, func) {
        testcases[0].tests.push({
            name: name,
            body: function (context, callback) {
                try {
                    func(context);
                    callback();
                } catch (e) {
                    callback(e);
                }
            }
        });
    },

    test_async: function (name, func) {
        testcases[0].tests.push({ name: name, body: func });
    },

    setup: function (func) {
        testcases[0].setup = func;
    },

    teardown: function (func) {
        testcases[0].teardown = func;
    },

    run: function (stop_on_error) {

        var count = 0, error_cnt = 0, failed_cnt = 0;
        var testcase_idx = testcases.length - 1;

        (function run_testcases() {

            var idx = 0;
            var testcase = testcases[testcase_idx--];

            if (testcase) {
                sys.puts('\n[Testcase: ' + testcase.name + ']');

                (function run_tests() {

                    var test = testcase.tests[idx];

                    if (test) {

                        idx = idx + 1;
                        count = count + 1;

                        var context = testcase.setup ? testcase.setup() : {};

                        async_test_has_failed = false;

                        function handle_result(error) {
                            if (error) {
                                async_test_has_failed = true;

                                if (error instanceof AssertFailedException) {
                                    sys.puts(' [--] ' + test.name + ': failed. ' + error.message);
                                    failed_cnt++;
                                } else {
                                    sys.print(' [!!] ' + test.name + ': error. ');
                                    if (error.stack && error.type) {
                                        sys.puts(error.type + '\n' +  error.stack);
                                    } else {
                                        sys.puts(JSON.stringify(error, 0, 2));
                                    }
                                    error_cnt++;
                                }

                                if (stop_on_error) {
                                    sys.puts('stopping on first error');
                                    testcase_idx = -1;
                                    idx = testcase.tests.length;
                                }
                            } else {
                                sys.puts(' [OK] ' + test.name + ': passed');
                            }

                            if (testcase.teardown) { testcase.teardown(context); }

                            process.nextTick(run_tests);
                        }

                        try { 
                            test.body(context, handle_result);
                        } catch (e) {
                            handle_result(e);
                        }

                    } else {
                        // no more tests
                        sys.puts('----');
                        process.nextTick(run_testcases);
                    }
                })();
            } else {
                // no more testcases
                sys.puts('\nTotal: ' + count + ', Failures: ' + failed_cnt + ', Errors: ' + error_cnt + '');
            }

        })();
    },

    assertEquals: function (actual, expected, callback) {
        if (async_test_has_failed) { return; }
        if (!isEqual(actual, expected)) {
            var exception = new AssertFailedException(
                '\nExpected: ' + sys.inspect(actual) + '\nActual: ' + sys.inspect(expected) + '\n'
            ); 
            if (callback) { callback(exception); } else { throw exception; }
        };
    },

    assertIsTrue: function (actual, callback) {
        if (async_test_has_failed) { return; }
        if (!actual) {
            var exception = new AssertFailedException('\nExpected ' + sys.inspect(actual) + ' to be true\n'); 
            if (callback) { callback(exception); } else { throw exception; }
        }
    },

    assertIsFalse: function (actual, callback) {
        if (async_test_has_failed) { return; }
        if (actual) {
            var exception = new AssertFailedException('\nExpected ' + sys.inspect(actual) + ' to be false\n'); 
            if (callback) { callback(exception); } else { throw exception; }
        }
    },

    shouldThrow: function (func, args, this_context, callback) {
        if (async_test_has_failed) { return; }
        try {
            func.apply(this_context, args);
        } catch (e) {
            var passed = true;
        }

        if (!passed) {
            var exception = new AssertFailedException('No exception was thrown');
            if (callback) { callback(exception); } else { throw exception; }
        }
    },

    shouldNotThrow: function (func, args, this_context, callback) {
        if (async_test_has_failed) { return; }
        try {
            func.apply(this_context, args);
        } catch (e) {
            var exception = new AssertFailedException('Caught <' + e + '>');
            if (callback) { callback(exception); } else { throw exception; }
        }
    },
    
    fail: function (message, callback) {
        if (async_test_has_failed) { return; }
        var exception = new AssertFailedException(message);
        if (callback) { callback(exception); } else { throw exception; }
    },

    end_async_test: function (callback) {
        if (!async_test_has_failed) { callback(); }
    }
};

/*
function broken(s) {
    return tobis.hest;
}

with (exports.dsl) {
    testcase('Testing testsystem')
        test('two should equal two', function () {
            assertEquals(2, 2);
            shouldNotThrow( assertEquals, [2,2] );
        })
        test('four should not equal two', function () {
            shouldThrow( assertEquals, [2,4] );
        })
        test('broken function should throw', function () {
            shouldThrow( broken );
        })
        test('arrays should be equal', function () {
            assertEquals([1,2,3,4], [1,2,3,4]);
        })
        test('different arrays should not be equal', function () {
            shouldThrow( assertEquals, [ [1,2,3,4], [1,2,3] ]);
        })
        test('regexes should be equal', function () {
            assertEquals( /abc/, /abc/ );
        })
        test('different regexes should not be equal', function () {
            shouldThrow( assertEquals, [ /abc/, /edf/ ]);
        })
        test('dates should be equal', function () {
            assertEquals( new Date(376110000000) , new Date(376110000000) );
        })
        test('different dates should not be equal', function () {
            shouldThrow( assertEquals, [ new Date(376110000000), new Date() ]);
        })
        test('objects should be equal', function () {
            assertEquals( {a: 'hest', b: 5, c: [1,2,3]}, {a: 'hest', b: 5, c: [1,2,3]} );
        })
        test('different objects should not be equal', function () {
            shouldThrow( assertEquals, [ {a: 'hest', b: 5, c: [1,2,3]}, {a: 'hest', b: 5, c: [2,3]} ]);
        })

    testcase('Testing async tests');
        test_async('wait then success', function(context, callback) {
            setTimeout(callback, 500);
        });
        test_async('wait then failure', function(context, callback) {
            setTimeout(function () { callback("error - but it's okay :-)")}, 500);
        });
        test_async("this test throws, and should always fail", function () {
            throw "it's okay :-)";
        });
        test_async('wait with assert', function (context, callback) {
            setTimeout(function () {
                assertEquals('hest', 'hest', callback);
                assertEquals(2, 2, callback);
                shouldThrow(assertEquals, [2,4], null, callback)
                end_async_test( callback );
            });
        });

    testcase('Testing setup and teardown');
        var teardown_result = 0;
    
        setup(function () {
            return { hest: 1 }
        });

        teardown(function (context) {
            teardown_result = context.hest;
        });

        test('setup should run before test', function (context) {
            assertEquals({ hest: 1 }, context);
            context.hest += 1;
        });

        test('teardown should run after test', function (context) {
            assertEquals(2, teardown_result);
        });

    run();
}
//*/


