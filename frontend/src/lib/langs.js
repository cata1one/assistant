// Языки платформы: код, название, голос для озвучки браузером, флаг.
export const LANGS = [
  { id: "en", title: "Английский", tts: "en-US", flag: "🇬🇧" },
  { id: "zh", title: "Китайский", tts: "zh-CN", flag: "🇨🇳" },
  { id: "es", title: "Испанский", tts: "es-ES", flag: "🇪🇸" },
  { id: "fr", title: "Французский", tts: "fr-FR", flag: "🇫🇷" },
  { id: "it", title: "Итальянский", tts: "it-IT", flag: "🇮🇹" },
  { id: "pt", title: "Португальский", tts: "pt-BR", flag: "🇵🇹" },
  { id: "ar", title: "Арабский", tts: "ar-SA", flag: "🇸🇦" },
  { id: "sr", title: "Сербский", tts: "sr-RS", flag: "🇷🇸" },
  { id: "hi", title: "Хинди", tts: "hi-IN", flag: "🇮🇳" },
  { id: "el", title: "Греческий", tts: "el-GR", flag: "🇬🇷" },
];
export const langById = (id) => LANGS.find((l) => l.id === id) || LANGS[0];
export const ttsOf = (id) => langById(id).tts;
