const { getProvider } = require('./providers');
const { getLevel } = require('./levels');
const { getLanguage } = require('./languages');

function ok(data) {
  return { ok: true, data };
}

function fail(code, message) {
  return { ok: false, error: { code, message } };
}

function dedupeWords(words) {
  const seen = {};
  const unique = [];
  words.forEach((word) => {
    const key = word.toLowerCase();
    if (!seen[key]) {
      seen[key] = true;
      unique.push(word);
    }
  });

  const lower = unique.map((word) => word.toLowerCase());
  const filtered = unique.filter((word, index) => {
    const current = lower[index];
    return !unique.some((other, otherIndex) => {
      if (otherIndex === index) {
        return false;
      }
      const candidate = lower[otherIndex];
      return candidate.length < current.length && current.indexOf(candidate) !== -1;
    });
  });

  return filtered.length >= 2 ? filtered : unique;
}

exports.main = async (event) => {
  const { words, level, scene, lang } = event || {};
  const raw = Array.isArray(words)
    ? words.filter((word) => typeof word === 'string' && word.trim())
    : [];
  const clean = dedupeWords(raw);
  const context = typeof scene === 'string' ? scene.replace(/\s+/g, ' ').trim().slice(0, 300) : '';

  if (clean.length < 2) {
    return fail('INVALID_ARGUMENT', '至少需要 2 个单词');
  }

  try {
    const levelConfig = getLevel(level);
    const langConfig = getLanguage(lang);
    const provider = getProvider();
    const result = await provider.compose(clean, {
      level: levelConfig.id,
      levelConfig,
      lang: langConfig.id,
      langConfig,
      scene: context,
    });
    return ok({
      sentence: (result && result.sentence) || '',
      translation: (result && result.translation) || '',
      usedWords: (result && result.usedWords) || [],
    });
  } catch (err) {
    return fail('COMPOSE_FAILED', (err && err.message) || '组句失败');
  }
};
