var _path = require('path');
var _cp = require('child_process');
var _fs = require('fs');

var remove = require('remove');

var config = require('./config');
var util = require('./util');

var vlc = require('vlc');

var Streamer = function () {
  this.running = {};
};

Streamer.prototype.killall = function () {
  var self = this;

  Object.keys(self.running).forEach(function (i) {
    var instance = self.running[i];
    instance.child.send({ command: 'DIE' });
    instance.child.kill('SIGKILL');
    self.stopIdle(i);
  });
};

Streamer.prototype.touch = function (sess) {
  var instance = this.running[sess];
  if (instance) {
    instance.lastAccess = new Date().getTime();
  }
};

Streamer.prototype.newInstance = function (sess) {
  var instance = this.running[sess] = {};
  this.touch(sess);

  instance.child = _cp.fork(_path.join(__dirname, 'render.js'));

  return instance;
};

Streamer.prototype.startIdle = function (sess) {
  var instance = this.running[sess];
  var self = this;

  if (instance && !instance.idle) {
    instance.idle = setInterval(function () {
      var now = new Date().getTime();
      var delta = now - instance.lastAccess;
      if (delta > config.MAX_IDLE) {
        instance.child.send({
          command: 'STOP',
        });
        self.stopIdle(sess);
      }
    }, 1 * 1000)
  }
};

Streamer.prototype.stopIdle = function (sess) {
  var instance = this.running[sess];
  if (instance && instance.idle) {
    clearInterval(instance.idle);
    instance.idle = undefined;
  }
};

Streamer.prototype.play = function (opts, cb) {
  var instance = this.running[opts.sess];

  if (!instance) {
    instance = this.newInstance(opts.sess);
  }

  this.startIdle(opts.sess);

  instance.child.send({
    command: 'STOP',
  });

  instance.child.once('message', function (data) {
    try {
      remove.removeSync(util.tmpdir(opts.sess));
    } catch (e) {
    }

    instance.child.send({
      command: 'PLAY',
      opts: opts,
    });

    instance.child.once('message', function (data) {
      cb(null, data.result);
    });
  });
};

Streamer.prototype.waitStream = function (file, timeout, cb) {
  var timerid, timedout = false;

  var canRender = function () {
    if (timedout) {
      cb(new Error("Timed out waiting on stream to start"));
      return;
    }

    _fs.stat(file, function (err, stat) {
      if (err) {
        setTimeout(function () { canRender(); }, 200);
      } else {
        clearTimeout(timerid);
        cb();
      }
    });
  };

  canRender();

  timerid = setTimeout(function () {
    timedout = true;
  }, timeout);
};

var toRelative = require('./util').toRelative;

Streamer.prototype.processFiles = function (files, cb) {
  var result = [];
  var done = 0;
  files.forEach(function (file) {
    process.nextTick(function () {
      var media = vlc.mediaFromFile(file.path);
      var title, track;

      media.parseSync();

      if (media.is_parsed) {
        title = media.title;

        if (media.tracknumber) {
          track = media.tracknumber.toString();
          if (track.length === 1) {
            track = '0' + track;
          }
          title = track + ' - ' + title;
        }
      } else {
        title = file.name;
      }

      result.push({
        name: title,
        path: toRelative(file.path, file.spath),
      });

      done++;
      if (done === files.length) {
        cb(null, result);
      }
    });
  });

  if (files.length === 0) {
    cb(null, result);
  }
};

module.exports = new Streamer();
