
/**
 * Module dependencies.
 */

var express = require('express')
  , fs = require('fs')
  , routes = require('./routes')
  , path = require('path');

var remove = require('remove');

var config = require('../config');

var app = module.exports = express();

// Configuration

var streamer = require('./streamer');

app.configure(function(){
  //app.use(express.logger());
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(function (req, res, next) {
    if (!req.session.hash) {
      req.session.hash = require('crypto').createHash('md5')
        .update(req.session.id)
        .digest('hex');
    }
    streamer.touch(req.session.hash);
    next();
  });
  app.use(app.router);
});

// Routes

app.get('/', routes.index);
app.get('/b/*', routes.listing);
app.get('/v/*', routes.view);
app.get('/stream/:session/*', routes.stream);
app.get('/nowplaying', routes.nowplaying);

app.get('/tv/:device/:tuner', routes.tv);
app.get('/view/tv/:device/:tuner/:channel/:program', routes.tv_view);

app.get('/settings', routes.settings);
app.post('/settings', routes.settings_save);

app.get('/thumbnail/*', routes.thumbnail);

try {
  fs.mkdirSync(config.TMPDIR);
} catch (e) {
}

try {
  fs.mkdirSync(path.join(config.TMPDIR, 'thumbnail'));
} catch (e) {
}

try {
  remove.removeSync(path.join(config.TMPDIR, 'stream'));
} catch (e) {
  console.log(e);
}

try {
  fs.mkdirSync(path.join(config.TMPDIR, 'stream'));
} catch (e) {
  console.log(e);
}

process.on('SIGINT', function () {
  streamer.killall();
  process.exit();
});
