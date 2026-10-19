const WORDS_BY_LEVEL = {
  primary: [
    { word: 'cat', translation: '猫', phonetic: '/kæt/' },
    { word: 'dog', translation: '狗', phonetic: '/dɒɡ/' },
    { word: 'apple', translation: '苹果', phonetic: '/ˈæp.əl/' },
    { word: 'cup', translation: '杯子', phonetic: '/kʌp/' },
  ],
  junior: [
    { word: 'book', translation: '书', phonetic: '/bʊk/' },
    { word: 'tree', translation: '树', phonetic: '/triː/' },
    { word: 'car', translation: '汽车', phonetic: '/kɑː(r)/' },
    { word: 'chair', translation: '椅子', phonetic: '/tʃeə(r)/' },
  ],
  senior: [
    { word: 'window', translation: '窗户', phonetic: '/ˈwɪn.dəʊ/' },
    { word: 'table', translation: '桌子', phonetic: '/ˈteɪ.bəl/' },
    { word: 'phone', translation: '手机', phonetic: '/fəʊn/' },
    { word: 'flower', translation: '花', phonetic: '/ˈflaʊ.ə(r)/' },
  ],
};

function recognize(level) {
  const pool = WORDS_BY_LEVEL[level] || WORDS_BY_LEVEL.primary;
  const words = pool.map((item, index) => ({
    word: item.word,
    translation: item.translation,
    phonetic: item.phonetic,
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
