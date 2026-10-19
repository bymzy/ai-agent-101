const { getLanguage } = require('../../common/languages');
const history = require('../../utils/history');

function formatDate(timestamp) {
  const date = new Date(timestamp || Date.now());
  const pad = (value) => (value < 10 ? `0${value}` : `${value}`);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

Page({
  data: {
    items: [],
  },

  onShow() {
    this.load();
  },

  load() {
    const items = history.load().map((item) => {
      const language = getLanguage(item.lang);
      return Object.assign({}, item, {
        langName: language.name,
        dateText: formatDate(item.createdAt),
        wordText: (item.words || []).map((word) => word.word).join('、'),
      });
    });
    this.setData({ items });
  },

  openRecord(e) {
    const id = e.currentTarget.dataset.id;
    const item = history.load().find((record) => record.id === id);
    if (!item) {
      return;
    }
    wx.setStorageSync(
      'pendingResult',
      Object.assign({}, item, { recordId: item.id, fromHistory: true })
    );
    wx.navigateTo({ url: '/pages/result/result' });
  },

  openRecall(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/recall/recall?id=${id}` });
  },
});
