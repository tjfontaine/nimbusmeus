var path = require('path');

var sqlite = require('sqlite3');

var config = require('./config');

var ndb = function () {
  var db = new sqlite.Database(path.join(config.TMPDIR, 'nimbusmeus.db'));

  db.serialize(function () {
    db.run('CREATE TABLE IF NOT EXISTS media (key text, value text)');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS media_idx ON media (key)');
  });

  this.mediaGet = function (key, cb) {
    db.get('SELECT value FROM media WHERE key = ?', key, function (err, row) {
      cb(err, row);
    });
  };

  this.mediaSet = function (key, value) {
    db.run('INSERT OR REPLACE INTO media (key, value) VALUES (?, ?)',
      key, JSON.stringify(value));
  };
};

module.exports = new ndb();
