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

exports.index = function(req, res){
  res.render('index', {
    title: 'NimbusMeus',
    collections: collections,
    hdhomerun: hdhomeruns,
  });
};

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

exports.listing = function (req, res) {
  var spath = toSystem(req.params[0]);
  var title = 'Listing for: ';
  if (spath.path) {
    var files = [], dirs = [];
    title += spath.original;

    walk(spath.path, { no_recurse: true })
    .on('file', function (path, stat) {
      if (!shouldIgnore(path)) {
        files.push({
          name: _path.basename(path),
          path: path, //toRelative(path, spath),
          spath: spath,
        });
      }
    })
    .on('directory', function (path, stat) {
      if (!shouldIgnore(path)) {
        dirs.push({
          name: _path.basename(path),
          path: toRelative(path, spath),
        });
      }
    })
    .on('error', function (err) {
    })
    .on('end', function () {
      var compare = function (a, b) {
        var ret = a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
        return ret;
      }

      streamer.processFiles(files, function (err, files) {
        files = files.sort(compare);
        dirs = dirs.sort(compare);

        res.render('listing', {
          title: title,
          dirs: dirs,
          files: files,
        });
      });
    });
  } else {
    res.render('error', {
      title: 'Error in Listing',
      error: 'Path does not exist',
    });
  }
};

exports.view = function (req, res) {
  var title = 'Viewing: ';
  var sessid = req.session.id;
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
  var sessid = req.session.id;

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
  var sessid = req.session.id;

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
