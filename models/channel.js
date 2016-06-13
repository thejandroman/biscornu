var Document = require('camo').Document;

class Channel extends Document {
  constructor() {
    super();

    this.sId  = String;
    this.name = String;
  };
};

module.exports = Channel;
