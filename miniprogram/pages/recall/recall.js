const history = require('../../utils/history');
const imageUtil = require('../../utils/image');
const stats = require('../../utils/stats');
const review = require('../../utils/review');

function pct(value) {
  return Math.round(value * 1000) / 10;
}

function decorate(words) {
  return (words || []).map((item) => {
    const entry = Object.assign({}, item);
    if (item.bbox) {
      const bbox = item.bbox;
      entry.boxStyle = `left:${pct(bbox.x)}%;top:${pct(bbox.y)}%;width:${pct(bbox.w)}%;height:${pct(bbox.h)}%;`;
    }
    entry.revealed = false;
    entry.graded = false;
    return entry;
  });
}

Page({
  data: {
    lang: 'en',
    imagePath: '',
    words: [],
    revealedCount: 0,
    gradedCount: 0,
    current: null,
    pending: false,
    remembered: 0,
    forgot: 0,
    finished: false,
    missingImage: false,
  },

  onLoad(options) {
    const id = options && options.id;
    const record = history.load().find((item) => item.id === id);
    if (!record) {
      wx.showToast({ title: '记录不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.record = record;
    if (!record.imagePath || !imageUtil.fileExists(record.imagePath)) {
      this.setData({ missingImage: true });
      return;
    }
    this.setData({
      lang: record.lang || 'en',
      imagePath: record.imagePath,
      words: decorate(record.words),
    });
  },

  onImageTap() {
    if (this.data.pending || this.data.finished) {
      return;
    }
    this.revealNext();
  },

  onBoxTap(e) {
    if (this.data.pending || this.data.finished) {
      return;
    }
    const index = Number(e.currentTarget.dataset.index);
    const word = this.data.words[index];
    if (!word || word.revealed) {
      return;
    }
    this.revealAt(index);
  },

  revealNext() {
    if (this.data.pending || this.data.finished) {
      return;
    }
    const index = this.data.words.findIndex((item) => !item.revealed);
    if (index === -1) {
      return;
    }
    this.revealAt(index);
  },

  revealAt(index) {
    const word = this.data.words[index];
    if (!word || word.revealed) {
      return;
    }
    this.setData({
      [`words[${index}].revealed`]: true,
      revealedCount: this.data.revealedCount + 1,
      current: {
        index,
        word: word.word,
        translation: word.translation || '',
        phonetic: word.phonetic || '',
      },
      pending: true,
    });
  },

  grade(e) {
    if (!this.data.pending || !this.data.current) {
      return;
    }
    const remembered = String(e.currentTarget.dataset.remembered) === '1';
    const current = this.data.current;

    stats.record(remembered);
    if (!remembered) {
      review.registerFail((this.record && this.record.lang) || 'en', current.word);
    }

    this.setData(
      {
        [`words[${current.index}].graded`]: true,
        gradedCount: this.data.gradedCount + 1,
        current: null,
        pending: false,
        remembered: this.data.remembered + (remembered ? 1 : 0),
        forgot: this.data.forgot + (remembered ? 0 : 1),
      },
      () => {
        if (this.data.gradedCount >= this.data.words.length) {
          this.setData({ finished: true });
          return;
        }
        this.revealNext();
      }
    );
  },

  restart() {
    const words = this.data.words.map((item) =>
      Object.assign({}, item, { revealed: false, graded: false })
    );
    this.setData({
      words,
      revealedCount: 0,
      gradedCount: 0,
      current: null,
      pending: false,
      remembered: 0,
      forgot: 0,
      finished: false,
    });
  },

  goBack() {
    wx.navigateBack();
  },
});
