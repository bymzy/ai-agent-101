const tokenhub = require('./tokenhub');

function getProvider() {
  return tokenhub;
}

module.exports = { getProvider };
