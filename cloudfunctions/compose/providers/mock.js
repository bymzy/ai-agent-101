const TRANSLATIONS = {
  cat: '猫',
  dog: '狗',
  apple: '苹果',
  cup: '杯子',
  book: '书',
  tree: '树',
  car: '汽车',
  chair: '椅子',
  window: '窗户',
  table: '桌子',
  phone: '手机',
  flower: '花',
};

function compose(words, opts) {
  const levelConfig = (opts && opts.levelConfig) || { id: 'primary', minWords: 2 };
  const level = levelConfig.id;
  const count = Math.max(2, levelConfig.minWords || 2);
  const usedWords = words.slice(0, count);

  if (usedWords.length < 2) {
    throw new Error('至少需要 2 个单词');
  }

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

  const translation = `我看见了${usedWords
    .map((word) => TRANSLATIONS[word] || word)
    .join('、')}。`;

  return Promise.resolve({ sentence, translation, usedWords });
}

module.exports = { compose };
