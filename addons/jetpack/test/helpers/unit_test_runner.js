const keywords = ['setup', 'teardown', 'exports'];

function test_module(name, config) {
    var tests = {};

    for(var key in config) {
        if(keywords.indexOf(key) === -1) {
            config.exports[name + '.' + key] = wrapper.bind(null, config, config[key]);
        }
    }

    return tests;
}

function wrapper(config, testFunc, testRunner) {
    if(config && config.setup) {
        config.setup();
    }

   // extend the testRunner with some utility functions
    for(var key in testRunnerExtensions) {
        if(!testRunner[key]) {
            testRunner[key] = testRunnerExtensions[key];
        }
    }

    testFunc.call(testRunner);

    if(config && config.teardown) {
        config.teardown();
    }
}


const testRunnerExtensions = {
    assertFunction: function(toTest, message) {
        return this.assertStrictEqual('function', typeof toTest, message);
    },

    assertUndefined: function(toTest, message) {
        return this.assertStrictEqual('undefined', typeof toTest, message);
    },

    assertNotUndefined: function(toTest, message) {
        return this.assertNotStrictEqual('undefined', typeof toTest, message);
    },

    assertNull: function(toTest, message) {
        return this.assertStrictEqual(null, toTest, message);
    },

    assertNotNull: function(toTest, message) {
        return this.assertNotStrictEqual(null, toTest, message);
    },

    assertObject: function(toTest, message) {
        return this.assertStrictEqual('[object Object]', Object.prototype.toString.apply(toTest), message);
    },

    assertString: function(toTest, message) {
        return this.assertStrictEqual('[object String]', Object.prototype.toString.apply(toTest), message);
    },

    assertArray: function(toTest, message) {
        return this.assertStrictEqual('[object Array]', Object.prototype.toString.apply(toTest), message);
    },

    assertNumber: function(toTest, message) {
        return this.assertStrictEqual('[object Number]', Object.prototype.toString.apply(toTest), message);
    }
};



exports.test_module = test_module;

