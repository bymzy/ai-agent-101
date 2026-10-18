const { getProvider } = require('./providers');
const { getLanguage } = require('./languages');

function ok(data) {
  return { ok: true, data };
}

function fail(code, message) {
  return { ok: false, error: { code, message } };
}

exports.main = async (event) => {
  const { text, voice, lang } = event || {};

  if (typeof text !== 'string' || !text.trim()) {
    return fail('INVALID_ARGUMENT', '缺少文本');
  }

  const content = text.trim();
  if (content.length > 500) {
    return fail('INVALID_ARGUMENT', '文本过长');
  }

  try {
    const langConfig = getLanguage(lang);
    const provider = getProvider();
    const result = await provider.synthesize(content, {
      voice: voice || langConfig.voice,
      lang: langConfig.id,
    });
    return ok(result);
  } catch (err) {
    return fail('TTS_FAILED', (err && err.message) || '语音合成失败');
  }
};
