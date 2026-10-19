const wordbook = require('../../utils/wordbook');
const review = require('../../utils/review');
const stats = require('../../utils/stats');
const speech = require('../../utils/speech');

const MODES = ['word2meaning', 'meaning2word', 'listen2meaning'];
const MODE_NAMES = {
  word2meaning: '看词选义',
  meaning2word: '看义忆词',
  listen2meaning: '听音选词',
};
const MAX_QUESTIONS = 30;

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

Page({
  data: {
    loading: true,
    empty: false,
    practiceMode: false,
    finished: false,
    index: 0,
    total: 0,
    mode: '',
    modeName: '',
    current: null,
    options: [],
    revealed: false,
    graded: false,
    correctCount: 0,
    lapsedWords: [],
  },

  onLoad() {
    this.allWords = [];
    this.session = [];
    this.results = [];
    this.unloaded = false;
    this.advanceTimer = null;
    this.buildSession();
  },

  onUnload() {
    this.unloaded = true;
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
    }
    speech.stop();
  },

  buildSession() {
    const all = wordbook.load();
    this.allWords = all;
    if (!all.length) {
      this.setData({ loading: false, empty: true });
      return;
    }

    const byId = {};
    all.forEach((item) => {
      byId[item.id] = item;
    });
    const due = review.getDueIds();
    const pool = due.length ? due : all.map((item) => item.id);
    const session = [];
    const perMode = Math.max(1, Math.floor(MAX_QUESTIONS / MODES.length));
    MODES.forEach((mode) => {
      shuffle(pool)
        .slice(0, perMode)
        .forEach((id) => {
          if (byId[id]) {
            session.push({ id, mode });
          }
        });
    });

    this.byId = byId;
    this.session = session.slice(0, MAX_QUESTIONS);
    this.results = [];
    this.setData(
      {
        loading: false,
        empty: false,
        practiceMode: !due.length,
        finished: false,
        total: this.session.length,
        index: 0,
        correctCount: 0,
        lapsedWords: [],
      },
      () => this.loadQuestion(0)
    );
  },

  loadQuestion(index) {
    if (this.unloaded) {
      return;
    }
    if (index >= this.session.length) {
      this.finish();
      return;
    }
    const question = this.session[index];
    const entry = this.byId[question.id];
    if (!entry) {
      this.loadQuestion(index + 1);
      return;
    }

    let mode = question.mode;
    let options = [];
    if (mode !== 'meaning2word') {
      options = this.buildOptions(entry);
      if (options.length < 2) {
        mode = 'meaning2word';
        options = [];
      }
    }

    this.setData({
      index,
      mode,
      modeName: MODE_NAMES[mode],
      current: {
        id: entry.id,
        word: entry.word,
        translation: entry.translation,
        phonetic: entry.phonetic || '',
        lang: entry.lang || 'en',
      },
      options,
      revealed: false,
      graded: false,
    });

    if (mode === 'listen2meaning') {
      this.playWord();
    }
  },

  buildOptions(entry) {
    const byLang = { same: [], other: [] };
    const seen = {};
    this.allWords.forEach((item) => {
      if (!item || item.id === entry.id) {
        return;
      }
      const text = item.translation;
      if (!text || text === entry.translation || seen[text]) {
        return;
      }
      seen[text] = true;
      if ((item.lang || 'en') === (entry.lang || 'en')) {
        byLang.same.push(text);
      } else {
        byLang.other.push(text);
      }
    });
    const others = shuffle(byLang.same).concat(shuffle(byLang.other)).slice(0, 3);
    if (!others.length) {
      return [];
    }
    return shuffle([entry.translation].concat(others)).map((text) => ({
      text,
      state: '',
    }));
  },

  chooseOption(e) {
    if (this.data.graded || this.data.mode === 'meaning2word') {
      return;
    }
    const pick = Number(e.currentTarget.dataset.index);
    const correctText = this.data.current.translation;
    const options = this.data.options.map((option, index) => {
      let state = '';
      if (option.text === correctText) {
        state = 'right';
      } else if (index === pick) {
        state = 'wrong';
      }
      return Object.assign({}, option, { state });
    });
    const correct = !!options[pick] && options[pick].text === correctText;

    this.setData({ options, graded: true });
    this.commit(correct);
    this.advanceTimer = setTimeout(() => {
      this.loadQuestion(this.data.index + 1);
    }, 900);
  },

  revealAnswer() {
    if (this.data.graded) {
      return;
    }
    this.setData({ revealed: true });
  },

  selfGrade(e) {
    if (this.data.graded) {
      return;
    }
    const correct = String(e.currentTarget.dataset.correct) === '1';
    this.setData({ graded: true });
    this.commit(correct);
    this.advanceTimer = setTimeout(() => {
      this.loadQuestion(this.data.index + 1);
    }, 300);
  },

  commit(correct) {
    const current = this.data.current;
    if (!current) {
      return;
    }
    review.record(current.id, correct);
    stats.record(correct);
    this.results.push({ id: current.id, word: current.word, correct });
  },

  playWord() {
    const current = this.data.current;
    if (!current || this.data.mode !== 'listen2meaning') {
      return;
    }
    speech.speak(current.word, { lang: current.lang }).catch(() => {
      wx.showToast({ title: '语音不可用', icon: 'none' });
    });
  },

  finish() {
    const correctCount = this.results.filter((item) => item.correct).length;
    const lapsedWords = this.results
      .filter((item) => !item.correct)
      .map((item) => item.word);
    this.setData({
      finished: true,
      correctCount,
      total: this.results.length,
      lapsedWords,
    });
  },

  restart() {
    speech.stop();
    this.buildSession();
  },

  goBack() {
    wx.navigateBack();
  },
});
