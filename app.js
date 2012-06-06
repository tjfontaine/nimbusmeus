
/**
 * Module dependencies.
 */

var express = require('express')
  , fs = require('fs')
  , routes = require('./routes');
var FSStore = require('connect-fs')(express);

var remove = require('remove');

var config = require('./config');

var app = module.exports = express.createServer();

// Configuration

var streamer = require('./vlc');

app.configure(function(){
  app.use(express.logger());
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.cookieParser());
  //app.use(express.session({
  //  store: new FSStore,
  //  secret: 'keyboard cat',
  //  cookie: { maxAge: 1 * 60 * 60 * 1000 }
  //}));
  app.use(express.session({ secret: "keyboard cat" }));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(function (req, res, next) {
    streamer.touch(req.session.id);
    next();
  });
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', routes.index);
app.get('/b/*', routes.listing);
app.get('/v/*', routes.view);
app.get('/stream/*', routes.stream);

app.get('/tv/:device/:tuner', routes.tv);
app.get('/view/tv/:device/:tuner/:channel/:program', routes.tv_view);

app.get('/settings', routes.settings);
app.post('/settings', routes.settings_save);

console.log('Removing temporary folder');

try {
  remove.removeSync(config.TMPDIR);
} catch (e) {
  console.log(e);
}

console.log('Recreating temporary folder');
try {
  fs.mkdirSync(config.TMPDIR);
} catch (e) {
  console.log(e);
}

app.listen(8000, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});

process.on('SIGINT', function () {
  streamer.killall();
  process.exit();
});
