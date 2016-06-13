var Document = require('camo').Document;

class User extends Document {
  constructor() {
    super();

    this.sId    = String;
    this.name   = String;
    this.avatar = String;
  };
};

module.exports = User;
