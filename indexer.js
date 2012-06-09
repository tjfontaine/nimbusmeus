var _path = require('path');
var _fs = require('fs');

var walk = require('walkdir');
var vlc = require('vlc')([
  '-I', 'dummy',
  '-V', 'dummy',
  //'--verbose', '3',
  '--no-audio',
  '--no-stats',
  '--no-sub-autodetect-file',
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

  walk(ipath, { no_recurse: true })
    .on('error', function () {})
    .on('file', function (path, stat) {
      var result;

      if (!self.shouldIgnore(path)) {
        files.push({
          path: path,
          stat: stat,
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
      var f = [], fn = {};

      if (files.length === 0) {
        cb(null, {
          files: files,
          dirs: dirs,
        });
        return;
      }

      files.forEach(function (file) {
        f.push(file.path);
        fn[file.path] = file.stat;
      });

      files = [];

      db.mediaGetAll(f, function (err, rows) {
        rows.forEach(function (row) {
          var result = JSON.parse(row.value);
          var mtime = JSON.stringify(fn[row.key].mtime).replace(/"/g, '');

          if (result.stat && result.stat.mtime == mtime) {
            var idx = f.indexOf(row.key);
            f = f.splice(idx, 1);
            files.push(result);
          }
        });

        f.forEach(function (path) {
          var result = self.processFile(path);
          result.stat = fn[path];
          db.mediaSet(path, result);
          files.push(result);
        });

        cb(null, {
          dirs: dirs,
          files: files,
        });
      });
    });
};

Index.prototype.processFile = function (file, cb) {
  var result = { path: file }, foundVideo, foundAudio;

  var media = vlc.mediaFromFile(file);
  media.parseSync();

  vlc.mediaFields.forEach(function (field) {
    result[field] = media[field];
  });

  try {
    result.duration = media.duration;
  } catch(e) {}

  media.track_info.forEach(function (info) {
    switch (info.type) {
      case 'audio':
        foundAudio = true;
        break;
      case 'video':
        foundVideo = true;
        break;
    }
  });

  if (foundVideo) {
    result.type = 'video';
  } else if (foundAudio) {
    result.type = 'audio';
  }

  media.release();

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
};

Index.prototype.thumbnail = function (path, cb) {
  var file_dest = _path.join(config.TMPDIR, 'thumbnail', _path.basename(path)) + '.png';

  _fs.stat(file_dest, function (err, stat) {
    if (!err) {
      cb(err, file_dest);
      return;
    }

    var player = vlc.mediaplayer;
    var media = vlc.mediaFromFile(path);

    player.media = media;

    player.play();
    // Set thumbnail position as 1 second
    player.time = 1000;

    // Wait for it to advance 100ms
    while (player.time < 1100) {
    }

    try {
      player.video.take_snapshot(0, file_dest, player.video.width, player.video.height);
    } catch (e) {
      console.log(e);
    }

    player.stop();
    media.release();

    cb(err, file_dest);
  });
};

module.exports = new Index();
