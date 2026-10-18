const config = require('../config');
const mock = require('./mock');

function call(name, data) {
  return wx.cloud
    .callFunction({ name, data })
    .then((res) => {
      const result = res && res.result;
      if (!result || !result.ok) {
        const message = (result && result.error && result.error.message) || '云函数调用失败';
        throw new Error(message);
      }
      return result.data;
    });
}

function recognize(fileID, level, lang) {
  if (config.useLocalMock) {
    return Promise.resolve(mock.recognize(level));
  }
  return call('recognize', { fileID, level, lang });
}

function compose(words, level, scene, lang) {
  if (config.useLocalMock) {
    return Promise.resolve(mock.compose(words, level));
  }
  return call('compose', { words, level, scene, lang });
}

function analyze(fileID, level, lang) {
  if (config.useLocalMock) {
    const recognized = mock.recognize(level);
    const composed = mock.compose(
      (recognized.words || []).map((item) => item.word),
      level
    );
    return Promise.resolve(Object.assign({}, recognized, composed));
  }
  return call('analyze', { fileID, level, lang });
}

module.exports = {
  call,
  recognize,
  compose,
  analyze,
};
