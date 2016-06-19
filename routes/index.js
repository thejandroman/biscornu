var express   = require('express'),
    router    = express.Router(),
    request   = require('request-promise'),
    showdown  = require('showdown'),
    converter = new showdown.Converter(),
    Entities  = require('html-entities').XmlEntities,
    entities  = new Entities(),
    _         = require('lodash'),
    moment    = require('moment');

// Config
var config       = require('../config'),
    apiUrl       = 'http://localhost:' + config.port,
    dbUri        = config.dbUri,
    clientId     = config.clientId,
    clientSecret = config.clientSecret,
    theme        = config.theme + '/';

// DB connection
var connect = require('camo').connect,
    database;
connect(dbUri).then((db) => {
  database = db;
});

// Models
var Channel = require('../models/channel'),
    Pin     = require('../models/pin'),
    User    = require('../models/user');

function messageParser(message) {
  var decode  = entities.decode(message),
      convert = converter.makeHtml(decode);

  return convert;
}

function channelParser(channelId, rawChannels) {
  var channel = _.find(rawChannels, ['sId', channelId]);
  return channel.name;
}

function userParser(userId, rawUsers) {
  var user = _.find(rawUsers, ['sId', userId]);
  return {name: user.name, avatar: user.avatar};
}

function tsParser(ts) {
  return moment.unix(ts).fromNow();
}

function pinParser(pins, users, channels, myUser) {
  var finalPins = [];

  _.forEach(pins, (pin) => {
    finalPins.push({
      message   : messageParser(pin.message),
      channel   : channelParser(pin.channelId, channels),
      user      : userParser(pin.userId, users),
      ts        : tsParser(pin.ts),
      permalink : pin.permalink,
      id        : pin.ts.replace('.', ''),
      votes     : pin.votes.length,
      hasVoted  : _.includes(pin.votes, myUser)
    });
  });

  return(finalPins);
}

var slackCookieParser = function(req, res, next) {
  var cookie = req.cookies.slackAccessToken;

  if (cookie != null) {
    var url = 'https://slack.com/api/users.identity?token=' + cookie;
    request(url).then((response) => {
      var json = JSON.parse(response);

      if (json.ok) {
        User.findOne({sId: json.user.id}).then((u) => {
          req.slackExtra = { loggedIn: true, user: {sId: u.sId, name: u.name, avatar: u.avatar} };

          next();
        });

      } else {
        req.slackExtra = { loggedIn: false, clientId: clientId, user: {sId: ''} };
        if (!req.slackExtra.loggedIn) res.clearCookie('slackAccessToken');

        next();
      }
    });
  } else {
    req.slackExtra = { loggedIn: false, clientId: clientId, user: {sId: ''} };

    next();
  }
};

router.get('/', slackCookieParser, (req, res, next) => {
  res.render(theme + 'index', _.merge({ title: 'All pins'}, req.slackExtra));
});

router.get('/pins', slackCookieParser, (req, res, next) => {
  User.find().then((users) => {
    Channel.find().then((channels) => {
      Pin.find({}, {sort: '-ts'}).then((pins) => {
        res.render(theme + 'pins', _.merge({ pins: pinParser(pins, users, channels, req.slackExtra.user.sId) }, req.slackExtra));
      });
    });
  });
});

router.get('/channels/:channelFrag', (req, res, next) => {
  var query = {name: {$regex: new RegExp(req.params.channelFrag)}};
  Channel.find(query, {sort: 'name'}).then((channels) => {
    var matches = _.map(channels, (c) => { return c.name; });
    res.json(matches);
  });
});

router.get('/channel/:channel', slackCookieParser, (req, res, next) => {
  res.render(theme + 'channel', _.merge({ title: req.params.channel }, req.slackExtra));
});

router.get('/pins/:channel', slackCookieParser, (req, res, next) => {
  var channelName = req.params.channel;
  User.find().then((users) => {
    Channel.findOne({name: channelName}).then((channel) => {
      Pin.find({channelId: channel.sId}, {sort: '-ts'}).then((pins) => {
        res.render(theme + 'pins', _.merge({ pins: pinParser(pins, users, [channel], req.slackExtra.user.sId) }, req.slackExtra));
      });
    });
  });
});

router.get('/pin/:pinId', slackCookieParser, (req, res, next) => {
  var pinId = req.params.pinId;
  User.find().then((users) => {
    Channel.find().then((channels) => {
      Pin.findOne({sId: pinId}).then((pin) => {
        res.render(theme + 'pin', _.merge({ pin: pinParser([pin], users, channels, req.slackExtra.user.sId)[0] }, req.slackExtra));
      });
    });
  });
});

router.get('/pin/:pinId/vote', slackCookieParser, (req, res, next) => {
  var pinId = req.params.pinId;
  if (!req.slackExtra.loggedIn) res.redirect(req.header('Referer') || '/');
  Pin.findOne({sId: pinId}).then((pin) => {
    var myUser = req.slackExtra.user.sId;
    if (_.includes(pin.votes, myUser)) {
      res.redirect(req.header('Referer') || '/');
    } else {
      pin.votes.push(myUser);
      pin.save();
      res.redirect(req.header('Referer') || '/');
    }
  });
});

router.get('/pin/:pinId/delete', slackCookieParser, (req, res, next) => {
  var pinId = req.params.pinId;
  if (!req.slackExtra.loggedIn) res.redirect(req.header('Referer') || '/');
  Pin.findOne({sId: pinId}).then((pin) => {
    var myUser = req.slackExtra.user.sId;
    if (_.includes(pin.votes, myUser)) {
      pin.votes.splice(pin.votes.indexOf(myUser), 1);
      pin.save();
      res.redirect(req.header('Referer') || '/');
    } else {
      pin.votes.push(myUser);
      pin.save();
      res.redirect(req.header('Referer') || '/');
    }
  });
});

router.get('/random', slackCookieParser, (req, res, next) => {
  res.render(theme + 'random', _.merge({ title: 'Random Pin' }, req.slackExtra));
});

router.get('/topvoted', slackCookieParser, (req, res, next) => {
  res.render(theme + 'topvoted', _.merge({ title: 'Top Voted' }, req.slackExtra));
});

function compare(a,b) {
  if (a.votes.length < b.votes.length)
    return 1;
  else if (a.votes.length > b.votes.length)
    return -1;
  else
    return 0;
}

router.get('/top-pins', slackCookieParser, (req, res, next) => {
  User.find().then((users) => {
    Channel.find().then((channels) => {
      Pin.find().then((pins) => {
        var votedPins = _.filter(pins, (o) => { return o.votes.length > 0; });
        res.render(theme + 'pins', _.merge({ pins: pinParser(votedPins.sort(compare), users, channels, req.slackExtra.user.sId) }, req.slackExtra));
      });
    });
  });
});

router.get('/random/json', slackCookieParser, (req, res, next) => {
  User.find().then((users) => {
    Channel.find().then((channels) => {
      Pin.find().then((pins) => {
        var pin = pins[_.random(0, pins.length)];
        res.json(pinParser([pin], users, channels, req.slackExtra.user.sId));
      });
    });
  });
});

router.get('/random-pin', slackCookieParser, (req, res, next) => {
  User.find().then((users) => {
    Channel.find().then((channels) => {
      Pin.find().then((pins) => {
        var pin = pins[_.random(0, pins.length)];
        res.render(theme + 'pins', _.merge({ pins: pinParser([pin], users, channels, req.slackExtra.user.sId) }, req.slackExtra));
      });
    });
  });
});

router.get('/slack/auth', (req, res, next) => {
  var query = req.query;
  if (query.error) res.json(query.error);
  if (query.code) {
    var url = 'https://slack.com/api/oauth.access?client_id=' + clientId
          + '&client_secret=' + clientSecret + '&code=' + query.code;
    request(url).then((response) => {
      var json = JSON.parse(response);
      if (json.ok) {
        res.cookie('slackAccessToken', json.access_token);
        res.redirect('/');
      }
    });
  }
});

module.exports = router;
