process.title = "NimbusMeus";

var express = require('express'),
    fs = require('fs'),
    auth = require('connect-auth');

var config = require('./config');

var app = module.exports = express();

var authenticatedContent= fs.readFileSync( __dirname+"/public/authenticated.html", "utf8" );
var unAuthenticatedContent= fs.readFileSync( __dirname+"/public/unauthenticated.html", "utf8" );

var example_auth_middleware= function() {
  return function(req, res, next) {
    var urlp= url.parse(req.originalUrl, true)
    if( urlp.query.login_with ) {
      req.authenticate([urlp.query.login_with], function(error, authenticated) {
        if( error ) {
          // Something has gone awry, behave as you wish.
          console.log( error );
          res.end();
      }
      else {
          if( authenticated === undefined ) {
            // The authentication strategy requires some more browser interaction, suggest you do nothing here!
          }
          else {
            // We've either failed to authenticate, or succeeded (req.isAuthenticated() will confirm, as will the value of the received argument)
            next();
          }
      }});
    }
    else {
      next();
    }
  }
};

app.configure(function () {
  app.use(express.cookieParser());
  app.use(express.session({ secret: "keyboard cat" }));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(auth({
    strategies: [
      auth.Openid({callback: openIdCallback}),
    ],
    trace: true,
    logoutHandler: require('connect-auth/lib/events').redirectOnLogout('/'),
  }));
  app.use('/logout', function (req, res, params) {
    req.logout();
  });
  app.use("/", function(req, res, params) {
    res.writeHead(200, {'Content-Type': 'text/html'})
    if(req.isAuthenticated()) {
      res.end( authenticatedContent.replace("#USER#",
        JSON.stringify(req.getAuthDetails().user)
      ));
    } else {
      res.end(unAuthenticatedContent.replace("#PAGE#", req.originalUrl));
    }
  });
  app.use('/media', require('./media/app'));
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

app.listen(8000);
