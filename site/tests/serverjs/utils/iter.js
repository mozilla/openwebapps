var sys = require('sys');

exports.reduce = function reduce(array, iter_callback, initial, result_callback) {

    var index = 0;
    var depth = 0;

    if (!result_callback) { throw 'no result callback!!!'; }

    (function inner (error, value) {

        if (error) {
            return result_callback(error);
        }
        
        if (index < array.length) {
            process.nextTick( function () {
                try {
                    index = index + 1;
                    iter_callback( value, array[index - 1], index, array, inner );
                } catch (e) {
                    result_callback(e);
                }
            });
        } else {
            result_callback( false, value );
        }
    })( false, initial );
}

