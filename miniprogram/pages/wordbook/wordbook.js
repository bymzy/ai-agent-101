const { getLanguage } = require('../../common/languages');
const wordbook = require('../../utils/wordbook');
const review = require('../../utils/review');

Page({
  data: {
    groups: [],
    total: 0,
    dueCount: 0,
  },

  onShow() {
    this.load();
  },

  load() {
    const items = wordbook.load().map((item) =>
      Object.assign({}, item, { lapsed: review.getState(item.id).lapsed })
    );
    const langMap = {};

    items.forEach((item) => {
      const lang = item.lang || 'en';
      if (!langMap[lang]) {
        langMap[lang] = {
          lang,
          langName: getLanguage(lang).name,
          categories: {},
        };
      }
      const category = item.category || '其他';
      if (!langMap[lang].categories[category]) {
        langMap[lang].categories[category] = [];
      }
      langMap[lang].categories[category].push(item);
    });

    const groups = Object.keys(langMap).map((lang) => {
      const group = langMap[lang];
      const categories = Object.keys(group.categories).map((name) => ({
        name,
        words: group.categories[name],
      }));
      return {
        lang: group.lang,
        langName: group.langName,
        categories,
      };
    });

    this.setData({
      groups,
      total: items.length,
      dueCount: review.getDueCount(),
    });
  },

  openReview() {
    if (!this.data.total) {
      wx.showToast({ title: '单词本还是空的', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/review/review' });
  },

  removeWord(e) {
    const id = e.currentTarget.dataset.id;
    wordbook.remove(id);
    this.load();
  },
});
