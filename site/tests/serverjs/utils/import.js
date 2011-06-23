exports.import = function(to, from) {
    for( var key in from ) {
        if( from.hasOwnProperty( key ) ) {
            to[ key ] = from[ key ];
        }
    }
}
