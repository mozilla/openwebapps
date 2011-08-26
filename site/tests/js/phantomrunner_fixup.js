var oldLog = console.log;

function prefixLog(prefix, args) {
  for (var i=0; i<args.length; i++) {
    if (i) {
      prefix += ' ';
    }
    prefix += args[i];
  }
  oldLog.call(console, prefix);
}

console.debug = function () {
  prefixLog('DEBUG:', arguments);
};

console.info = function () {
  prefixLog('INFO:', arguments);
};

console.log = function () {
  prefixLog('LOG:', arguments);
};

console.warn = function () {
  prefixLog('WARN:', arguments);
};
