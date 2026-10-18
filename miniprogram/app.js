const { DEFAULT_LEVEL } = require('./common/levels');
const { DEFAULT_LANGUAGE } = require('./common/languages');
const config = require('./config');

App({
  globalData: {
    level: DEFAULT_LEVEL,
    lang: DEFAULT_LANGUAGE,
  },

  onLaunch() {
    const savedLevel = wx.getStorageSync('level');
    if (savedLevel) {
      this.globalData.level = savedLevel;
    }
    const savedLang = wx.getStorageSync('lang');
    if (savedLang) {
      this.globalData.lang = savedLang;
    }

    if (config.useLocalMock) {
      return;
    }

    if (!wx.cloud) {
      console.error('当前基础库不支持云开发，请使用 2.2.3 及以上版本');
      return;
    }

    const options = { traceUser: true };
    if (config.cloudEnv) {
      options.env = config.cloudEnv;
    }
    wx.cloud.init(options);
  },
});
