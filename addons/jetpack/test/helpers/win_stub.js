
var ElementMock = function( type ) {
    this.type = type;
    this.events = {};
};

ElementMock.prototype = {
    setAttribute: function() {},
    addEventListener: function(eventName, callback, bubbling) {
        this.events[ eventName ] = this.events[ eventName ] || [];
        this.events[ eventName ].push( callback );
    },
    dispatchEvent: function( evt ) {
        var events = this.events[ evt.type ] || [];
        events.forEach(function(handler) {
            handler(evt);
        });
    }
};

exports.Element = ElementMock;

exports.Window = {
    document: {
        createElementNS: function(ns, type) {
            return new ElementMock(type);
        },
        documentElement: {
            appendChild: function(element) { this.lastAppended = element; },
            removeChild: function() {},
            getLastAppended: function() { return this.lastAppended; }
        }
    }
};

