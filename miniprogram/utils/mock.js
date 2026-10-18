const WORDS_BY_LEVEL = {
  primary: [
    { word: 'cat', translation: '猫' },
    { word: 'dog', translation: '狗' },
    { word: 'apple', translation: '苹果' },
    { word: 'cup', translation: '杯子' },
  ],
  junior: [
    { word: 'book', translation: '书' },
    { word: 'tree', translation: '树' },
    { word: 'car', translation: '汽车' },
    { word: 'chair', translation: '椅子' },
  ],
  senior: [
    { word: 'window', translation: '窗户' },
    { word: 'table', translation: '桌子' },
    { word: 'phone', translation: '手机' },
    { word: 'flower', translation: '花' },
  ],
};

function recognize(level) {
  const pool = WORDS_BY_LEVEL[level] || WORDS_BY_LEVEL.primary;
  const words = pool.map((item, index) => ({
    word: item.word,
    translation: item.translation,
    confidence: Number((0.95 - index * 0.05).toFixed(2)),
    level: level || 'primary',
  }));
  return { words };
}

function compose(words, level) {
  const usedWords = (words || []).slice(0, 3);
  const a = usedWords[0];
  const b = usedWords[1];
  const c = usedWords[2] || a;

  let sentence;
  if (level === 'primary') {
    sentence = `I can see a ${a} and a ${b}.`;
  } else if (level === 'junior') {
    sentence = `There is a ${a}, a ${b}, and a ${c} in the picture.`;
  } else {
    sentence = `Looking at the picture, I can see a ${a}, a ${b}, and a ${c}, which makes it easy to remember these words.`;
  }

  const found = {};
  (WORDS_BY_LEVEL[level] || []).forEach((item) => {
    found[item.word] = item.translation;
  });

  return {
    sentence,
    translation: `我看见了${usedWords.map((word) => found[word] || word).join('、')}。`,
    usedWords,
  };
}

module.exports = {
  recognize,
  compose,
};
