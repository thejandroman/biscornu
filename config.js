var appRoot = require('app-root-path');

// Change these values;
var port         = process.env.PORT || '3000',
    slackToken   = process.env.SLACKTOKEN || 'changeMe',
    dbUri        = process.env.DBURI || 'nedb://' + appRoot + '/slack.db',
    clientId     = process.env.CLIENTID || 'changeMe',
    clientSecret = process.env.CLIENTSECRET || 'changeMe';

// Do not change below this line
function normalizePort(val) {
  var port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}

var config = {
  slackToken   : slackToken,
  port         : normalizePort(port),
  dbUri        : dbUri,
  clientId     : clientId,
  clientSecret : clientSecret
};

module.exports = config;
