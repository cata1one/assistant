// Стикеры доски: собственные рисунки (SVG) и тематические наборы эмодзи.
// Картинки из Pinterest использовать нельзя — это чужие работы. Свои стикеры можно загрузить как картинку.

const svg = (body, vb = "0 0 100 100") =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`)}`;

const badge = (text, fill, stroke, color = "#fff", size = 15) => svg(
  `<path d="M10 22h80l-6 14 6 14H10l6-14z" fill="${stroke}"/><rect x="14" y="16" width="72" height="40" rx="10" fill="${fill}"/>` +
  `<text x="50" y="42" text-anchor="middle" font-family="Manrope,Arial,sans-serif" font-weight="800" font-size="${size}" fill="${color}">${text}</text>`,
  "0 0 100 70");

const DRAWN = {
  // Хэллоуин
  "hw-pumpkin": svg('<ellipse cx="50" cy="58" rx="40" ry="32" fill="#FF8A2B"/><ellipse cx="50" cy="58" rx="16" ry="32" fill="#FF9F45"/><path d="M47 26q2-14 12-16" stroke="#3F7D3A" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M32 52l8-8 8 8zM52 52l8-8 8 8z" fill="#5A2A0A"/><path d="M33 68q17 12 34 0l-6 3-5-4-6 4-6-4-5 4z" fill="#5A2A0A"/>'),
  "hw-ghost": svg('<path d="M20 88V45a30 30 0 0 1 60 0v43l-10-8-10 8-10-8-10 8-10-8z" fill="#fff" stroke="#C9CCE0" stroke-width="3"/><circle cx="40" cy="45" r="5" fill="#1E2235"/><circle cx="60" cy="45" r="5" fill="#1E2235"/><ellipse cx="50" cy="60" rx="6" ry="8" fill="#1E2235"/>'),
  "hw-bat": svg('<path d="M50 40c-6-8-14-6-14 2-8-8-22-6-30 6 10-2 14 4 14 10 6-6 12-4 14 2 4-4 10-4 16 0 4-4 10-4 16 0 2-6 8-8 14-2 0-6 4-12 14-10-8-12-22-14-30-6 0-8-8-10-14-2z" fill="#3B2F5C"/><circle cx="46" cy="48" r="2.5" fill="#FFC24B"/><circle cx="54" cy="48" r="2.5" fill="#FFC24B"/>'),
  "hw-candy": svg('<path d="M28 50L8 36v28zM72 50l20-14v28z" fill="#FF6FA8"/><circle cx="50" cy="50" r="24" fill="#FF6FA8"/><path d="M34 40q16 20 32 0M34 60q16-20 32 0" stroke="#fff" stroke-width="5" fill="none"/>'),
  // Новый год
  "ny-tree": svg('<path d="M50 8l22 30H60l18 24H62l18 22H20l18-22H22l18-24H28z" fill="#2E9E5B"/><rect x="44" y="84" width="12" height="12" rx="2" fill="#8B5A2B"/><path d="M50 2l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z" fill="#FFC24B"/><circle cx="40" cy="50" r="4" fill="#F2643D"/><circle cx="60" cy="66" r="4" fill="#3D63F5"/><circle cx="44" cy="74" r="4" fill="#FFC24B"/>'),
  "ny-snow": svg('<g stroke="#5BA8F0" stroke-width="6" stroke-linecap="round"><path d="M50 8v84M14 29l72 42M14 71l72-42"/><path d="M50 20l-8-8M50 20l8-8M50 80l-8 8M50 80l8 8"/></g>'),
  "ny-gift": svg('<rect x="14" y="40" width="72" height="52" rx="6" fill="#F2643D"/><rect x="8" y="28" width="84" height="18" rx="5" fill="#FF8A65"/><rect x="44" y="28" width="12" height="64" fill="#FFC24B"/><path d="M50 28c-10-18-30-14-22 0zM50 28c10-18 30-14 22 0z" fill="#FFC24B"/>'),
  "ny-ball": svg('<rect x="42" y="6" width="16" height="12" rx="3" fill="#C9A227"/><circle cx="50" cy="56" r="38" fill="#3D63F5"/><path d="M14 50q36 14 72 0" stroke="#FFC24B" stroke-width="6" fill="none"/><circle cx="36" cy="40" r="7" fill="#fff" opacity=".6"/>'),
  // Китайский Новый год
  "cny-lantern": svg('<rect x="44" y="4" width="12" height="10" fill="#C9A227"/><ellipse cx="50" cy="52" rx="38" ry="34" fill="#E53935"/><path d="M50 18v68M30 22q-10 30 0 60M70 22q10 30 0 60" stroke="#B71C1C" stroke-width="3" fill="none"/><rect x="30" y="16" width="40" height="8" rx="3" fill="#FFC24B"/><rect x="30" y="80" width="40" height="8" rx="3" fill="#FFC24B"/><path d="M46 88h8v8l-4 4-4-4z" fill="#FFC24B"/>'),
  "cny-envelope": svg('<rect x="18" y="8" width="64" height="86" rx="8" fill="#E53935"/><path d="M18 30q32 20 64 0" stroke="#B71C1C" stroke-width="3" fill="none"/><circle cx="50" cy="52" r="15" fill="#FFC24B"/><text x="50" y="59" text-anchor="middle" font-size="20" font-weight="800" fill="#B71C1C" font-family="sans-serif">福</text>'),
  "cny-fire": svg('<rect x="34" y="26" width="32" height="64" rx="8" fill="#E53935"/><rect x="34" y="40" width="32" height="6" fill="#FFC24B"/><rect x="34" y="70" width="32" height="6" fill="#FFC24B"/><path d="M50 26q0-10 10-16" stroke="#8B5A2B" stroke-width="4" fill="none"/><path d="M62 4l4 6 6-2-4 6 6 4-7 1-1 7-4-5-5 4 1-7z" fill="#FFC24B"/>'),
  "cny-orange": svg('<circle cx="50" cy="56" r="36" fill="#FF9F1C"/><path d="M50 20q4-12 18-14-2 14-18 14z" fill="#3F9E4B"/><circle cx="38" cy="44" r="6" fill="#fff" opacity=".5"/>'),
  // Похвала
  "pr-star": svg('<path d="M50 6l13 28 30 3-23 20 7 30-27-16-27 16 7-30L7 37l30-3z" fill="#FFC24B" stroke="#E0A22A" stroke-width="3" stroke-linejoin="round"/>'),
  "pr-heart": svg('<path d="M50 88S10 62 10 36a20 20 0 0 1 40-6 20 20 0 0 1 40 6c0 26-40 52-40 52z" fill="#FF5C7A"/>'),
  "pr-great": badge("Great job!", "#3D63F5", "#2A47C9", "#fff", 14),
  "pr-excellent": badge("Excellent!", "#22B07D", "#178a61"),
  "pr-welldone": badge("Well done!", "#F2643D", "#D44A24"),
  "pr-jiayou": badge("加油!", "#E53935", "#B71C1C", "#FFC24B", 22),
  "pr-taibangle": badge("太棒了!", "#FFC24B", "#E0A22A", "#B71C1C", 20),
  "pr-try": badge("Try again", "#8B7CF6", "#6a5ad8", "#fff", 14),
  // Школа
  "sc-apple": svg('<path d="M50 30c-14-10-38-4-36 24 2 26 20 40 36 32 16 8 34-6 36-32 2-28-22-34-36-24z" fill="#E53935"/><path d="M50 30q0-14 10-20" stroke="#6B4423" stroke-width="5" fill="none"/><path d="M52 20q16-12 26 0-14 8-26 0z" fill="#3F9E4B"/>'),
  "sc-book": svg('<path d="M8 22q22-8 42 4v62q-20-12-42-4z" fill="#3D63F5"/><path d="M92 22q-22-8-42 4v62q20-12 42-4z" fill="#5B7CF7"/><path d="M50 26v62" stroke="#2A47C9" stroke-width="3"/>'),
  "sc-pencil": svg('<path d="M18 82l8-22 46-46 14 14-46 46z" fill="#FFC24B"/><path d="M72 14l14 14 6-6-14-14z" fill="#FF8A9A"/><path d="M18 82l8-22 14 14z" fill="#F5D7A4"/><path d="M18 82l3-8 5 5z" fill="#1E2235"/>'),
  "sc-globe": svg('<circle cx="50" cy="50" r="40" fill="#5BA8F0"/><path d="M30 26q12 6 8 18t10 12q8 8 2 20M62 16q-6 12 8 16t12 18" fill="none" stroke="#22B07D" stroke-width="9" stroke-linecap="round"/>'),
  // Погода
  "wx-sun": svg('<circle cx="50" cy="50" r="20" fill="#FFC24B"/><g stroke="#FFC24B" stroke-width="7" stroke-linecap="round"><path d="M50 8v12M50 80v12M8 50h12M80 50h12M20 20l9 9M71 71l9 9M80 20l-9 9M29 71l-9 9"/></g>'),
  "wx-cloud": svg('<path d="M28 76a18 18 0 0 1 0-36 24 24 0 0 1 46-2 19 19 0 0 1 0 38z" fill="#fff" stroke="#C9D6EA" stroke-width="3"/>'),
  "wx-rainbow": svg('<g fill="none" stroke-width="9"><path d="M10 80a40 40 0 0 1 80 0" stroke="#FF5C7A"/><path d="M20 80a30 30 0 0 1 60 0" stroke="#FFC24B"/><path d="M30 80a20 20 0 0 1 40 0" stroke="#22B07D"/><path d="M40 80a10 10 0 0 1 20 0" stroke="#3D63F5"/></g>'),
};

const EMOJI = {
  "Хэллоуин": ["🎃", "👻", "🦇", "🕸️", "🕷️", "🍬", "🧙", "🧛", "💀", "🌕"],
  "Новый год": ["🎄", "❄️", "☃️", "🎁", "🦌", "✨", "🎅", "🧦", "🥂", "🕯️"],
  "Китайский Новый год": ["🧧", "🏮", "🐉", "🧨", "🥟", "🍊", "🐍", "🎋", "🥢", "🍵"],
  "Школа": ["📚", "✏️", "📐", "🎒", "🔬", "🌍", "🧮", "📝", "🎨", "🏫"],
  "Еда": ["🍎", "🍕", "🍩", "🍓", "🥐", "🧃", "🍔", "🍦", "🥕", "🍪"],
  "Животные": ["🐶", "🐱", "🦊", "🐼", "🐸", "🦄", "🐰", "🐻", "🐧", "🦋"],
  "Путешествия": ["✈️", "🗽", "🗼", "🏯", "🗺️", "🧳", "🚂", "🏖️", "🎡", "🚀"],
  "Реакции": ["⭐", "❤️", "👍", "🔥", "💯", "🎉", "👏", "😊", "🤔", "✅"],
};

const PACK_OF = { hw: "Хэллоуин", ny: "Новый год", cny: "Китайский Новый год", pr: "Похвала", sc: "Школа", wx: "Погода" };

export const PACKS = (() => {
  const packs = {};
  Object.entries(DRAWN).forEach(([id, src]) => {
    const pack = PACK_OF[id.split("-")[0]];
    (packs[pack] = packs[pack] || []).push({ id, src });
  });
  Object.entries(EMOJI).forEach(([pack, list]) => {
    list.forEach((e, i) => (packs[pack] = packs[pack] || []).push({ id: `em-${pack.length}-${i}-${[...e][0].codePointAt(0).toString(16)}`, emoji: e }));
  });
  return packs;
})();

const ALL = Object.values(PACKS).flat();
export const stickerById = (id) => ALL.find((s) => s.id === id);
