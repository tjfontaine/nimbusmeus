var _path = require('path');

var walk = require('walkdir');
var vlc = require('vlc');

var config = require('./config');
var db = require('./db');

var shouldIgnore = function (path) {
  var ignore = false;
  var reg, pat, m;
  for (m in config.ignore) {
    pat = config.ignore[m];
    reg = new RegExp(pat, "i");
    ignore = reg.test(_path.basename(path));
    if (ignore) {
      break;
    }
  }
  return ignore;
}

var processFile = function (file, cb) {
  var result = { path: file };

  var media = vlc.mediaFromFile(file);
  media.parseSync();

  vlc.mediaFields.forEach(function (field) {
    result[field] = media[field];
  });

  try {
    result.duration = media.duration;
  } catch(e) {}

  return result;
};

var index = function (ipath) {
  var files = [], dirs = [];

  walk(ipath, { no_recurse: true })
    .on('error', function () {})
    .on('file', function (path, stat) {
      var result;
      if (!shouldIgnore(path)) {
        result = processFile(path);
        files.push(result);
        db.mediaSet(path, result);
      }
    })
    .on('directory', function (path, stat) {
      if (!shouldIgnore(path)) {
        dirs.push({
          path: path,
        });
        index(path);
      }
    })
    .on('end', function () {
      db.mediaSet(ipath, { files: files, dirs: dirs });
    });
};

Object.keys(config.collections).forEach(function (key) {
  index(config.collections[key]);
});
