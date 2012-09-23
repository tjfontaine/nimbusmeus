var _fs = require('fs');
var _cp = require('child_process');
var _os = require('os');
var _net = require('net');

var config = require('../config');

exports.parse = function (file, cb) {
  _fs.readFile(file, 'utf8', function (err, data) {
    var scanning;
    var channels = [];

    if (err) {
      cb(err, null);
      return;
    }


    data.split(/\r?\n/).forEach(function (line) {
      var parts = line.split(' ');
      switch (parts[0]) {
        case 'SCANNING:':
          scanning = parts[1];
          break;
        case 'LOCK:':
        case 'TSID:':
          break;
        case 'PROGRAM':
          if (parts[2] !== '0') {
            channels.push({
              virtual: parts[2],
              description: parts[3],
              channel: scanning,
              program: parts[1].replace(/:$/, ''),
            });
          }
          break;
      }
    });

    channels = channels.sort(function (a, b) {
      return parseFloat(a.virtual) > parseFloat(b.virtual) ? 1 : -1;
    });

    cb(null, channels);
  });
};

exports.tune = function (opts, cb) {
  _cp.execFile(config.hdhomerun_config, [
    opts.device,
    'set',
    '/tuner' + opts.tuner + '/channel',
    'auto:' + opts.channel,
  ], function (error, stdout, stderr) {
    if (error) {
      error.stdout = stdout;
      error.stderr = stderr;
      cb(error);
      return;
    }
    _cp.execFile(config.hdhomerun_config, [
      opts.device,
      'set',
      '/tuner' + opts.tuner + '/program',
      opts.program,
    ], function (error, stdout, stderr) {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
      }
      cb(error);
    });
  });
};

exports.stream = function (opts, cb) {
  var ip = config.hdhomerun_dest_ip;

  if (!ip) {
    var interfaces = _os.networkInterfaces();
    for (i in interfaces) {
      var inf = interfaces[i];
      if (!/^lo/.test(i)) {
        for (j in inf) {
          jaddress = inf[j].address;
          if (_net.isIPv4(jaddress)) {
            ip = jaddress;
            break;
          }
        }
      }
    }
  }

  console.log('streaming hdhomerun to', ip);

  _cp.execFile(config.hdhomerun_config, [
    opts.device,
    'set',
    '/tuner' + opts.tuner + '/target',
    'udp://' + ip + ':5000',
  ]).on('exit', function (signal) {
    cb();
  });
};
