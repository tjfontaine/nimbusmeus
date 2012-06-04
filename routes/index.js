var _path = require('path');
var _fs = require('fs');

var walk = require('walkdir');

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

/*
 * GET home page.
 */

var hashit = function (data) {
  var md5 = require('crypto').createHash('md5');
  return md5.update(data).digest('hex');
};

if(typeof(String.prototype.trim) === "undefined")
{
  String.prototype.trim = function() 
  {
    return String(this).replace(/^\s+|\s+$/g, '');
  };
}

exports.index = function(req, res){
  res.render('index', {
    title: 'NimbusMeus',
    collections: collections,
    hdhomerun: hdhomeruns,
  });
};

var toSystem = function (spath) {
  var result = {
    original: spath,
  };
  if (spath) {
    spath = spath.split('/');
    result.root = config.collections[spath[0]];
    result.collection = spath[0];
    if (result.root) {
      result.path = _path.join.apply(null, spath.slice(1));
      result.path = _path.join(result.root, result.path);
      result.path = _path.normalize(result.path);
    }
  }
  return result;
}

var toRelative = function (path, spath) {
  return path.replace(spath.root, spath.collection);
}

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
          path: toRelative(path, spath),
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
      console.log(arguments);
    })
    .on('end', function () {
      var compare = function (a, b) {
        var ret = a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
        return ret;
      }

      files = files.sort(compare);
      dirs = dirs.sort(compare);

      res.render('listing', {
        title: title,
        dirs: dirs,
        files: files,
      });
    });
  } else {
    console.log('no spath', spath);
    res.render('listing', { title: title, dirs: [], files: [], root: '' });
  }
};

exports.view = function (req, res) {
  var title = 'Viewing: ';
  var sessid = req.session.hash;
  var waiting = true;
  var montior, ext, timeoud, timerid, canRender;

  var spath = toSystem(req.params[0]);

  if (!sessid) {
    req.session.hash = hashit(req.session.id);
    sessid = req.session.hash;
  }

  if (spath.path) {
    title += _path.basename(spath.path);

    ext = _path.extname(spath.path).toLowerCase().replace('.', '');
    ext = valid_extensions[ext];

    monitor = streamer.play({
      sess: sessid,
      mrl: spath.path,
      host: req.headers.host,
      settings: req.session.settings,
      type: ext,
    });
  }

  if (!monitor) {
    res.send('back');
  } else {
    streamer.waitStream(monitor.path, 15000, function (err) {
      if (err) {
        console.log(err);
        res.redirect('back');
        return;
      }

      res.render('view', {
        title: title,
        path: monitor.url,
      });
    });
  }
};

exports.stream = function (req, res) {
  var path = req.params[0];
  var sessid = req.session.hash;
  var sm = RegExp('^'+sessid);

  if (!sessid || !sm.test(path)) {
    res.send(403);
    return;
  }

  streamer.touch(sessid);

  var file = _path.normalize(
                _path.join(__dirname,
                           '..',
                           'stream',
                           _path.join.apply(null, path.split('/'))
                          )
              );

  _fs.stat(file, function (err, stat) {
    if (err) {
      console.log(404, file);
      res.send(404);
    } else {
      res.sendfile(file);
    }
  });
};

exports.settings = function (req, res) {
  var settings = req.session.settings;

  if (!req.session.settings) {
    settings = req.session.settings = {};
  }

  res.render('settings', {
    title: 'Settings',
    bandwidth: settings.bandwidth ? settings.bandwidth : 0,
    fps: settings.fps ? settings.fps : 0,
    width: settings.width ? settings.width : 0,
    height: settings.height ? settings.height : 0,
  });
};

exports.settings_save = function (req, res) {
  var settings = req.session.settings;

  if (!settings) {
    settings = req.session.settings = {};
  }

  settings.bandwidth = req.body.bandwidth;
  settings.fps = req.body.fps;
  settings.width = req.body.width;
  settings.height = req.body.height;

  req.session.save();

  res.redirect('back');
};

exports.tv = function (req, res) {
  var tunerfile = config.hdhomerun[req.params.device].tuners[req.params.tuner];

  hdhomerun.parse(tunerfile, function (err, channels) {
    if (err) {
      console.log(err);
      res.redirect('back');
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

  if (!sessid) {
    req.session.hash = hashit(req.session.id);
    sessid = req.session.hash;
  }

  hdhomerun.tune(req.params, function (err) {
    if (err) {
      console.log(err);
      res.redirect('back');
      return;
    }

    var monitor = streamer.play({
      sess: sessid,
      mrl:  'udp://@:5000',
      type: 'video',
      live: true,
      host: req.headers.host,
      settings: req.session.settings,
    });

    hdhomerun.stream(req.params, function (err) {
      if (err) {
        console.log(err);
        res.redirect('back');
        return;
      }
      streamer.waitStream(monitor.path, 30000, function (err) {
        if (err) {
          console.log(err);
          res.redirect('back');
          return;
        }
        res.render('view', {
          title: 'Live TV',
          path: monitor.url,
        });
      });
    });
  });
};
