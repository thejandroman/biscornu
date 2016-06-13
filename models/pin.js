var Document = require('camo').Document;

class Pin extends Document {
  constructor() {
    super();

    this.sId       = String;
    this.message   = String;
    this.channelId = String;
    this.userId    = String;
    this.ts        = String;
    this.permalink = String;
    this.votes     = Array;
    this.comments  = Object;
  };
};

module.exports = Pin;
