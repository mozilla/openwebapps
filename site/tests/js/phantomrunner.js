var TESTS = ['typed-storage.html', 'repo_api.html', 'manifest.html', 'conduit.html'];
var TEST_LOCATION = '/tests/spec/';
var TEST_TIMEOUT = 10000;

var args = phantom.args;

if (args && args.length && args[0] == '--server-port') {
  SERVER_PORT = args[1];
  args = args.slice(2);
} else {
  SERVER_PORT = 60172;
}

if (args && args.length) {
  TESTS = args;
  console.log('Running subset of tests: ' + TESTS);
}

var SERVER = 'http://127.0.0.1:' + SERVER_PORT;

var page = new WebPage();

var anyFailed = false;

page.onConsoleMessage = function (msg, lineno, file) {
  var match = /^([A-Z]*):/.exec(msg);
  var level;
  if (! match) {
    level = 'LOG';
  } else {
    level = match[1];
    msg = msg.substr(level.length+1);
  }
  if (msg.indexOf('Testing example ') === 0) {
    console.log('  ----------------------------------------');
  }
  console.log(indent(level + ': ' + msg, indentLevels[level]));
  if (msg == 'All examples from all sections tested') {
    console.log('========================================');
    var result = page.evaluate(function () {
      var passed = document.querySelectorAll('.passed');
      if (passed.length) {
        passed = parseInt(passed[0].innerHTML);
      } else {
        console.log('Failed to find .passed');
        passed = -1;
      }
      var failed = document.querySelectorAll('.failed');
      if (failed.length) {
        failed = parseInt(failed[0].innerHTML);
      } else {
        console.log('Failed to find .failed');
        failed = -1;
      }
      return {passed: passed, failed: failed};
    });
    if ((! result.failed) && (! result.passed)) {
      console.log('>>>> No tests found!');
      anyFailed = true;
    } else if (! result.failed) {
      console.log('  ' + result.passed + ' tests passed, no failures!');
    } else {
      if (! anyFailed) {
        console.log('>>>> Failure!');
        anyFailed = true;
      }
      console.log('  ' + result.passed + ' passed, ' + result.failed + ' failed (' + result.passed + '/' + (result.passed+result.failed) + ')');
    }
    runNextTest();
  }
};

page.onResourceReceived = function (req) {
  if (req.status == 200) {
    return;
  }
  var referrer = null;
  for (var i=0; i<req.headers.length; i++) {
    if (req.headers[i].name.toLowerCase() == 'referer') {
      referrer = req.headers[i].value;
    }
  }
  var msg = 'Req: ' + displayUrl(url) + ' status: ' + req.status;
  if (referrer) {
    msg += ' from: ' + referrer;
  }
  console.log(msg);
};

function displayUrl(url) {
  if (url.indexOf(SERVER) === 0) {
    url = url.substr(SERVER.length);
  }
  return url;
}

function indent(s, indent) {
  s = s.replace(/\r/g, '');
  var lines = s.split(/\n/g);
  var r = '';
  for (var i=0; i<lines.length; i++) {
    r += indent + lines[i];
  }
  return r;
}

var indentLevels = {
  LOG: '  ',
  INFO: '  ',
  WARN: '',
  DEBUG: '    '
};

function strip(s) {
  s = s.replace(/^\s+/, '');
  s = s.replace(/\s+$/, '');
  s = s.replace(/\s+/, ' ');
  return s;
}

function lastSegment(url) {
  var parts = url.split(/\//g);
  var i = parts.length-1;
  while (! parts[i]) {
    i--;
    if (i < 0) {
      return '';
    }
  }
  url = parts[i];
  url = url.replace(/\?.*$/, '');
  return url;
}

var seenUrl = null;

page.onLoadFinished = function (status) {
  if (status != 'success') {
    console.log('Unable to access server: ' + lastUrl + ' status: ' + status);
    console.log('Aborting all tests');
    //phantom.exit(1);
  }
  if (lastUrl == seenUrl) {
    return;
  }
  seenUrl = lastUrl;
  var title = page.evaluate(function () {
    var titles = document.getElementsByTagName('title');
    if (titles.length) {
      return titles[0].innerHTML;
    } else {
      return null;
    }
  }) || '';
  console.log('Running ' + lastSegment(lastUrl) + ' ' + strip(title));
};

page.onInitialized = function () {
  page.injectJs('phantomrunner_fixup.js');
};

var lastUrl = null;

function openUrl(url) {
  lastUrl = url;
  page.open(url);
}

var testIndex = -1;

var testTimeout = null;

function runNextTest() {
  testIndex++;
  if (testTimeout !== null) {
    clearTimeout(testTimeout);
  }
  if (! TESTS[testIndex]) {
    if (anyFailed) {
      console.log('Finished tests; there were failures');
      phantom.exit(1);
    } else {
      console.log('Finished; all passed!');
      phantom.exit(0);
    }
  }
  testTimeout = setTimeout(function () {
    console.log('>>>> Test timed out: ' + lastUrl);
    anyFailed = true;
    runNextTest();
  }, TEST_TIMEOUT);
  openUrl(SERVER + TEST_LOCATION + TESTS[testIndex] + '');
}

runNextTest();
