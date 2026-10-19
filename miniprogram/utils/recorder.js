const MAX_DURATION = 60000;

let manager = null;
let recording = false;
let pendingStart = null;
let pendingStop = null;
let stopListeners = [];

function settleStart(error) {
  if (!pendingStart) {
    return;
  }
  const pending = pendingStart;
  pendingStart = null;
  if (error) {
    pending.reject(error);
  } else {
    pending.resolve();
  }
}

function settleStop(result, error) {
  if (!pendingStop) {
    return;
  }
  const pending = pendingStop;
  pendingStop = null;
  if (error) {
    pending.reject(error);
  } else {
    pending.resolve(result);
  }
}

function notifyStop(result) {
  stopListeners.forEach((callback) => {
    try {
      callback(result);
    } catch (err) {
      console.error('录音停止回调失败', err);
    }
  });
}

function getManager() {
  if (manager) {
    return manager;
  }
  manager = wx.getRecorderManager();
  manager.onStart(() => {
    recording = true;
    settleStart(null);
  });
  manager.onStop((res) => {
    recording = false;
    notifyStop(res || {});
    settleStop(res || {}, null);
  });
  manager.onError((err) => {
    recording = false;
    const error = new Error((err && (err.errMsg || err.message)) || '录音失败');
    settleStart(error);
    settleStop(null, error);
    notifyStop(null);
  });
  return manager;
}

function start() {
  const recorder = getManager();
  return new Promise((resolve, reject) => {
    pendingStart = { resolve, reject };
    try {
      recorder.start({
        duration: MAX_DURATION,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'mp3',
      });
    } catch (err) {
      pendingStart = null;
      reject(err);
    }
  });
}

function stop() {
  if (!recording) {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    pendingStop = { resolve, reject };
    try {
      getManager().stop();
    } catch (err) {
      pendingStop = null;
      reject(err);
    }
  });
}

function isRecording() {
  return recording;
}

function onStop(callback) {
  stopListeners.push(callback);
  return () => {
    stopListeners = stopListeners.filter((item) => item !== callback);
  };
}

module.exports = {
  start,
  stop,
  isRecording,
  onStop,
  MAX_DURATION,
};
