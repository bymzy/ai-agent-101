const mock = require('./mock');
const tokenhub = require('./tokenhub');

const PROVIDERS = { mock, tokenhub };

function getProvider() {
  const name = process.env.AI_PROVIDER || 'mock';
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`未知的 AI 厂商: ${name}`);
  }
  return provider;
}

module.exports = { getProvider };
