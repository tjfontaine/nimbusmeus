process.title = "NimbusMeus";

var express = require('express');

var config = require('./config');

var app = module.exports = express();

app.configure(function () {
  app.use('/media', require('./media/app'));
  app.use(express.static(__dirname + '/public'));
});

app.listen(8000);
