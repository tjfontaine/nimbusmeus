var _path = require('path');
var _fs = require('fs');

var walk = require('walkdir');

var config = require('../config');
var streamer = require('../vlc');

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
      bandwidth: req.session.bandwidth,
      type: ext,
    });
  }

  if (!monitor) {
    res.send('back');
  } else {
    timedout = false;
    canRender = function () {
      if (timedout) {
        res.send('back');
        return;
      }

      _fs.stat(monitor.path, function (err, stat) {
        if (err) {
          setTimeout(function () { canRender(); }, 200);
        } else {
          clearTimeout(timerid);
          res.render('view', {
            title: title,
            path: monitor.url,
          });
        }
      });
    };

    canRender();

    timerid = setTimeout(function () {
      timedout = true;
    }, 15000);
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
      res.send(404);
    } else {
      res.sendfile(file);
    }
  });
};

exports.settings = function (req, res) {
  res.render('settings', {
    title: 'Settings',
    bandwidth: req.session.bandwidth ? req.session.bandwidth : 0,
  });
};

exports.settings_save = function (req, res) {
  req.session.bandwidth = req.body.bandwidth;
  res.redirect('back');
};
