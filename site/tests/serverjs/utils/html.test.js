process.mixin(GLOBAL, require('./test').dsl);
process.mixin(GLOBAL, require('./html'));

testcase('tests for linebreaks()')
    test('should break lines into <p> and <br /> tags', function () {
        var input = 'This is a \'nice\'\n'
            + 'way to spend the summer!\n'
            + '\n'
            + 'The days are just packed!\n';
        var expected = '<p>This is a \'nice\'<br />'
            + 'way to spend the summer!</p>\n'
            + '\n'
            + '<p>The days are just packed!<br /></p>';
        var expected_escaped = '<p>This is a &#39;nice&#39;<br />'
            + 'way to spend the summer!</p>\n'
            + '\n'
            + '<p>The days are just packed!<br /></p>';
        assertEquals(expected, linebreaks(input));
        assertEquals(expected_escaped, linebreaks(input, { escape: true }));
    })
testcase('truncate_html_words');
    test('should truncate strings without tags', function () {
        assertEquals('Joel is ...', truncate_html_words('Joel is a slug', 2));
    });
    test('should close tags on truncate', function () {
        assertEquals('<p>Joel is ...</p>', truncate_html_words('<p>Joel is a slug</p>', 2));
    });
testcase('urlize')
    test('should urlize urls in text', function () {
        assertEquals(
            'Check out <a href="http://www.djangoproject.com">www.djangoproject.com</a>',
            urlize('Check out www.djangoproject.com')
        );
        assertEquals(
            'Check out (<a href="http://www.djangoproject.com">www.djangoproject.com</a>)',
            urlize('Check out (www.djangoproject.com)')
        );
        assertEquals(
            'Skriv til <a href="mailto:test@test.se">test@test.se</a>',
            urlize('Skriv til test@test.se')
        );
        assertEquals(
            'Check out (<a href="http://www.djangoproject.com">www.djangoproject.com</a>)\n' +
            'Skriv til <a href="mailto:test@test.se">test@test.se</a>',
            urlize('Check out (www.djangoproject.com)\nSkriv til test@test.se')
        );
        assertEquals(
            'Check out <a href="http://www.djangoproject.com">www.djangopr...</a>',
            urlize('Check out www.djangoproject.com', {limit: 15})
        );
        assertEquals(
            'Se her: (<a href="http://www.dr.dk">www.dr.dk</a> &amp; ' +
            '<a href="http://www.djangoproject.com">http://www.djangoproject.com</a>)',
            urlize('Se her: (www.dr.dk & http://www.djangoproject.com)', { escape: true })
        );
        assertEquals(
            'Se her: <a href="http://www.dr.dk?hest=4&amp;test=tolv">www.dr.dk?hest=4&amp;test=tolv</a>.',
            urlize('Se her: www.dr.dk?hest=4&test=tolv.', { escape: true })
        );
        assertEquals(
            'Check out (<a href="http://www.djangoproject.com" rel="nofollow">www.djangoproject.com</a>)',
            urlize('Check out (www.djangoproject.com)', { nofollow: true })
        );
    });

run();
