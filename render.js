var _path = require('path');
var _fs = require('fs');

var util = require('./util');

var vlc = require('vlc');
var vlm = vlc.vlm;

var play = function (opts) {
  var tmpdir = util.tmpdir(opts.sess);
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

  vlm.addBroadcast('Render', opts.mrl, sout, [], true, false);
  vlm.playMedia('Render');

  return monitor;
};

var poll = setInterval(function () {
  console.log(vlm.showMedia('Render'));
}, 30000);

process.on('message', function (data) {
  switch (data.command) {
    case 'PLAY':
      process.send({
        command: 'PAUSE',
        result: play(data.opts),
      });
      break;
    case 'PAUSE':
      process.send({
        command: 'PAUSE',
        result: vlm.pauseMedia('Render'),
      });
      break;
    case 'STOP':
      process.send({
        command: 'STOP',
        result: vlm.stopMedia('Render'),
      });
      break;
  }
});