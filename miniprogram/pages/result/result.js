const app = getApp();
const { getLanguage } = require('../../common/languages');
const cloudApi = require('../../utils/cloud');
const speech = require('../../utils/speech');
const imageUtil = require('../../utils/image');
const shareImage = require('../../utils/share-image');
const history = require('../../utils/history');
const wordbook = require('../../utils/wordbook');
const recorder = require('../../utils/recorder');

const WXACODE_PATH = '/assets/wxacode.png';

function decodeText(value) {
  if (!value) {
    return '';
  }
  try {
    return decodeURIComponent(value);
  } catch (err) {
    return value;
  }
}

function decodeWords(value) {
  if (!value) {
    return [];
  }
  return decodeText(value)
    .split('|')
    .map((pair) => {
      const parts = pair.split('~');
      return { word: parts[0] || '', translation: parts[1] || '' };
    })
    .filter((item) => item.word);
}

function encodeWords(words) {
  return words
    .map((item) => `${item.word}~${item.translation || ''}`)
    .join('|');
}

function pct(value) {
  return Math.round(value * 1000) / 10;
}

function decorateWords(words, lang) {
  return (words || []).map((item) => {
    if (!item) {
      return item;
    }
    const entry = Object.assign({}, item);
    if (item.bbox) {
      const bbox = item.bbox;
      entry.boxStyle = `left:${pct(bbox.x)}%;top:${pct(bbox.y)}%;width:${pct(bbox.w)}%;height:${pct(bbox.h)}%;`;
    }
    entry.saved = wordbook.isSaved(item.word, lang);
    return entry;
  });
}

Page({
  data: {
    level: 'primary',
    lang: 'en',
    langName: '英语',
    words: [],
    scene: '',
    sentence: '',
    translation: '',
    imagePath: '',
    imageWidth: 0,
    imageHeight: 0,
    fileID: '',
    generating: false,
    speaking: false,
    sharing: false,
    shareImagePath: '',
    recordId: '',
    fromHistory: false,
    error: '',
    recordState: 'idle',
    recordPath: '',
    recordSeconds: 0,
    playingRecord: false,
    wordPlayingIndex: -1,
    wordLoadingIndex: -1,
  },

  onLoad(options) {
    this.audioToken = 0;
    this.unsubscribeRecordStop = recorder.onStop((res) => this.handleRecordStop(res));
    speech.onEnded(() => {
      if (this.data.playingRecord) {
        this.setData({ playingRecord: false });
      }
      if (this.data.wordPlayingIndex !== -1) {
        this.setData({ wordPlayingIndex: -1 });
      }
    });

    const opts = options || {};
    const level = opts.level || app.globalData.level || 'primary';
    const lang = opts.lang || app.globalData.lang || 'en';
    const langName = getLanguage(lang).name;
    const words = decodeWords(opts.words);

    if (words.length) {
      this.setData(
        {
          level,
          lang,
          langName,
          words: decorateWords(words, lang),
          sentence: decodeText(opts.sentence),
          scene: decodeText(opts.scene),
        },
        () => this.prefetchSentence()
      );
      return;
    }

    const pending = wx.getStorageSync('pendingResult');
    if (pending && pending.words && pending.words.length) {
      const pendingLang = pending.lang || lang;
      const hasRecordId = !!pending.recordId;
      const recordId = hasRecordId ? pending.recordId : history.createId();
      const fromHistory = !!pending.fromHistory;
      this.setData(
        {
          level: pending.level || level,
          lang: pendingLang,
          langName: getLanguage(pendingLang).name,
          words: decorateWords(pending.words, pendingLang),
          scene: pending.scene || '',
          sentence: pending.sentence || '',
          translation: pending.translation || '',
          fileID: pending.fileID || '',
          imagePath: pending.imagePath || '',
          imageWidth: pending.imageWidth || 0,
          imageHeight: pending.imageHeight || 0,
          recordId,
          fromHistory,
        },
        () => {
          if (!fromHistory && hasRecordId) {
            try {
              history.save({
                id: recordId,
                createdAt: pending.createdAt || Date.now(),
                lang: pendingLang,
                level: pending.level || level,
                words: pending.words,
                scene: pending.scene || '',
                sentence: pending.sentence || '',
                translation: pending.translation || '',
                imagePath: pending.imagePath || '',
                fileID: pending.fileID || '',
                imageWidth: pending.imageWidth || 0,
                imageHeight: pending.imageHeight || 0,
              });
            } catch (err) {
              // 历史记录失败不影响主流程
            }
          }
          if (!pending.sentence) {
            this.generateSentence();
          } else {
            this.prefetchSentence();
          }
        }
      );

      const needDownload =
        pending.fileID && (!pending.imagePath || !imageUtil.fileExists(pending.imagePath));
      if (needDownload) {
        imageUtil
          .downloadCloudFile(pending.fileID)
          .then((path) => this.setData({ imagePath: path }))
          .catch(() => {});
      }
    }
  },

  onShow() {
    if (!this.data.words.length) {
      return;
    }
    const updates = {};
    this.data.words.forEach((item, index) => {
      updates[`words[${index}].saved`] = wordbook.isSaved(item.word, this.data.lang);
    });
    this.setData(updates);
  },

  onImageLoad(e) {
    const detail = e.detail || {};
    if (detail.width && detail.height) {
      this.setData({
        imageWidth: detail.width,
        imageHeight: detail.height,
      });
    }
  },

  ensureImage() {
    if (this.data.imagePath && imageUtil.fileExists(this.data.imagePath)) {
      return Promise.resolve(this.data.imagePath);
    }
    if (this.data.fileID) {
      return imageUtil.downloadCloudFile(this.data.fileID).then((path) => {
        this.setData({ imagePath: path });
        return path;
      });
    }
    return Promise.reject(new Error('图片不存在'));
  },

  prefetchSentence() {
    const text = this.data.sentence;
    if (!text) {
      return;
    }
    speech.prefetch(text, { lang: this.data.lang }).catch(() => {});
  },

  generateSentence() {
    if (this.data.generating || !this.data.words.length) {
      return;
    }
    const words = this.data.words.map((item) => item.word);
    this.setData({ generating: true, error: '' });

    cloudApi
      .compose(words, this.data.level, this.data.scene, this.data.lang)
      .then((data) => {
        const sentence = (data && data.sentence) || '';
        const translation = (data && data.translation) || '';
        this.setData({
          sentence,
          translation,
          generating: false,
        });
        this.prefetchSentence();
        try {
          if (this.data.recordId) {
            history.update(this.data.recordId, { sentence, translation });
          }
        } catch (err) {
          // 历史记录更新失败不影响主流程
        }
        const pending = wx.getStorageSync('pendingResult') || {};
        wx.setStorageSync(
          'pendingResult',
          Object.assign({}, pending, {
            recordId: this.data.recordId,
            level: this.data.level,
            lang: this.data.lang,
            words: this.data.words,
            scene: this.data.scene,
            fileID: this.data.fileID,
            imagePath: this.data.imagePath,
            imageWidth: this.data.imageWidth,
            imageHeight: this.data.imageHeight,
            sentence,
            translation,
            fromHistory: this.data.fromHistory,
          })
        );
      })
      .catch((err) => {
        this.setData({
          generating: false,
          error: (err && err.message) || '组句失败，请重试',
        });
      });
  },

  playSentence() {
    const text = this.data.sentence;
    if (!text || this.data.speaking || this.data.recordState === 'recording') {
      return;
    }
    const token = (this.audioToken = this.audioToken + 1);
    speech.stop();
    this.setData({
      speaking: true,
      playingRecord: false,
      wordPlayingIndex: -1,
      wordLoadingIndex: -1,
    });
    speech
      .prefetch(text, { lang: this.data.lang })
      .then((path) => {
        if (token !== this.audioToken) {
          return;
        }
        speech.playLocal(path);
        this.setData({ speaking: false });
      })
      .catch((err) => {
        if (token !== this.audioToken) {
          return;
        }
        this.setData({ speaking: false });
        wx.showToast({
          title: (err && err.message) || '语音合成失败',
          icon: 'none',
        });
      });
  },

  playWord(e) {
    const index = Number(e.currentTarget.dataset.index);
    const item = this.data.words[index];
    if (!item || !item.word) {
      return;
    }
    if (this.data.recordState === 'recording') {
      wx.showToast({ title: '录音中无法播放', icon: 'none' });
      return;
    }
    const token = (this.audioToken = this.audioToken + 1);
    speech.stop();
    this.setData({
      wordLoadingIndex: index,
      wordPlayingIndex: -1,
      speaking: false,
      playingRecord: false,
    });
    speech
      .prefetch(item.word, { lang: this.data.lang })
      .then((path) => {
        if (token !== this.audioToken) {
          return;
        }
        speech.playLocal(path);
        this.setData({ wordLoadingIndex: -1, wordPlayingIndex: index });
      })
      .catch((err) => {
        if (token !== this.audioToken) {
          return;
        }
        this.setData({ wordLoadingIndex: -1 });
        wx.showToast({
          title: (err && err.message) || '发音失败，请重试',
          icon: 'none',
        });
      });
  },

  clearRecordTimer() {
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
  },

  toggleRecord() {
    if (!this.data.sentence) {
      return;
    }
    if (this.data.recordState === 'recording') {
      this.stopRecording();
      return;
    }
    if (this.data.recordState === 'recorded') {
      this.discardRecord();
    }
    this.startRecording();
  },

  startRecording() {
    this.audioToken = (this.audioToken || 0) + 1;
    speech.stop();
    this.setData({
      playingRecord: false,
      speaking: false,
      wordPlayingIndex: -1,
      wordLoadingIndex: -1,
    });
    recorder
      .start()
      .then(() => {
        this.setData({ recordState: 'recording', recordSeconds: 0, recordPath: '' });
        this.clearRecordTimer();
        this.recordTimer = setInterval(() => {
          this.setData({ recordSeconds: this.data.recordSeconds + 1 });
        }, 1000);
      })
      .catch((err) => {
        const message = (err && (err.message || err.errMsg)) || '';
        this.setData({ recordState: 'idle' });
        if (/auth|deny|permission|权限/i.test(message)) {
          wx.showModal({
            title: '需要麦克风权限',
            content: '跟读练习需要录制你的声音，请在设置中允许使用麦克风。',
            confirmText: '去设置',
            success: (res) => {
              if (!res.confirm) {
                return;
              }
              wx.openSetting({
                success: (setting) => {
                  const auth = setting && setting.authSetting;
                  if (auth && auth['scope.record']) {
                    this.startRecording();
                  }
                },
              });
            },
          });
        } else {
          wx.showToast({ title: '录音启动失败', icon: 'none' });
        }
      });
  },

  stopRecording() {
    this.clearRecordTimer();
    recorder.stop().catch(() => {
      this.setData({ recordState: 'idle', recordPath: '', recordSeconds: 0 });
      wx.showToast({ title: '录音失败', icon: 'none' });
    });
  },

  handleRecordStop(res) {
    this.clearRecordTimer();
    if (res && res.tempFilePath) {
      this.setData(
        {
          recordState: 'recorded',
          recordPath: res.tempFilePath,
          recordSeconds: Math.max(1, Math.round((res.duration || 0) / 1000)),
        },
        () => this.playMyRecord()
      );
    } else {
      this.setData({ recordState: 'idle', recordPath: '', recordSeconds: 0 });
    }
  },

  playMyRecord() {
    if (!this.data.recordPath || this.data.recordState !== 'recorded') {
      return;
    }
    if (this.data.playingRecord) {
      this.audioToken = (this.audioToken || 0) + 1;
      speech.stop();
      this.setData({ playingRecord: false });
      return;
    }
    this.audioToken = (this.audioToken || 0) + 1;
    speech.playLocal(this.data.recordPath);
    this.setData({
      playingRecord: true,
      speaking: false,
      wordPlayingIndex: -1,
      wordLoadingIndex: -1,
    });
  },

  changeSentence() {
    if (this.data.generating || this.data.recordState === 'recording') {
      return;
    }
    if (this.data.recordState === 'recorded') {
      this.audioToken = (this.audioToken || 0) + 1;
      speech.stop();
      this.discardRecord();
    }
    this.generateSentence();
  },

  discardRecord() {
    this.clearRecordTimer();
    this.setData({
      recordState: 'idle',
      recordPath: '',
      recordSeconds: 0,
      playingRecord: false,
    });
  },

  onUnload() {
    this.audioToken = (this.audioToken || 0) + 1;
    this.clearRecordTimer();
    if (this.unsubscribeRecordStop) {
      this.unsubscribeRecordStop();
      this.unsubscribeRecordStop = null;
    }
    if (recorder.isRecording()) {
      recorder.stop().catch(() => {});
    }
    speech.onEnded(null);
    speech.stop();
  },

  toggleWordbook(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.words[index];
    if (!item) {
      return;
    }
    const saved = wordbook.toggle(item, this.data.lang);
    this.setData({ [`words[${index}].saved`]: saved });
    wx.showToast({
      title: saved ? '已加入单词本' : '已移出单词本',
      icon: 'none',
    });
  },

  shareImage() {
    if (!this.data.sentence) {
      wx.showToast({ title: '先生成句子', icon: 'none' });
      return;
    }
    if (!this.data.imagePath && !this.data.fileID) {
      wx.showToast({ title: '没有可分享的图片', icon: 'none' });
      return;
    }
    if (this.data.sharing) {
      return;
    }

    this.setData({ sharing: true });
    wx.showLoading({ title: '生成分享图', mask: true });

    const page = this;
    const canvasReady = new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(page)
        .select('#shareCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const canvas = res && res[0] && res[0].node;
          if (!canvas) {
            reject(new Error('找不到分享画布'));
            return;
          }
          resolve(canvas);
        });
    });

    Promise.all([
      canvasReady,
      page.ensureImage(),
      WXACODE_PATH,
    ])
      .then(([canvas, imagePath, codePath]) =>
        shareImage.render({
          canvas,
          page,
          imagePath,
          imageWidth: page.data.imageWidth,
          imageHeight: page.data.imageHeight,
          words: page.data.words,
          sentence: page.data.sentence,
          translation: page.data.translation,
          codePath,
        })
      )
      .then((tempPath) => {
        this.setData({ shareImagePath: tempPath });
        return new Promise((resolve, reject) => {
          if (!wx.showShareImageMenu) {
            reject(new Error('当前基础库不支持图片分享'));
            return;
          }
          wx.showShareImageMenu({
            path: tempPath,
            success: resolve,
            fail: reject,
          });
        });
      })
      .then(() => {
        wx.hideLoading();
        this.setData({ sharing: false });
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ sharing: false });
        wx.showToast({
          title: (err && (err.message || err.errMsg)) || '分享图生成失败',
          icon: 'none',
        });
      });
  },

  onShareAppMessage() {
    const { words, sentence, level, scene, lang } = this.data;
    const params = [`level=${level}`, `lang=${lang}`];
    if (words.length) {
      params.push(`words=${encodeURIComponent(encodeWords(words))}`);
    }
    if (sentence) {
      params.push(`sentence=${encodeURIComponent(sentence)}`);
    }
    if (scene) {
      params.push(`scene=${encodeURIComponent(scene)}`);
    }
    return {
      title: sentence || '看图学外语',
      path: `/pages/result/result?${params.join('&')}`,
    };
  },
});
