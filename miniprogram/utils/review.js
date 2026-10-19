const wordbook = require('./wordbook');

const KEY = 'reviewState';
const BOX_INTERVALS = [0, 1, 2, 4, 7, 14];
const MAX_BOX = 5;
const DAY = 86400000;

function loadState() {
  const map = wx.getStorageSync(KEY);
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}

function saveState(map) {
  wx.setStorageSync(KEY, map);
}

function getState(id) {
  const state = loadState()[id];
  if (!state || typeof state !== 'object') {
    return { box: 0, dueAt: 0, lapsed: false };
  }
  return {
    box: typeof state.box === 'number' ? state.box : 0,
    dueAt: typeof state.dueAt === 'number' ? state.dueAt : 0,
    lapsed: !!state.lapsed,
  };
}

function record(id, correct) {
  if (!id) {
    return null;
  }
  const map = loadState();
  const previous = getState(id);
  const now = Date.now();
  let next;
  if (correct) {
    const box = Math.min(MAX_BOX, previous.box + 1);
    next = {
      box,
      dueAt: now + BOX_INTERVALS[box] * DAY,
      lapsed: false,
      updatedAt: now,
    };
  } else {
    next = {
      box: 0,
      dueAt: now,
      lapsed: true,
      updatedAt: now,
    };
  }
  map[id] = next;
  saveState(map);
  return next;
}

function getDueIds() {
  const now = Date.now();
  const items = wordbook.load();
  const map = loadState();
  const valid = {};
  let dirty = false;

  items.forEach((item) => {
    valid[item.id] = true;
  });
  Object.keys(map).forEach((id) => {
    if (!valid[id]) {
      delete map[id];
      dirty = true;
    }
  });

  const ids = [];
  items.forEach((item) => {
    const state = map[item.id];
    if (!state || typeof state.dueAt !== 'number' || state.dueAt <= now) {
      ids.push(item.id);
    }
  });

  if (dirty) {
    saveState(map);
  }
  return ids;
}

function getDueCount() {
  return getDueIds().length;
}

function registerFail(lang, word) {
  if (!wordbook.isSaved(word, lang)) {
    return false;
  }
  record(wordbook.makeId(lang, word), false);
  return true;
}

module.exports = {
  loadState,
  getState,
  record,
  getDueIds,
  getDueCount,
  registerFail,
};
