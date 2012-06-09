var _path = require('path');

var walk = require('walkdir');
var vlc = require('vlc')([
  '-I', 'dummy',
  '-V', 'dummy',
  '--no-video-title-show',
  '--no-disable-screensaver',
  '--no-snapshot-preview',
]);

var config = require('./config');
var db = require('./db');

var ignore_regexps = [];
config.ignore.forEach(function (pat) {
  ignore_regexps.push(new RegExp(pat, 'i'));
});

var Index = function () {};

Index.prototype.get = function (path, cb) {
  var self = this;

  self.index(path, function (err, result) {
    cb(err, result);
  });
};

Index.prototype.index = function (ipath, cb) {
  var self = this, files = [], dirs = [];
  var ended = false, outstanding = 0, hadfile = false;
  var walk_result = {
    files: files,
    dirs: dirs,
  };

  walk(ipath, { no_recurse: true })
    .on('error', function () {})
    .on('file', function (path, stat) {
      var result;

      if (!self.shouldIgnore(path)) {
        hadfile = true;
        outstanding += 1;

        db.mediaGet(path, function (err, result) {
          outstanding -= 1;

          if (!result || !result.stat || stat.mtime != result.stat.mtime) {
            result = self.processFile(path);
            result.stat = stat;
            db.mediaSet(path, result);
          }

          files.push(result);
          if (ended && !outstanding) {
            cb(null, walk_result);
          }
        });
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
      //db.mediaSet(ipath, result);
      ended = true;
      if (!hadfile) {
        cb(null, walk_result);
      }
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
