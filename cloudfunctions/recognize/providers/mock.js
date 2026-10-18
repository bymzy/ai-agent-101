const WORDS_BY_LEVEL = {
  primary: [
    ['cat', '猫'],
    ['dog', '狗'],
    ['apple', '苹果'],
    ['cup', '杯子'],
  ],
  junior: [
    ['book', '书'],
    ['tree', '树'],
    ['car', '汽车'],
    ['chair', '椅子'],
  ],
  senior: [
    ['window', '窗户'],
    ['table', '桌子'],
    ['phone', '手机'],
    ['flower', '花'],
  ],
};

function recognize(imageBuffer, opts) {
  const level = (opts && opts.level) || 'primary';
  const pool = WORDS_BY_LEVEL[level] || WORDS_BY_LEVEL.primary;
  const words = pool.map((item, index) => ({
    word: item[0],
    translation: item[1],
    confidence: Number((0.95 - index * 0.05).toFixed(2)),
    level,
  }));
  return Promise.resolve({ words });
}

module.exports = { recognize };
