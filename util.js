var _path = require('path');

var config = require('./config');

exports.toSystem = function (spath) {
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

exports.toRelative = function (path, spath) {
  return path.replace(spath.root, spath.collection);
}

exports.tmpdir = function (sess) {
  return _path.normalize(_path.join(config.TMPDIR, 'stream', sess));
};
