const cloud = require('wx-server-sdk');
const { getProvider } = require('./providers');
const { getLevel } = require('./levels');
const { getLanguage } = require('./languages');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function ok(data) {
  return { ok: true, data };
}

function fail(code, message) {
  return { ok: false, error: { code, message } };
}

exports.main = async (event) => {
  const { fileID, level, lang } = event || {};

  if (!fileID || typeof fileID !== 'string') {
    return fail('INVALID_ARGUMENT', '缺少 fileID');
  }

  try {
    const levelConfig = getLevel(level);
    const langConfig = getLanguage(lang);
    const { fileContent } = await cloud.downloadFile({ fileID });
    const provider = getProvider();
    const result = await provider.analyze(fileContent, {
      level: levelConfig.id,
      levelConfig,
      lang: langConfig.id,
      langConfig,
    });
    const words = ((result && result.words) || []).slice(0, levelConfig.maxWords);
    return ok({
      words,
      scene: (result && result.scene) || '',
      sentence: (result && result.sentence) || '',
      translation: (result && result.translation) || '',
      usedWords: (result && result.usedWords) || [],
    });
  } catch (err) {
    return fail('ANALYZE_FAILED', (err && err.message) || '分析失败');
  }
};
