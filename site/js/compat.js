// add indexOf to Arrays if it doesn't exist
if (!Array.indexOf){
    Array.prototype.indexOf = function(obj){
        for(var i=0; i<this.length; i++){
            if(this[i]==obj){
                return i;
            }
        }
        return -1;
    }
}

// shim in a dump function if one doesn't exist
if (!window.dump) {
    if(typeof console === "undefined") {
        window.console = { log: function() { } };
    }
    window.dump = function (x) { console.log(x); };
}
