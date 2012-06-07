var _path = require('path');

var walk = require('walkdir');
var vlc = require('vlc');

var config = require('./config');
var db = require('./db');

var ignore_regexps = [];
config.ignore.forEach(function (pat) {
  ignore_regexps.push(new RegExp(pat, 'i'));
});

var Index = function () {};

Index.prototype.get = function (path, cb) {
  var self = this;

  db.mediaGet(path, function (err, result) {
    if (result) {
      cb(err, JSON.parse(result.value));
      return;
    }

    self.index(path, function (err, result) {
      cb(err, result);
    });
  });
};

Index.prototype.index = function (ipath, cb) {
  var self = this, files = [], dirs = [];

  walk(ipath, { no_recurse: true })
    .on('error', function () {})
    .on('file', function (path, stat) {
      var result;
      if (!self.shouldIgnore(path)) {
        result = self.processFile(path);
        files.push(result);
        db.mediaSet(path, result);
      }
    })
    .on('directory', function (path, stat) {
      if (!self.shouldIgnore(path)) {
        dirs.push({
          path: path,
        });
      }
    })
    .on('end', function () {
      var result = { files: files, dirs: dirs };
      db.mediaSet(ipath, result);
      cb(null, result);
    });
};

Index.prototype.processFile = function (file, cb) {
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

Index.prototype.shouldIgnore = function (path) {
  var ignore = false;
  var reg, m;
  for (m in ignore_regexps) {
    reg = ignore_regexps[m];
    ignore = reg.test(_path.basename(path));
    if (ignore) {
      break;
    }
  }
  return ignore;
}

module.exports = new Index();
