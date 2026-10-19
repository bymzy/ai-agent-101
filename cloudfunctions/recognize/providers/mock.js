const WORDS_BY_LEVEL = {
  primary: [
    ['cat', '猫', '/kæt/'],
    ['dog', '狗', '/dɒɡ/'],
    ['apple', '苹果', '/ˈæp.əl/'],
    ['cup', '杯子', '/kʌp/'],
  ],
  junior: [
    ['book', '书', '/bʊk/'],
    ['tree', '树', '/triː/'],
    ['car', '汽车', '/kɑː(r)/'],
    ['chair', '椅子', '/tʃeə(r)/'],
  ],
  senior: [
    ['window', '窗户', '/ˈwɪn.dəʊ/'],
    ['table', '桌子', '/ˈteɪ.bəl/'],
    ['phone', '手机', '/fəʊn/'],
    ['flower', '花', '/ˈflaʊ.ə(r)/'],
  ],
};

function recognize(imageBuffer, opts) {
  const level = (opts && opts.level) || 'primary';
  const pool = WORDS_BY_LEVEL[level] || WORDS_BY_LEVEL.primary;
  const words = pool.map((item, index) => ({
    word: item[0],
    translation: item[1],
    phonetic: item[2],
    confidence: Number((0.95 - index * 0.05).toFixed(2)),
    level,
  }));
  return Promise.resolve({ words });
}

module.exports = { recognize };
