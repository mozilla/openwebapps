var sys = require('sys');

process.mixin(GLOBAL, require('./test').dsl);
process.mixin(GLOBAL, require('./string'));

testcase('string utility functions');
    test('smart_split should split correctly', function () {
        assertEquals(['this', 'is', '"the \\"correct\\" way"'], smart_split('this is "the \\"correct\\" way"'));
    });
    test('add_slashes should add slashes', function () {
        assertEquals('this is \\"it\\"', add_slashes('this is "it"'));
    });
    test('cap_first should capitalize first letter', function () {
        assertEquals('Yeah baby!', cap_first('yeah baby!'));
    });
    test('center should center text', function () {
        assertEquals('     centered     ', center('centered', 18));
        assertEquals('     centere      ', center('centere', 18));
        assertEquals('    centered     ', center('centered', 17));
        assertEquals('centered', center('centered', 3));
    });
testcase('titleCaps')
    test('should work as expected', function () {
        assertEquals("Nothing to Be Afraid Of?", titleCaps("Nothing to Be Afraid of?"));
        assertEquals("Q&A With Steve Jobs: 'That's What Happens in Technology'",
            titleCaps("Q&A With Steve Jobs: 'That's What Happens In Technology'")
        );
    })
testcase('wrap')
    test('should wrap text', function () {
        assertEquals('Joel \nis a \nslug', wordwrap('Joel is a slug', 5));
    });
testcase('regex_to_string')
    test('should work without groups', function () {
        assertEquals('hest', regex_to_string(/hest/));
        assertEquals('hest', regex_to_string(/^hest$/));
        assertEquals('hestgiraf', regex_to_string(/hest\s*giraf\d+/));
        assertEquals('hest*', regex_to_string(/hest\*/));
        assertEquals('hestgiraf', regex_to_string(/hest(tobis)giraf/));
    });
    
    test('should replace groups with input', function () {
        assertEquals('shows/hest/34/', regex_to_string(/^shows\/(\w+)\/(\d+)\/$/, ['hest', 34]));
        assertEquals('shows/giraf/90/', regex_to_string(/^shows\/(hest(?:laks|makrel))\/(\d+)\/$/, ['giraf', 90]));
    });

run();

