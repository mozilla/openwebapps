var sys = require('sys');

// Internationalization strings
var i18n = {
    'en-us': {
        days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
               "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
                 "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        months_ap: ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'],
        ordinal_suffix: { 1: 'st', 2: 'nd', 3: 'rd', 21: 'st', 22: 'nd', 23: 'rd', 31: 'st', 'default': 'th' },
        special_times: ['midnight', 'noon'],
        timespan: ['year', 'years', 'month', 'months', 'week', 'weeks', 'day', 'days', 'hour', 'hours', 'minute', 'minutes']
    }
};

var cur_i18n = i18n['en-us'];



// constants
var month_daycount = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    timezone_re = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
    timezoneClip_re = /[^-+\dA-Z]/g;

function pad(val, len) {
    val = "" + val;
    len = len || 2;
    while (val.length < len) { val = "0" + val; }
    return val;
}

var time_format_flags = {
    a: function (d) { return d.getHours() < 12 ? "a.m." : "p.m."; },
    A: function (d) { return d.getHours() < 12 ? "AM" : "PM"; },
    B: function (d) { throw 'format flag "B" is not implemented, as pr. Django spec.'; },
    f: function (d) {
        var h = time_format_flags.g(d), m = d.getMinutes();
        return m ? h + ":" + m : h;
    },
    g: function (d) {
        var h = d.getHours() % 12;
        return h ? h : 12;
    },
    G: function (d) { return d.getHours(); },
    h: function (d) { return pad(time_format_flags.g(d)); },
    H: function (d) { return pad(d.getHours()); },
    i: function (d) { return pad(d.getMinutes()); },
    P: function (d) {
        var h = d.getHours(), m = d.getMinutes();
        if (m === 0 && h === 0) { return cur_i18n.special_times[0]; }
        if (m === 0 && h === 12) { return cur_i18n.special_times[1]; } 
        return time_format_flags.f(d) + ' ' + time_format_flags.a(d);
    },
    s: function (d) { return pad(d.getSeconds()); },
    u: function (d) { return d.getMilliseconds() * 1000; }
};


var date_format_flags = {
    b: function (d) { return cur_i18n.months[d.getMonth()].toLowerCase(); },
    c: function (d) {
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" +
               pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
               '.' + pad(d.getMilliseconds(), 3) + "000";
    },
    d: function (d) { return pad(d.getDate()); },
    D: function (d) { return cur_i18n.days[d.getDay()]; },
    F: function (d) { return cur_i18n.months[d.getMonth() + 12]; },
    I: function (d) { throw 'format flag "I" is not implemented, as pr. Django spec.'; },
    j: function (d) { return d.getDate(); },
    l: function (d) { return cur_i18n.days[7 + d.getDay()]; },
    L: function (d) {
        y = d.getFullYear();
        if (y % 4) { return false; }
        if (y % 100) { return true; }
        return y % 400 ? false : true;
    },
    m: function (d) { return pad(d.getMonth() + 1); },
    M: function (d) { return cur_i18n.months[d.getMonth()]; },
    n: function (d) { return d.getMonth() + 1; },
    N: function (d) { return cur_i18n.months_ap[d.getMonth()]; },
    O: function (d) {
        var o = d.getTimezoneOffset();
        return (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4);
    },
    r: function (d) {   
       return date_format_flags.D(d) + ', ' + d.getDate() + ' ' + date_format_flags.M(d) + ' ' +
              d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' +
              pad(d.getSeconds()) + ' ' + date_format_flags.O(d);
    },
    S: function (d) {
        var out = cur_i18n.ordinal_suffix[d.getDate()];
        return out || cur_i18n.ordinal_suffix['default'];
    },
    t: function (d) {
        var m = d.getMonth();
        return m === 1 && date_format_flags.L(d) ? (month_daycount[m] + 1) : month_daycount[m];
    },
    T: function (d) {
        return (String(d).match(timezone_re) || [""]).pop().replace(timezoneClip_re, "");
    },
    U: function (d) { return Math.floor(d.getTime() / 1000); },
    w: function (d) { return d.getDay(); },
    W: function (d) {   
        // week algorithm from http://www.merlyn.demon.co.uk/weekcalc.htm#JS
        var weekday = d.getDay() || 7;
        var clone = new Date(d);
        clone.setDate(d.getDate() + (4 - weekday));
        var year = clone.getFullYear();
        var tmp = Math.floor((clone.getTime() - new Date(year, 0, 1, -6)) / 86400000);
        return 1 + Math.floor(tmp / 7);
    },
    y: function (d) { return d.getFullYear() % 100; },
    Y: function (d) { return pad(d.getFullYear(), 4); },
    z: function (d) {
        var i, m = d.getMonth(), cnt = d.getDate();
        for (i = 0; i < m; i++) {
            cnt += m === 1 && date_format_flags.L(d) ? (month_daycount[i] + 1) : month_daycount[i];
        }
        return cnt;
    },
    Z: function (d) { return d.getTimezoneOffset() * 60; }
};

function make_flags_re(/*...*/) {
    var i, f, re_src = '(\\\\.)|[';
    for (i = 0; i < arguments.length; i++) {
        for (f in arguments[i]) {
            re_src += f;
        }
    }
    return new RegExp(re_src + ']', 'g');
}

var time_flags_re = make_flags_re(time_format_flags);
var date_flags_re = make_flags_re(date_format_flags);
var all_flags_re = make_flags_re(time_format_flags, date_format_flags);

function format_date(date, format) {
    return format.replace(all_flags_re, function (s, escape_val) {
        if (escape_val) { return escape_val.replace(/\\/g, ''); }
        if (date_format_flags[s]) {
            return date_format_flags[s](date);
        } else if (time_format_flags[s]) {
            return time_format_flags[s](date);
        } else {
            return s;
        }
    });
}

exports.format_date = format_date;

function format_time(time, format) {
    return format.replace(time_flags_re, function (s, escape_val) {
        if (escape_val) { return escape_val.replace(/\\/g, ''); }
        if (time_format_flags[s]) {
            return time_format_flags[s](time);
        } else {
            return s;
        }
    });
}

exports.format_time = format_time;

/*************** TIMESPAN ********************************************/


function timespan_to_str(timespan) {

    function map_chunk(cnt, idx) {
        return cnt + ' ' + cur_i18n.timespan[ cnt === 1 ? idx * 2 : idx * 2 + 1]
    }

    var chunks = [
        // years
        1000 * 60 * 60 * 24 * 365,
        // months
        1000 * 60 * 60 * 24 * 30,
        // weeks
        1000 * 60 * 60 * 24 * 7,
        // days
        1000 * 60 * 60 * 24,
        // hours
        1000 * 60 * 60,
        // minutes
        1000 * 60,    
    ];

    chunks.forEach(function (x, idx) {
        chunks[idx] = Math.floor(timespan / x);
        timespan -= chunks[idx] * x;
    });

    for (var i = 0; i < chunks.length; i++) {
        if (chunks[i]) {
            return map_chunk(chunks[i], i) + (chunks[i+1] ? ', ' + map_chunk(chunks[i+1], i+1) : '');
        }
    }
    return map_chunk(0, chunks.length - 1);
}

function timesince(date, now) {
    if (!now) { now = new Date(); }
    var timespan = now - date;
    if (timespan < 0) { timespan = 0; }
    return timespan_to_str(timespan);
}
exports.timesince = timesince;

function timeuntil(date, now) {
    if (!now) { now = new Date(); }
    var timespan = date - now;
    if (timespan < 0) { timespan = 0; }
    return timespan_to_str(timespan);
}
exports.timeuntil = timeuntil;



