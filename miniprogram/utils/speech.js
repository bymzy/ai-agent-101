const { getLanguage } = require('../common/languages');

let audioContext = null;

function hashText(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = (((hash << 5) + hash) + text.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = wx.createInnerAudioContext();
    audioContext.onError((err) => {
      console.error('音频播放失败', err);
    });
  }
  return audioContext;
}

function play(filePath) {
  const context = getAudioContext();
  context.stop();
  context.src = filePath;
  context.play();
}

function getCachePath(text, opts) {
  const lang = opts.lang || 'en';
  const voice = opts.voice || getLanguage(lang).voice || '';
  const key = hashText(`${lang}|${voice}|${text}`);
  return `${wx.env.USER_DATA_PATH}/tts-${key}.mp3`;
}

function isUsableFile(filePath) {
  try {
    const stat = wx.getFileSystemManager().statSync(filePath);
    return stat.size > 0;
  } catch (err) {
    return false;
  }
}

function speak(text, options) {
  const opts = options || {};
  return new Promise((resolve, reject) => {
    if (!text) {
      reject(new Error('文本为空'));
      return;
    }

    const cachePath = getCachePath(text, opts);
    if (isUsableFile(cachePath)) {
      play(cachePath);
      resolve(cachePath);
      return;
    }

    if (!wx.cloud) {
      reject(new Error('云开发未初始化'));
      return;
    }

    const data = { text };
    if (opts.voice) {
      data.voice = opts.voice;
    }
    if (opts.lang) {
      data.lang = opts.lang;
    }

    wx.cloud
      .callFunction({ name: 'tts', data })
      .then((res) => {
        const result = res && res.result;
        if (!result || !result.ok) {
          const message = (result && result.error && result.error.message) || '语音合成失败';
          throw new Error(message);
        }
        const audio = result.data || {};
        if (!audio.audioBase64) {
          throw new Error('语音数据为空');
        }
        wx.getFileSystemManager().writeFileSync(cachePath, audio.audioBase64, 'base64');
        play(cachePath);
        resolve(cachePath);
      })
      .catch((err) => {
        reject(new Error((err && (err.message || err.errMsg)) || '语音合成失败'));
      });
  });
}

function stop() {
  if (audioContext) {
    audioContext.stop();
  }
}

module.exports = {
  speak,
  stop,
};
