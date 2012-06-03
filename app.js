
/**
 * Module dependencies.
 */

var express = require('express')
  , fs = require('fs')
  , routes = require('./routes');

var remove = require('remove');

var config = require('./config');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.cookieParser());
  app.use(express.session({ secret: "keyboard cat" }));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
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
