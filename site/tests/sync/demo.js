$(function () {

  var ANIMATION = 300;

  var storage = TypedStorage();

  var sync = Sync({
    url: "/",
    addHeaders: {'X-Testing-User': 'test'},
    forceUser: 'test',
    storage: storage
  });

  function storageEvent(event) {
    logEvent(event);
    if (event.eventType == 'multiplechange') {
      syncStore();
      return;
    }
    if (event.storageType._objType == 'app') {
      if (event.eventType == 'change') {
        var manifest = event.value;
        addManifest(manifest, true);
      } else if (event.eventType == 'delete') {
        var li = $('#' + makeId(event.target));
        li.hide(ANIMATION, function () {li.remove();});
      }
    } else if (event.storageType._objType == 'deletedapp') {
      if (event.eventType == 'change') {
        addDeleted(event.target, true);
      } else {
        var li = $('#' + makeId(event.target));
        li.hide(ANIMATION, function () {li.remove();});
      }
    }
  }

  function addManifest(manifest, animate) {
    var url = manifest.base_url;
    var id = makeId(url);
    var li = $('#' + id);
    li.remove();
    li = $('<li>');
    li.text(manifest.base_url);
    li.attr('id', id);
    var button = $('<button type="button">remove</button>');
    button.click(function () {
      storage.open('app').remove(url);
      // li will be automatically removed
    });
    li.append(button);
    button = $('<button type="button">delete</button>');
    button.click(function () {
      storage.open('app').remove(url);
      storage.open('deletedapp').put(url, {base_url: url});
    });
    li.append(button);
    li.hide();
    $('#installed').append(li);
    li.show(animate ? ANIMATION : 0);
    // FIXME: highlight here
  }

  function addDeleted(url, animate) {
    var id = makeId(url);
    var li = $('#' + id);
    li.remove();
    li = $('<li>');
    li.attr('id', makeId(url));
    li.text(url);
    var button = $('<button type="button">remove</button>');
    button.click(function () {
      storage.open('deletedapp').remove(url);
    });
    li.append(button);
    li.hide();
    $('#deleted').append(li);
    li.show(animate ? ANIMATION : 0);
  }

  function makeId(url) {
    var id = url;
    id = id.replace(/^https?:\/\//, '');
    id = id.replace(/[\/.]/, '_');
    id = id.replace(/[^a-z0-9_\-,]/g, '');
    return id;
  }

  function logEvent(event) {
    var eventType = event.eventType;
    if (event.target) {
      var orig = event.storageType.get(event.target);
    } else {
      var orig = undefined;
    }
    if (eventType == 'change' && orig === undefined) {
      eventType = 'add';
    }
    if (event.storageType) {
      var objType = event.storageType._objType;
    } else {
      var objType = 'none';
    }
    var logLine = (objType + '::'
                   + (event.target || 'none') + ' ' + eventType);
    writeLog(logLine);
  }

  function writeLog(text) {
    var pre = $('#log');
    pre.text(pre.text() + '\n' + text);
  }

  storage.addEventListener('change', storageEvent);
  storage.addEventListener('multiplechange', storageEvent);
  storage.addEventListener('delete', storageEvent);

  $('#add-newapp').click(function () {
    var val = $('#newapp').val();
    if (val.indexOf('{') == -1) {
      var manifest = {base_url: val};
    } else {
      var manifest = eval('(' + val + ')');
    }
    storage.open('app').put(manifest.base_url, manifest);
    $('#newapp').val('');
  });

  $('#run-sync').click(function () {
    sync.pull({
      success: function () {
        writeLog('pull successful.');
        sync.push({
          success: function () {
            writeLog('push successful.');
          }
        });
      }
    });
  });

  $('#clear-log').click(function () {
    $('#log').text('');
  });

  $('#show-storage').click(function () {
    var s = localStorage;
    var keys = [];
    for (var i=0; i<s.length; i++) {
      keys.push(s.key(i));
    }
    keys.sort();
    for (i=0; i<keys.length; i++) {
      var value = localStorage.getItem(keys[i]);
      writeLog(keys[i] + '=' + value);
    }
  });

  $('#clear-storage').click(function () {
    localStorage.clear();
    writeLog('storage cleared');
  });

  $('#clear-sync').click(function () {
    sync.clearServer({
      success: function () {
        writeLog('sync server cleared');
      }
    });
  });

  $('#title').text($('#title').text() + ' ' + location.host);

  function syncStore() {
    storage.open('app').iterate(function (url, value) {
      if (! $('#installed #' + makeId(url)).length) {
        addManifest(value);
      }
    });

    storage.open('deletedapp').iterate(function (url, value) {
      if (! $('#deleted #' + makeId(url)).length) {
        addDeleted(url);
      }
    });
  }

  syncStore();

});

