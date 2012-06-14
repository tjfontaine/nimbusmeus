var _events = require('events');

var IPCEvent = function (ipc) {
  if (!(this instanceof IPCEvent))
    return new IPCEvent(ipc);

  var self = this;

  ipc.on('message', function (data) {
    self.emit.apply(self, [data.command].concat(data.args));
  });

  this.send = function () {
    var args = Array.prototype.slice.call(arguments, 1);
    var cmd = {
      command: arguments[0],
      args: args,
    };
    ipc.send(cmd);
  };
};
require('util').inherits(IPCEvent, _events.EventEmitter);

module.exports = IPCEvent;
