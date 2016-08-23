var connect = require('camo').connect,
    slack   = require('slack'),
    _       = require('lodash');

// Configs
var config = require('./config'),
    token  = config.slackToken,
    dbUri  = config.dbUri;

// Models
var Channel = require('./models/channel'),
    Pin     = require('./models/pin'),
    User    = require('./models/user');

// Cron
var CronJob = require('cron').CronJob,
    random5Min  = Math.floor(Math.random() * 5) + 0,
    randomMin   = Math.floor(Math.random() * 60) + 0,
    randomHr    = Math.floor(Math.random() * 24) + 0,
    every5mins  = random5Min + '-59/5 * * * *',
    every24hrs  = randomMin + ' ' + randomHr + ' * * *';

// Slack functions
function getChannels() {
  slack.channels.list({token}, (err, data) => {
    _.forEach(data.channels, (c) => {
      var channel = Channel.create({
        sId  : c.id,
        name : c.name
      });

      Channel.count({sId: c.id}).then((count) => {
        if (count === 0) channel.save();
      });
    });
  });
}

function getUsers() {
  slack.users.list({token}, (err, data) => {
    _.forEach(data.members, (u) => {
      var user = User.create({
        sId    : u.id,
        name   : u.name,
        avatar : u.profile.image_24
      });

      User.count({sId: u.id}).then((count) => {
        if (count === 0) user.save();
      });
    });
  });
}

function getPins() {
  Channel.find().then((channels) => {
    _.forEach(channels, (channel) => {
      slack.pins.list({token, channel: channel.sId}, (err, data) => {
        if (data.items == null || data.items.length === 0) return;
        _.forEach(data.items, (p) => {
          if (p.message == null) return;
          if (p.message.user == null) return;

          var id  = p.message.ts.replace('.', ''),
              pin = Pin.create({
                sId       : id,
                message   : p.message.text,
                channelId : p.channel,
                userId    : p.message.user,
                ts        : p.message.ts,
                permalink : p.message.permalink,
                votes     : [],
                comments  : {}
              });

          Pin.count({sId: id}).then((count) => {
            if (count === 0) {
              pin.save();
            } else {
              Pin.findOne({sId: id}).then((oPin) => {
                _.forEach(Object.keys(pin), (key) => {
                  if (key.startsWith('_')) return;
                  oPin[key] = pin[key];
                });
                oPin.save();
              });
            }
          });
        });
      });
    });
  });
}

// Magic
var database;
connect(dbUri).then(function(db) {
  database = db;

  var channelTask = new CronJob(every24hrs, getChannels, null, true),
      pinTask     = new CronJob(every5mins, getPins, null, true),
      userTask    = new CronJob(every24hrs, getUsers, null, true);

  getChannels();
  getUsers();
  getPins();
});
