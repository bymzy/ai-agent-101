const LANGUAGES = {
  en: {
    id: 'en',
    name: '英语',
    nativeName: 'English',
    speechLang: 'en-US',
    voice: 'English_Graceful_Lady',
  },
  ja: {
    id: 'ja',
    name: '日语',
    nativeName: '日本語',
    speechLang: 'ja-JP',
    voice: 'Japanese_KindLady',
  },
  ko: {
    id: 'ko',
    name: '韩语',
    nativeName: '한국어',
    speechLang: 'ko-KR',
    voice: 'Korean_SweetGirl',
  },
  fr: {
    id: 'fr',
    name: '法语',
    nativeName: 'Français',
    speechLang: 'fr-FR',
    voice: 'French_Female_News Anchor',
  },
  es: {
    id: 'es',
    name: '西班牙语',
    nativeName: 'Español',
    speechLang: 'es-ES',
    voice: 'Spanish_SereneWoman',
  },
  de: {
    id: 'de',
    name: '德语',
    nativeName: 'Deutsch',
    speechLang: 'de-DE',
    voice: 'German_FriendlyMan',
  },
};

const LANGUAGE_IDS = Object.keys(LANGUAGES);
const DEFAULT_LANGUAGE = 'en';

function getLanguage(id) {
  return LANGUAGES[id] || LANGUAGES[DEFAULT_LANGUAGE];
}

module.exports = {
  LANGUAGES,
  LANGUAGE_IDS,
  DEFAULT_LANGUAGE,
  getLanguage,
};
