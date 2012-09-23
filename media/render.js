process.title = "NimbusMeus-render";

var _path = require('path');
var _fs = require('fs');

var util = require('./util');

var vlc = require('vlc')([
  '-I', 'dummy',
  '--audio-language', 'eng',
  '--quiet',
]);
var vlm = vlc.vlm;

var parent = require('./ipc')(process);
var config = require('../config');

var first = true;

var poll = setInterval(function () {
}, config.MAX_IDLE);

parent.on('pause', function () {
  var err, result;
  try {
    result = vlm.pauseMedia('Render');
  } catch (e) {
    err = e;
  } finally {
    parent.send('paused', err, result);
  }
});

parent.on('stop', function () {
  var err, result;
  try {
    result = vlm.stopMedia('Render');
  } catch(e) {
    err = e;
  } finally {
    parent.send('stopped', err, result);
  }
});

parent.on('die', function () {
  try {
    vlm.stopMedia('Render');
  } catch (e) {}

  clearInterval(poll);
  process.exit();
});

parent.on('play', function (opts) {
  var tmpdir = util.tmpdir(opts.sess);
  var monitor = {};

  try {
    _fs.mkdirSync(tmpdir);
  } catch (e) {
  }

  monitor.path = _path.join(tmpdir, 'stream.m3u8');
  monitor.url = 'stream.m3u8';

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
    sout += 'seglen=3,';
  }  else {
    sout += 'seglen=1,';
  }

  if (opts.live) {
    sout += 'delsegs=true,numsegs=10,';
  } else {
    sout += 'delsegs=false,numsegs=0,';
  }

  sout += 'ratecontrol=true,';
  sout += 'index=' + monitor.path + ',';
  // TODO XXX FIXME this should be opts.mount
  sout += 'index-url=http://' + opts.host + '/media/stream/' + opts.sess + '/########.ts';
  sout += '},';

  if (opts.type === 'audio') {
    sout += 'mux=raw,';
  } else {
    sout += 'mux=ts{use-key-frames},';
  }

  sout += 'dst=' + _path.join(tmpdir, '########.ts');
  sout += '},';

  if (opts.type === 'audio') {
    sout += 'select=audio}';
  }

  if (first) {
    vlm.addBroadcast('Render', opts.mrl, sout, [], true, false);
    first = false;
  } else {
    vlm.changeMedia('Render', opts.mrl, sout, [], true, false);
  }

  vlm.playMedia('Render');

  parent.send('played', null, monitor);
});
