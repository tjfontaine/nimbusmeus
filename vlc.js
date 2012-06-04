var _path = require('path');
var _cp = require('child_process');
var _fs = require('fs');

var remove = require('remove');

var config = require('./config');

var Streamer = function () {
  var self = this;
  this.running = {};
  var gc = function () {
    Object.keys(self.running).forEach(function (sess) {
      var now = new Date().getTime();
      var last = self.running[sess].lastAccess;
      var delta = now - last;
      if (delta > config.MAX_IDLE) {
        console.log(sess, now, last, delta, config.MAX_IDLE);
        self.kill(sess);
      }
    });
  };
  //TODO FIXME XXX Re-enable sometime
  //setInterval(gc, config.MAX_IDLE/2);
};

Streamer.prototype.tmpdir = function (sess) {
  return _path.normalize(_path.join(config.TMPDIR, sess));
};

Streamer.prototype.touch = function (sess) {
  var instance = this.running[sess];
  if (instance) {
    instance.lastAccess = new Date().getTime();
  }
};

Streamer.prototype.kill = function (sess) {
  var instance = this.running[sess];
  if (instance && instance.proc) {
    console.log('killing', sess);
    instance.proc.kill('SIGKILL');
    instance.proc = undefined;
    delete this.running[sess];
  }

  try {
    remove.removeSync(this.tmpdir(sess));
  } catch (e) {
  }
};

Streamer.prototype.newInstance = function (sess) {
  this.kill(sess);
  var instance = this.running[sess] = {};
  this.touch(sess);
  return instance;
};

Streamer.prototype.play = function (opts) {
  var instance = this.newInstance(opts.sess);
  var tmpdir = this.tmpdir(opts.sess);
  var monitor = {};

  try {
    _fs.mkdirSync(tmpdir);
  } catch (e) {
    console.log(e);
  }

  monitor.path = _path.join(tmpdir, 'stream.m3u8');
  monitor.url = '/stream/'+ opts.sess + '/stream.m3u8';

  sout  = '#transcode{';

  if (opts.type === 'video') {
    if (opts.settings.bandwidth) {
      sout += 'vb=' + opts.settings.bandwidth + ',';
    }

    if (opts.settings.fps) {
      sout += 'fps=' + opts.settings.fps + ',';
    }

    if (opts.settings.width) {
      sout += 'width=' + opts.settings.width + ',';
    }

    if (opts.settings.height) {
      sout += 'height=' + opts.settings.height + ',';
    }

    sout += 'vcodec=h264,venc=x264{aud,profile=baseline,level=30,keint=30,ref=1},';
  }

  sout += 'acodec=mp3,ab=128,channels=2';
  sout += '}';
  sout += ':';

  if (opts.type === 'audio') {
    sout += 'duplicate{';
    sout += 'dst=';
  }

  sout += 'std{';
  sout += 'access=livehttp{';

  if (opts.type === 'audio') {
    sout += 'splitanywhere=true,';
  } 

  sout += 'seglen=1,';

  if (opts.live) {
    sout += 'delsegs=true,numsegs=10,';
  } else {
    sout += 'delsegs=false,numsegs=0,';
  }

  sout += 'ratecontrol=true,';
  sout += 'index=' + monitor.path + ',';
  sout += 'index-url=http://' + opts.host + '/stream/' + opts.sess + '/########.ts';
  sout += '},';

  if (opts.type === 'audio') {
    sout += 'mux=raw,';
  } else {
    sout += 'mux=ts{use-key-frames},';
  }

  sout += 'dst=' + tmpdir + '/' + '########.ts';
  sout += '},';

  if (opts.type === 'audio') {
    sout += 'select=audio}';
  }

  instance.proc = _cp.spawn(config.vlc, [
    '-I',
    'dummy',
    '--audio-language',
    'eng',
    opts.mrl,
    'vlc://quit',
    '--sout',
    sout,
    '--quiet',
  ]);

  instance.proc.stdout.on('data', function (data) {
    console.log(data.toString('ascii').trim());
  });

  instance.proc.stderr.on('data', function (data) {
    console.log(data.toString('ascii').trim());
  });

  return monitor;
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

module.exports = new Streamer();
