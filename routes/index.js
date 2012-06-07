var _path = require('path');
var _fs = require('fs');

var walk = require('walkdir');

var util = require('../util');

var toSystem = util.toSystem;
var toRelative = util.toRelative;

var config = require('../config');
var streamer = require('../vlc');
var hdhomerun = require('../hdhomerun');

var collections = [];
Object.keys(config.collections).forEach(function (collection) {
  collections.push({
    name: collection,
    path: config.collections[collection],
  });
});

var valid_extensions = {};
Object.keys(config.formats).forEach(function (type) {
  config.formats[type].forEach(function (ext) {
    valid_extensions[ext] = type;
  });
});

var hdhomeruns = [];
Object.keys(config.hdhomerun).forEach(function(device) {
  var hd = config.hdhomerun[device];
  hdhomeruns.push({
    id: hd.id,
    name: device,
    tuners: Object.keys(hd.tuners),
  });
});

var index = require('../indexer');

exports.index = function(req, res){
  res.render('index', {
    title: 'NimbusMeus',
    collections: collections,
    hdhomerun: hdhomeruns,
  });
};

exports.listing = function (req, res) {
  var spath = toSystem(req.params[0]);
  index.get(spath.path || 'DNE', function (err, d) {
    if (err) {
      res.render('error', {
        title: 'Error in Listing',
        error: err,
      });
      return;
    }

    d.dirs.forEach(function (dir) {
      dir.name = _path.basename(dir.path);
      dir.path = toRelative(dir.path, spath);
    });

    d.files.forEach(function (file) {
      file.name = _path.basename(file.path);
      file.path = toRelative(file.path, spath);
      var x = file.duration / 1000
      file.seconds = parseInt(x % 60).toString();
      x /= 60
      file.minutes = parseInt(x % 60).toString();
      x /= 60
      file.hours = parseInt(x % 24)
      if (file.minutes.length === 1) file.minutes = '0' + file.minutes;
      if (file.seconds.length === 1) file.seconds = '0' + file.seconds;
    });

    var compare = function (a, b) {
      return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
    }

    res.render('listing', {
      title: _path.basename(spath.path),
      dirs: d.dirs.sort(compare),
      files: d.files.sort(compare),
   });
  });
};

exports.view = function (req, res) {
  var title = 'Viewing: ';
  var sessid = req.session.hash;
  var waiting = true;
  var montior, ext, timeoud, timerid, canRender;

  var spath = toSystem(req.params[0]);

  if (spath.path) {
    title += _path.basename(spath.path);

    ext = _path.extname(spath.path).toLowerCase().replace('.', '');
    ext = valid_extensions[ext];

    streamer.play({
      sess: sessid,
      mrl: spath.path,
      host: req.headers.host,
      settings: req.session.settings || {},
      type: ext,
    }, function (err, monitor) {
      streamer.waitStream(monitor.path, 15000, function (err) {
        if (err) {
          res.render('error', {
            title: 'Streaming Error',
            error: err,
          });
          return;
        }

        res.render('view', {
          title: title,
          path: monitor.url,
        });
      });
    });;
  }
};

exports.stream = function (req, res) {
  var path = req.params[0];
  var sessid = req.session.hash;

  var file = _path.normalize(_path.join(
    util.tmpdir(), sessid, _path.join.apply(null, path.split('/')
  )));

  res.sendfile(file);
};

exports.settings = function (req, res) {
  var settings = req.session.settings || {};

  res.render('settings', {
    title: 'Settings',
    refer: req.header('Referrer'),
    bandwidth: settings.bandwidth ? settings.bandwidth : 0,
    fps: settings.fps ? settings.fps : 0,
    width: settings.width ? settings.width : 0,
    height: settings.height ? settings.height : 0,
  });
};

exports.settings_save = function (req, res) {
  var settings = req.session.settings || {};

  settings.bandwidth = req.body.bandwidth;
  settings.fps = req.body.fps;
  settings.width = req.body.width;
  settings.height = req.body.height;

  req.session.settings = settings;

  req.session.save();

  if (req.body.refer) {
    res.redirect(req.body.refer);
  } else {
    res.render('settings', {
      title: 'Settings',
      refer: req.header('Referrer'),
      bandwidth: settings.bandwidth ? settings.bandwidth : 0,
      fps: settings.fps ? settings.fps : 0,
      width: settings.width ? settings.width : 0,
      height: settings.height ? settings.height : 0,
    });
  }
};

exports.tv = function (req, res) {
  var tunerfile = config.hdhomerun[req.params.device].tuners[req.params.tuner];

  hdhomerun.parse(tunerfile, function (err, channels) {
    if (err) {
      res.render('error', {
        title: 'TV Parse Error',
        error: err,
      });
      return;
    }

    res.render('tv', {
      title: 'TV Channels',
      channels: channels,
      device: config.hdhomerun[req.params.device].id,
      tuner: req.params.tuner,
    });
  });
};

exports.tv_view = function (req, res) {
  var sessid = req.session.hash;

  hdhomerun.tune(req.params, function (err) {
    if (err) {
      res.render('error', {
        title: 'TV View Error',
        error: err,
      });
      return;
    }

    streamer.play({
      sess: sessid,
      mrl:  'udp://@:5000',
      type: 'video',
      live: true,
      host: req.headers.host,
      settings: req.session.settings || {},
    }, function (err, monitor) {

      hdhomerun.stream(req.params, function (err) {
        if (err) {
          res.render('error', {
            title: 'HDHomeRun Stream Error',
            error: err,
          });
          return;
        }
        streamer.waitStream(monitor.path, 30000, function (err) {
          if (err) {
            res.render('error', {
              title: 'HDHomeRun Stream Wait Error',
              error: err,
            });
            return;
          }
          res.render('view', {
            title: 'Live TV',
            path: monitor.url,
          });
        });
      });
    });
  });
};
