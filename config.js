var path = require('path');

exports.collections = {
  'Media Storage': '/Volumes/Media Storage',
  'iTunes': '/Users/tjfontaine/Music/iTunes/iTunes Media/Music',
};

exports.formats = {
  audio: ['mp3', 'm4a', 'ogg'],
  video: ['mkv', 'm4v', 'avi'],
};

exports.ignore = [
  '^\\.',
  '^Temporary Items',
  '^Network Trash Folder',
];

exports.hdhomerun = {
  'Upstairs': {
    id: '1030B85A',
    tuners: {
      0: path.join(__dirname, '1030B85A_0.scan'),
    },
  },
};

exports.hdhomerun_config = '/usr/bin/hdhomerun_config';
exports.hdhomerun_dest_ip = '192.168.2.61';

exports.vlc = '/Applications/VLC.app/Contents/MacOS/VLC';

exports.MAX_IDLE = 300000;

exports.TMPDIR = path.join(__dirname, 'stream');
