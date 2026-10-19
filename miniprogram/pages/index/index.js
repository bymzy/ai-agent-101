const app = getApp();
const config = require('../../config');
const { LEVELS, LEVEL_IDS } = require('../../common/levels');
const { LANGUAGES, LANGUAGE_IDS } = require('../../common/languages');
const cloudApi = require('../../utils/cloud');
const imageUtil = require('../../utils/image');
const history = require('../../utils/history');
const wordbook = require('../../utils/wordbook');
const stats = require('../../utils/stats');

function buildLevels() {
  return LEVEL_IDS.map((id) => ({ id, name: LEVELS[id].name }));
}

function buildLanguages() {
  return LANGUAGE_IDS.map((id) => ({ id, name: LANGUAGES[id].name }));
}

Page({
  data: {
    levels: buildLevels(),
    level: LEVELS.primary.id,
    languages: buildLanguages(),
    lang: LANGUAGES.en.id,
    loading: false,
    loadingText: config.useCombinedAnalyze ? '分析中…' : '识别中…',
    error: '',
    summary: {
      todayAnswered: 0,
      goal: 5,
      streak: 0,
      totalAnswered: 0,
    },
  },

  onLoad() {
    const level = app.globalData.level;
    if (level) {
      this.setData({ level });
    }
    const lang = app.globalData.lang;
    if (lang) {
      this.setData({ lang });
    }
  },

  onShow() {
    this.setData({ summary: stats.getSummary() });
  },

  openReview() {
    if (!wordbook.load().length) {
      wx.showToast({ title: '单词本还是空的', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/review/review' });
  },

  openRecall() {
    const latest = history.load()[0];
    if (!latest) {
      wx.showToast({ title: '还没有识别记录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/recall/recall?id=${latest.id}` });
  },

  onSelectLevel(e) {
    const level = e.currentTarget.dataset.id;
    app.globalData.level = level;
    wx.setStorageSync('level', level);
    this.setData({ level });
  },

  onSelectLanguage(e) {
    const lang = e.currentTarget.dataset.id;
    app.globalData.lang = lang;
    wx.setStorageSync('lang', lang);
    this.setData({ lang });
  },

  chooseImage() {
    if (this.data.loading) {
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (file) {
          this.recognize(file.tempFilePath);
        }
      },
      fail: () => {},
    });
  },

  recognize(filePath) {
    const level = this.data.level;
    const lang = this.data.lang;
    const cloudPath = `recognize/${Date.now()}-${Math.floor(Math.random() * 1000000)}.jpg`;
    this.setData({ loading: true, error: '' });

    const prepared = config.useLocalMock
      ? Promise.resolve({ path: filePath })
      : imageUtil.normalizeImage(filePath, this, '#normalizeCanvas').catch(() => ({
          path: filePath,
        }));

    prepared
      .then((preparedImage) => {
        const upload = config.useLocalMock
          ? Promise.resolve({ fileID: '' })
          : wx.cloud.uploadFile({ cloudPath, filePath: preparedImage.path });
        return upload.then((res) => ({ res, preparedImage }));
      })
      .then(({ res, preparedImage }) => {
        const request = config.useCombinedAnalyze
          ? cloudApi.analyze(res.fileID, level, lang)
          : cloudApi.recognize(res.fileID, level, lang);
        return request.then((data) => ({ data, res, preparedImage }));
      })
      .then(({ data, res, preparedImage }) => {
        const words = (data && data.words) || [];
        if (!words.length) {
          throw new Error('没有识别到物体，换一张试试');
        }
        const sentence = (data && data.sentence) || '';
        const translation = (data && data.translation) || '';
        wx.setStorageSync('pendingResult', {
          recordId: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
          level,
          lang,
          words,
          scene: (data && data.scene) || '',
          fileID: res.fileID || '',
          imagePath: preparedImage.path,
          imageWidth: preparedImage.width || 0,
          imageHeight: preparedImage.height || 0,
          sentence,
          translation,
        });
        this.setData({ loading: false });
        wx.navigateTo({ url: '/pages/result/result' });
      })
      .catch((err) => {
        const message =
          (err && (err.message || err.errMsg)) || '识别失败，请重试';
        this.setData({ loading: false, error: message });
      });
  },
});
