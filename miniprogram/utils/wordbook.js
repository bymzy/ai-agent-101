const KEY = 'wordbook';

function load() {
  const list = wx.getStorageSync(KEY);
  return Array.isArray(list) ? list : [];
}

function makeId(lang, word) {
  return `${lang || 'en'}:${String(word || '').toLowerCase()}`;
}

function isSaved(word, lang) {
  const id = makeId(lang, word);
  return load().some((item) => item.id === id);
}

function add(entry, lang) {
  const id = makeId(lang, entry.word);
  const list = load();
  if (list.some((item) => item.id === id)) {
    return true;
  }
  list.unshift({
    id,
    word: entry.word,
    translation: entry.translation || '',
    category: entry.category || '其他',
    lang: lang || 'en',
    level: entry.level || '',
    addedAt: Date.now(),
  });
  wx.setStorageSync(KEY, list);
  return true;
}

function remove(id) {
  const list = load().filter((item) => item.id !== id);
  wx.setStorageSync(KEY, list);
}

function toggle(entry, lang) {
  const id = makeId(lang, entry.word);
  const list = load();
  const index = list.findIndex((item) => item.id === id);
  if (index !== -1) {
    list.splice(index, 1);
    wx.setStorageSync(KEY, list);
    return false;
  }
  add(entry, lang);
  return true;
}

module.exports = {
  load,
  isSaved,
  add,
  remove,
  toggle,
  makeId,
};
