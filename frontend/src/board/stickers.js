// Стикеры доски: объёмные Fluent Emoji 3D от Microsoft (лицензия MIT, файлы fe-*.webp в public)
// и собственные плашки с надписями (SVG). Картинки из Pinterest использовать нельзя – это чужие работы
// без лицензии. Свои стикеры можно загрузить как картинку.
import { FLUENT } from "./fluent.js";

const svg = (body, vb = "0 0 100 100") =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`)}`;

// Надпись-«таблетка» с объёмом: нижний край темнее, сверху блик
const badge = (text, fill, stroke, color = "#fff", size = 15) => svg(
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>` +
  `<rect x="6" y="15" width="88" height="42" rx="21" fill="${stroke}"/><rect x="6" y="11" width="88" height="42" rx="21" fill="${fill}"/>` +
  `<rect x="6" y="11" width="88" height="42" rx="21" fill="url(#g)"/>` +
  `<text x="50" y="38.5" text-anchor="middle" font-family="Arial Rounded MT Bold,Arial,sans-serif" font-weight="800" font-size="${size}" fill="${color}">${text}</text>`,
  "0 0 100 66");

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
  // Похвала на других языках
  "pr-muybien": badge("¡Muy bien!", "#F2643D", "#D44A24", "#fff", 14),
  "pr-tresbien": badge("Très bien !", "#3D63F5", "#2A47C9", "#fff", 14),
  "pr-moltobene": badge("Molto bene!", "#22B07D", "#178a61", "#fff", 13),
  "pr-muitobem": badge("Muito bem!", "#FFC24B", "#E0A22A", "#1E2235", 14),
  "pr-bravo-sr": badge("Браво!", "#8B7CF6", "#6a5ad8", "#fff", 17),
  "pr-bravo-gr": badge("Μπράβο!", "#5BA8F0", "#3a86d0", "#fff", 16),
  "pr-shabash": badge("शाबाश!", "#FF8A2B", "#d96d14", "#fff", 18),
  "pr-ahsant": badge("أحسنت!", "#2E9E5B", "#217a45", "#fff", 18),
  "pr-super": badge("Super!", "#FF5C7A", "#d93d5c", "#fff", 17),
  "pr-wow": badge("WOW!", "#1E2235", "#000", "#FFC24B", 19),
  // Эмоции
  "em-happy": svg('<circle cx="50" cy="50" r="42" fill="#FFC24B"/><circle cx="36" cy="42" r="5" fill="#1E2235"/><circle cx="64" cy="42" r="5" fill="#1E2235"/><path d="M30 58q20 22 40 0" stroke="#1E2235" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="26" cy="58" r="6" fill="#FF8A9A" opacity=".7"/><circle cx="74" cy="58" r="6" fill="#FF8A9A" opacity=".7"/>'),
  "em-love": svg('<circle cx="50" cy="50" r="42" fill="#FFC24B"/><path d="M36 46s-10-6-10-12a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-10 12-10 12zM64 46s-10-6-10-12a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-10 12-10 12z" fill="#E53935"/><path d="M32 60q18 18 36 0" stroke="#1E2235" stroke-width="6" fill="none" stroke-linecap="round"/>'),
  "em-think": svg('<circle cx="50" cy="50" r="42" fill="#FFC24B"/><circle cx="36" cy="42" r="5" fill="#1E2235"/><circle cx="64" cy="42" r="5" fill="#1E2235"/><path d="M28 32l14-4M58 28l14 4" stroke="#1E2235" stroke-width="4" stroke-linecap="round"/><path d="M38 66h24" stroke="#1E2235" stroke-width="6" stroke-linecap="round"/><path d="M70 78q10-4 8-14" stroke="#E0A22A" stroke-width="8" fill="none" stroke-linecap="round"/>'),
  "em-cool": svg('<circle cx="50" cy="50" r="42" fill="#FFC24B"/><path d="M20 38h60v6q-2 14-16 14t-14-12h0q0 12-14 12T20 44z" fill="#1E2235"/><path d="M34 66q16 12 32 0" stroke="#1E2235" stroke-width="6" fill="none" stroke-linecap="round"/>'),
  "em-wow": svg('<circle cx="50" cy="50" r="42" fill="#FFC24B"/><circle cx="36" cy="40" r="7" fill="#fff"/><circle cx="64" cy="40" r="7" fill="#fff"/><circle cx="36" cy="40" r="4" fill="#1E2235"/><circle cx="64" cy="40" r="4" fill="#1E2235"/><ellipse cx="50" cy="66" rx="9" ry="12" fill="#1E2235"/>'),
  // Новый год и Рождество
  "ny-snowman": svg('<circle cx="50" cy="72" r="24" fill="#fff" stroke="#C9D6EA" stroke-width="3"/><circle cx="50" cy="40" r="17" fill="#fff" stroke="#C9D6EA" stroke-width="3"/><path d="M36 28h28l-4-18H40z" fill="#3B2F5C"/><rect x="32" y="26" width="36" height="6" rx="3" fill="#E53935"/><circle cx="44" cy="38" r="2.5" fill="#1E2235"/><circle cx="56" cy="38" r="2.5" fill="#1E2235"/><path d="M50 43l12 3-12 3z" fill="#FF8A2B"/><circle cx="50" cy="66" r="2.5" fill="#1E2235"/><circle cx="50" cy="76" r="2.5" fill="#1E2235"/>'),
  "ny-mitten": svg('<path d="M30 92V50q-8-14 2-20t14 8V18q6-10 14 0v22q4-12 14-6t4 14l-4 30q-2 10-10 14H40q-10 0-10-12z" fill="#E53935"/><rect x="28" y="76" width="46" height="14" rx="4" fill="#fff"/><circle cx="46" cy="58" r="4" fill="#fff"/><circle cx="60" cy="48" r="4" fill="#fff"/>'),
  "ny-wish": badge("С Новым годом!", "#E53935", "#B71C1C", "#fff", 10),
  "ch-wish": badge("Merry Christmas!", "#2E9E5B", "#217a45", "#fff", 9),
  "ch-bell": svg('<path d="M50 10q4 0 4 5 22 6 22 34l8 14H16l8-14q0-28 22-34 0-5 4-5z" fill="#FFC24B" stroke="#E0A22A" stroke-width="3"/><circle cx="50" cy="82" r="8" fill="#E0A22A"/><path d="M30 20q10-10 20-8M70 20q-10-10-20-8" stroke="#2E9E5B" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="38" cy="14" r="4" fill="#E53935"/><circle cx="62" cy="14" r="4" fill="#E53935"/>'),
  // 23 февраля и 8 Марта
  "f23-badge": badge("23 февраля", "#3D63F5", "#2A47C9", "#fff", 12),
  "f23-star": svg('<path d="M50 6l13 28 30 3-23 20 7 30-27-16-27 16 7-30L7 37l30-3z" fill="#E53935" stroke="#B71C1C" stroke-width="3" stroke-linejoin="round"/><text x="50" y="58" text-anchor="middle" font-size="22" font-weight="800" fill="#FFC24B" font-family="Manrope,Arial,sans-serif">23</text>'),
  "m8-badge": badge("8 Марта", "#FF5C8A", "#d93d6a", "#fff", 15),
  "m8-bouquet": svg('<path d="M50 94L30 52h40z" fill="#8B7CF6"/><g fill="#FF8AB3"><circle cx="34" cy="38" r="12"/><circle cx="50" cy="26" r="12"/><circle cx="66" cy="38" r="12"/></g><g fill="#FFC24B"><circle cx="34" cy="38" r="4"/><circle cx="50" cy="26" r="4"/><circle cx="66" cy="38" r="4"/></g><path d="M44 44q6 8 12 0" stroke="#2E9E5B" stroke-width="5" fill="none"/>'),
  // День святого Валентина
  "vd-letter": svg('<rect x="8" y="22" width="84" height="58" rx="8" fill="#FFE4EA" stroke="#FF5C7A" stroke-width="3"/><path d="M10 26l40 30 40-30" stroke="#FF5C7A" stroke-width="3" fill="none"/><path d="M50 74S34 62 34 52a8 8 0 0 1 16-2 8 8 0 0 1 16 2c0 10-16 22-16 22z" fill="#E53935" transform="translate(0 -4) scale(1 .9) translate(0 8)"/>'),
  "vd-rose": svg('<path d="M50 94V56" stroke="#2E9E5B" stroke-width="6"/><path d="M50 80q-18-2-22-18 14 0 22 12z" fill="#3F9E4B"/><circle cx="50" cy="36" r="26" fill="#E53935"/><path d="M50 36q-12-6-4-16 8 4 8 12-6 2-4 8z" fill="#B71C1C"/><path d="M36 38q6 14 20 12" stroke="#B71C1C" stroke-width="4" fill="none" stroke-linecap="round"/>'),
  "vd-wish": badge("Be mine", "#FF5C7A", "#d93d5c", "#fff", 18),
  // Пасха и Масленица
  "ea-egg": svg('<path d="M50 6C28 6 16 44 16 62a34 32 0 0 0 68 0C84 44 72 6 50 6z" fill="#8B7CF6"/><path d="M18 56q16 10 32 0t32 0" stroke="#FFC24B" stroke-width="6" fill="none"/><path d="M20 72q15 9 30 0t30 0" stroke="#fff" stroke-width="5" fill="none"/><circle cx="38" cy="38" r="4" fill="#FF8AB3"/><circle cx="62" cy="38" r="4" fill="#FF8AB3"/>'),
  "ea-chick": svg('<circle cx="50" cy="56" r="34" fill="#FFD84B"/><path d="M26 18l10 16M50 12v16M74 18L64 34" stroke="#FFD84B" stroke-width="6" stroke-linecap="round"/><circle cx="38" cy="50" r="4" fill="#1E2235"/><circle cx="62" cy="50" r="4" fill="#1E2235"/><path d="M44 60h12l-6 8z" fill="#FF8A2B"/><path d="M26 62q-14 6-10 18" stroke="#FFD84B" stroke-width="8" fill="none" stroke-linecap="round"/>'),
  "ea-wish": badge("Христос воскресе!", "#FFC24B", "#E0A22A", "#7a3b00", 8),
  "ms-pancakes": svg('<ellipse cx="50" cy="78" rx="38" ry="12" fill="#D9892B"/><ellipse cx="50" cy="68" rx="38" ry="12" fill="#F2B04A"/><ellipse cx="50" cy="56" rx="36" ry="12" fill="#D9892B"/><ellipse cx="50" cy="46" rx="36" ry="12" fill="#F2B04A"/><path d="M26 46q8 12 12 0t12 6 12-6 12 6" fill="#FFF1C2"/><circle cx="50" cy="30" r="8" fill="#E53935"/>'),
  "ms-sun": badge("Масленица!", "#FF9F1C", "#d98200", "#fff", 14),
  // День знаний
  "kn-badge": badge("1 сентября", "#3D63F5", "#2A47C9", "#fff", 13),
  "kn-bell": svg('<path d="M50 10q4 0 4 5 22 6 22 34l8 14H16l8-14q0-28 22-34 0-5 4-5z" fill="#FFC24B" stroke="#E0A22A" stroke-width="3"/><circle cx="50" cy="82" r="8" fill="#E0A22A"/><path d="M34 30q-6 10-4 22" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".6"/>'),
  "kn-backpack": svg('<rect x="22" y="20" width="56" height="70" rx="16" fill="#F2643D"/><rect x="32" y="52" width="36" height="26" rx="8" fill="#FF8A65"/><path d="M40 20q0-14 10-14t10 14" stroke="#D44A24" stroke-width="5" fill="none"/><rect x="40" y="62" width="20" height="6" rx="3" fill="#FFF1CF"/>'),
  // День рождения
  "bd-wish": badge("Happy Birthday!", "#FF5C7A", "#d93d5c", "#fff", 10),
  "bd-ru": badge("С днём рождения!", "#8B7CF6", "#6a5ad8", "#fff", 9),
  "bd-crown": svg('<path d="M12 74L8 28l26 20 16-30 16 30 26-20-4 46z" fill="#FFC24B" stroke="#E0A22A" stroke-width="3" stroke-linejoin="round"/><rect x="12" y="74" width="76" height="12" rx="4" fill="#E0A22A"/><circle cx="8" cy="28" r="5" fill="#E53935"/><circle cx="50" cy="18" r="5" fill="#3D63F5"/><circle cx="92" cy="28" r="5" fill="#22B07D"/>'),
  "bd-hat": svg('<path d="M50 8l32 78H18z" fill="#8B7CF6"/><path d="M30 56l40 0M24 72h52" stroke="#FFC24B" stroke-width="6"/><circle cx="50" cy="10" r="8" fill="#FF5C7A"/><circle cx="42" cy="38" r="4" fill="#FFC24B"/><circle cx="58" cy="44" r="4" fill="#fff"/>'),
  // Осень
  "au-leaf": svg('<path d="M50 94V60M50 8l8 16 14-6-4 18 18-2-12 14 12 10-22 2 4 16-18-8-18 8 4-16-22-2 12-10-12-14 18 2-4-18 14 6z" fill="#E8742A"/><path d="M50 94V50" stroke="#8B5A2B" stroke-width="4"/>'),
  "au-mushroom": svg('<path d="M10 52a40 36 0 0 1 80 0z" fill="#E53935"/><rect x="36" y="52" width="28" height="36" rx="10" fill="#FFF1CF"/><circle cx="30" cy="38" r="6" fill="#fff"/><circle cx="52" cy="30" r="7" fill="#fff"/><circle cx="72" cy="42" r="5" fill="#fff"/>'),
  // Похвала по-русски
  "pr-molodec": badge("Молодец!", "#22B07D", "#178a61", "#fff", 17),
  "pr-otlichno": badge("Отлично!", "#3D63F5", "#2A47C9", "#fff", 17),
  "pr-super-ru": badge("Супер!", "#F2643D", "#D44A24", "#fff", 18),
  "pr-5": svg('<circle cx="50" cy="50" r="42" fill="#22B07D"/><text x="50" y="68" text-anchor="middle" font-size="56" font-weight="800" fill="#fff" font-family="Manrope,Arial,sans-serif">5</text><path d="M18 22q4-10 14-12M82 78q-4 10-14 12" stroke="#FFC24B" stroke-width="5" fill="none" stroke-linecap="round"/>'),
  "sc-bell-r": svg('<circle cx="50" cy="50" r="42" fill="#FFF1CF"/><path d="M50 22q3 0 3 4 16 4 16 24l6 10H25l6-10q0-20 16-24 0-4 3-4z" fill="#FFC24B"/><circle cx="50" cy="66" r="5" fill="#E0A22A"/>'),
  // Проверка работы
  "ck-yes": svg('<circle cx="50" cy="50" r="42" fill="#1F9D63"/><path d="M28 52l15 15 30-32" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  "ck-no": svg('<circle cx="50" cy="50" r="42" fill="#D93B3B"/><path d="M33 33l34 34M67 33L33 67" stroke="#fff" stroke-width="10" stroke-linecap="round"/>'),
  "ck-q": svg('<circle cx="50" cy="50" r="42" fill="#F5B400"/><text x="50" y="68" text-anchor="middle" font-size="52" font-weight="800" fill="#17171A" font-family="Arial,sans-serif">?</text>'),
  "ck-almost": badge("Почти!", "#F5B400", "#C99300", "#17171A", 18),
  "ck-think": badge("Подумай ещё", "#6E5BD8", "#5444B8", "#fff", 11),
  "ck-repeat": badge("Повтори", "#2B59E8", "#1E44C0", "#fff", 16),
  "ck-perfect": badge("Идеально!", "#1F9D63", "#16784B", "#fff", 14),
  "ck-stars": svg('<g fill="#F5B400" stroke="#C99300" stroke-width="2" stroke-linejoin="round"><path d="M18 30l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z"/><path d="M50 22l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z"/><path d="M82 30l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z"/></g>', "0 0 100 70"),
  // Пометки для грамматики: цвет помогает запомнить часть речи
  "gr-noun": badge("Noun", "#2B59E8", "#1E44C0", "#fff", 18),
  "gr-verb": badge("Verb", "#E4572E", "#C2421D", "#fff", 18),
  "gr-adj": badge("Adjective", "#1F9D63", "#16784B", "#fff", 14),
  "gr-adv": badge("Adverb", "#6E5BD8", "#5444B8", "#fff", 16),
  "gr-present": badge("Present", "#17171A", "#000", "#FFD43B", 17),
  "gr-past": badge("Past", "#8A6400", "#6B4E00", "#fff", 18),
  "gr-future": badge("Future", "#0E7C86", "#095F66", "#fff", 17),
  "gr-rule": badge("Правило", "#FFD43B", "#F5B400", "#17171A", 16),
  "gr-example": badge("Пример", "#E7E5DF", "#CFCCC3", "#17171A", 17),
  "gr-remember": badge("Запомни!", "#D93B3B", "#B02C2C", "#fff", 15),
  "gr-hw": badge("Homework", "#2B59E8", "#1E44C0", "#fff", 14),
  "gr-test": badge("Test", "#17171A", "#000", "#fff", 18),
  // Весна и лето
  "sp-flower": svg('<g fill="#FF8AB3"><circle cx="50" cy="26" r="16"/><circle cx="74" cy="44" r="16"/><circle cx="65" cy="72" r="16"/><circle cx="35" cy="72" r="16"/><circle cx="26" cy="44" r="16"/></g><circle cx="50" cy="52" r="13" fill="#FFC24B"/>'),
  "sp-tulip": svg('<path d="M50 92V50" stroke="#2E9E5B" stroke-width="6"/><path d="M50 74q-20-2-24-20 16 0 24 14zM50 80q18-4 22-20-14 2-22 14z" fill="#3F9E4B"/><path d="M30 20l10 12 10-16 10 16 10-12v18a20 20 0 0 1-40 0z" fill="#E53935"/>'),
  "sp-butterfly": svg('<path d="M50 30q-30-26-38 2-4 20 38 18zM50 30q30-26 38 2 4 20-38 18zM50 52q-26 2-28 20 6 14 28-6zM50 52q26 2 28 20-6 14-28-6z" fill="#8B7CF6"/><circle cx="30" cy="34" r="6" fill="#FFC24B"/><circle cx="70" cy="34" r="6" fill="#FFC24B"/><rect x="47" y="24" width="6" height="56" rx="3" fill="#1E2235"/>'),
  "su-icecream": svg('<path d="M32 50l18 44 18-44z" fill="#E0A96D"/><path d="M36 54l28 0M40 64h20" stroke="#b8834a" stroke-width="3"/><circle cx="40" cy="40" r="14" fill="#FF8AB3"/><circle cx="60" cy="40" r="14" fill="#BFE3FF"/><circle cx="50" cy="26" r="14" fill="#FFF1C2"/><circle cx="50" cy="12" r="5" fill="#E53935"/>'),
  "su-watermelon": svg('<path d="M10 40a40 40 0 0 0 80 0z" fill="#2E9E5B"/><path d="M16 40a34 34 0 0 0 68 0z" fill="#FF5C7A"/><g fill="#1E2235"><ellipse cx="36" cy="54" rx="2.5" ry="4"/><ellipse cx="50" cy="60" rx="2.5" ry="4"/><ellipse cx="64" cy="54" rx="2.5" ry="4"/></g>'),
  // Космос
  "sx-rocket": svg('<path d="M50 6q24 20 18 58H32Q26 26 50 6z" fill="#EEF1F8" stroke="#C9CCE0" stroke-width="3"/><circle cx="50" cy="38" r="9" fill="#5BA8F0" stroke="#3D63F5" stroke-width="3"/><path d="M32 52l-14 18h16zM68 52l14 18H66z" fill="#E53935"/><path d="M40 66q10 34 20 0z" fill="#FF8A2B"/>'),
  "sx-planet": svg('<circle cx="50" cy="50" r="28" fill="#8B7CF6"/><ellipse cx="50" cy="50" rx="46" ry="12" fill="none" stroke="#FFC24B" stroke-width="6" transform="rotate(-18 50 50)"/><circle cx="40" cy="40" r="6" fill="#fff" opacity=".35"/>'),
  "sx-star": svg('<path d="M50 4l6 34 34 6-34 6-6 34-6-34-34-6 34-6z" fill="#FFC24B"/>'),
  // Животные
  "an-cat": svg('<path d="M20 40L24 10l20 18h12l20-18 4 30v20a30 28 0 0 1-60 0z" fill="#FF9F45"/><circle cx="38" cy="52" r="5" fill="#1E2235"/><circle cx="62" cy="52" r="5" fill="#1E2235"/><path d="M46 62h8l-4 5z" fill="#FF5C7A"/><path d="M14 62h18M14 70h18M68 62h18M68 70h18" stroke="#1E2235" stroke-width="2"/>'),
  "an-fox": svg('<path d="M10 20l30 20h20l30-20-8 40-32 30-32-30z" fill="#FF8A2B"/><path d="M26 58l24 32 24-32-24 8z" fill="#fff"/><circle cx="36" cy="50" r="4" fill="#1E2235"/><circle cx="64" cy="50" r="4" fill="#1E2235"/><circle cx="50" cy="86" r="5" fill="#1E2235"/>'),
  "an-panda": svg('<circle cx="24" cy="24" r="14" fill="#1E2235"/><circle cx="76" cy="24" r="14" fill="#1E2235"/><circle cx="50" cy="54" r="38" fill="#fff" stroke="#C9CCE0" stroke-width="3"/><ellipse cx="34" cy="50" rx="10" ry="13" fill="#1E2235"/><ellipse cx="66" cy="50" rx="10" ry="13" fill="#1E2235"/><circle cx="34" cy="48" r="3" fill="#fff"/><circle cx="66" cy="48" r="3" fill="#fff"/><ellipse cx="50" cy="68" rx="7" ry="5" fill="#1E2235"/>'),
  // Еда и праздник
  "fd-pizza": svg('<path d="M50 92L12 18q38-18 76 0z" fill="#FFC24B"/><path d="M12 18q38-18 76 0l-6 12q-32-14-64 0z" fill="#E0A96D"/><g fill="#E53935"><circle cx="44" cy="40" r="7"/><circle cx="60" cy="54" r="6"/><circle cx="48" cy="68" r="5"/></g>'),
  "fd-cupcake": svg('<path d="M24 52h52l-8 40H32z" fill="#5BA8F0"/><path d="M30 52v40M42 52v40M58 52v40M70 52v40" stroke="#3D63F5" stroke-width="2"/><path d="M18 54q0-30 32-34 32 4 32 34z" fill="#FF8AB3"/><circle cx="50" cy="14" r="7" fill="#E53935"/>'),
  "bd-cake": svg('<rect x="16" y="50" width="68" height="40" rx="6" fill="#FF8AB3"/><path d="M16 62q11 8 22 0t22 0 24 0" stroke="#fff" stroke-width="5" fill="none"/><rect x="24" y="38" width="52" height="14" rx="4" fill="#FFF1C2"/><g fill="#5BA8F0"><rect x="36" y="20" width="5" height="18"/><rect x="48" y="20" width="5" height="18"/><rect x="60" y="20" width="5" height="18"/></g><g fill="#FFC24B"><ellipse cx="38.5" cy="15" rx="3" ry="5"/><ellipse cx="50.5" cy="15" rx="3" ry="5"/><ellipse cx="62.5" cy="15" rx="3" ry="5"/></g>'),
  "bd-balloon": svg('<ellipse cx="50" cy="38" rx="28" ry="32" fill="#E53935"/><path d="M46 70h8l-4 6z" fill="#B71C1C"/><path d="M50 76q-8 10 0 20" stroke="#6B7280" stroke-width="2" fill="none"/><ellipse cx="40" cy="26" rx="6" ry="10" fill="#fff" opacity=".4"/>'),
  // Погода
  "wx-sun": svg('<circle cx="50" cy="50" r="20" fill="#FFC24B"/><g stroke="#FFC24B" stroke-width="7" stroke-linecap="round"><path d="M50 8v12M50 80v12M8 50h12M80 50h12M20 20l9 9M71 71l9 9M80 20l-9 9M29 71l-9 9"/></g>'),
  "wx-cloud": svg('<path d="M28 76a18 18 0 0 1 0-36 24 24 0 0 1 46-2 19 19 0 0 1 0 38z" fill="#fff" stroke="#C9D6EA" stroke-width="3"/>'),
  "wx-rainbow": svg('<g fill="none" stroke-width="9"><path d="M10 80a40 40 0 0 1 80 0" stroke="#FF5C7A"/><path d="M20 80a30 30 0 0 1 60 0" stroke="#FFC24B"/><path d="M30 80a20 20 0 0 1 40 0" stroke="#22B07D"/><path d="M40 80a10 10 0 0 1 20 0" stroke="#3D63F5"/></g>'),
};

// Объёмные картинки вне наборов доски: тело Искорки, обложки учебников
export const ART = ["⭐", "🔁", "⚠️", "🏆", "💬", "🌱", "🚲", "🗺️", "🏔️", "🎓", "📝", "🐼", "💃", "🥐", "🍕", "🌍", "📚", "📖"];

const EMOJI = {
  "Молодец!": ["👍", "👏", "🔥", "💯", "🏆", "🥇", "🌟", "⭐", "🎉", "🎊", "💪", "🤩", "🥳", "👑", "🚀", "💎", "🎯", "🙌", "🌈", "💖", "🦄", "😎", "🤗", "🍀"],
  "Учёба": ["📚", "📖", "✏️", "🖊️", "📝", "🎓", "🎒", "🧠", "💡", "📌", "📎", "📏", "🔍", "⏰", "⌛", "📅", "💬", "🗣️", "🎧", "🎤", "💻", "📱", "🧮", "🔤", "❓", "❗", "✅", "❌", "🤔", "👀"],
  "Хэллоуин": ["🎃", "👻", "🦇", "🕸️", "🕷️", "🍬", "🧙", "🧛", "💀", "🌕"],
  "Новый год": ["🎄", "❄️", "☃️", "🎁", "🦌", "✨", "🎅", "🧦", "🥂", "🕯️"],
  "Китайский Новый год": ["🧧", "🏮", "🐉", "🧨", "🥟", "🍊", "🐍", "🎋", "🥢", "🍵"],
  "Школа": ["📚", "✏️", "📐", "🎒", "🔬", "🌍", "🧮", "📝", "🎨", "🏫"],
  "Еда": ["🍎", "🍕", "🍩", "🍓", "🥐", "🧃", "🍔", "🍦", "🥕", "🍪"],
  "Животные": ["🐶", "🐱", "🦊", "🐼", "🐸", "🦄", "🐰", "🐻", "🐧", "🦋"],
  "Путешествия": ["✈️", "🗽", "🗼", "🏯", "🗺️", "🧳", "🚂", "🏖️", "🎡", "🚀"],
  "Реакции": ["⭐", "❤️", "👍", "🔥", "💯", "🎉", "👏", "😊", "🤔", "✅"],
  "Эмоции": ["😀", "😂", "🥰", "😎", "🤩", "😴", "😱", "🥳", "🤓", "😇"],
  "Весна и лето": ["🌷", "🌸", "🌻", "🐝", "🍓", "🏝️", "🌈", "🍉", "🕶️", "⛱️"],
  "Осень": ["🍂", "🍁", "🍄", "🌰", "☔", "🧣", "🍎", "🦔", "🎃", "☕"],
  "Космос": ["🚀", "🪐", "🌙", "⭐", "☄️", "👽", "🛸", "🌍", "🔭", "🌌"],
  "Спорт и хобби": ["⚽", "🏀", "🎾", "🏊", "🚴", "🎸", "🎹", "🎮", "📷", "🧩"],
  "День рождения": ["🎂", "🎈", "🎁", "🥳", "🎉", "🕯️", "🍰", "🎊", "👑", "💝"],
  "Рождество": ["🎄", "⭐", "🔔", "🕯️", "👼", "🕊️", "🍪", "🧦", "🦌", "🎁"],
  "23 февраля": ["🎖️", "⭐", "🛡️", "🚀", "✈️", "⚓", "🏅", "🎖️", "💪", "🇷🇺"],
  "8 Марта": ["🌷", "🌸", "💐", "🌹", "🎀", "💝", "🦋", "🍰", "🌼", "👑"],
  "Валентин": ["💌", "❤️", "💕", "💘", "🌹", "🧸", "🍫", "😍", "💝", "🥰"],
  "Пасха": ["🥚", "🐣", "🐰", "🌷", "🥕", "🧺", "🐑", "🌼", "🕊️", "🍰"],
  "Масленица": ["🥞", "☀️", "🍯", "🔥", "🎪", "🍵", "🪆", "❄️", "🎶", "🧈"],
  "День знаний": ["🔔", "🎒", "📚", "✏️", "💐", "🍎", "🏫", "🧑‍🏫", "📏", "🌻"],
  "Праздники мира": ["🪔", "🎆", "🥮", "🌕", "🎑", "🌙", "🕌", "💀", "🌼", "🎭", "🥖", "🗼", "🎉", "🏮"],
  "Профессии": ["👩‍🏫", "👨‍⚕️", "👩‍🍳", "👮", "👨‍🚒", "👩‍💻", "👨‍🎨", "👩‍🔬", "🧑‍✈️", "👷", "👩‍🌾", "🧑‍⚖️"],
  "Транспорт": ["🚗", "🚌", "🚇", "🚲", "✈️", "🚢", "🚕", "🚆", "🛴", "🚁", "🚜", "🚀"],
  "Одежда": ["👕", "👖", "👗", "🧥", "👟", "🧢", "🧣", "🧤", "👓", "👜", "👠", "🩳"],
  "Дом и вещи": ["🛋️", "🛏️", "🚪", "🪟", "🚿", "🛁", "🍳", "🧺", "🪴", "💡", "📺", "⏰"],
  "Природа": ["🌳", "🌲", "🌵", "🌊", "⛰️", "🌋", "🏞️", "🌾", "🍀", "🌙", "🌧️", "❄️"],
  "Музыка": ["🎵", "🎸", "🎹", "🥁", "🎻", "🎤", "🎧", "🎺", "🎷", "🪗", "🎼", "📻"],
  "Жесты": ["👋", "👍", "👎", "👌", "✌️", "🤞", "👏", "🙌", "🤝", "🙏", "💪", "👀"],
  "Знаки и стрелки": ["⬆️", "⬇️", "⬅️", "➡️", "↔️", "🔄", "❗", "❓", "✔️", "❌", "➕", "➖", "⭐", "💡", "📌", "🔑"],
  "Языки и страны": ["🇬🇧", "🇺🇸", "🇨🇳", "🇪🇸", "🇫🇷", "🇮🇹", "🇵🇹", "🇧🇷", "🇷🇸", "🇬🇷", "🇮🇳", "🇸🇦", "🇦🇪", "🇲🇽"],
};

// Надписи остаются в наборе «Надписи», нарисованные картинки заменены объёмными стикерами
const LABELS = /^(pr-(great|excellent|welldone|jiayou|taibangle|try|muybien|tresbien|moltobene|muitobem|bravo|shabash|ahsant|super|wow|molodec|otlichno|5)|ck-|gr-)/;

/** Объёмная картинка для эмодзи, если она есть в наборе Fluent. */
export const fluentSrc = (e) => {
  const code = [...e].map((c) => c.codePointAt(0).toString(16)).join("-");
  const bare = code.replace(/-fe0f/g, "");
  const hit = FLUENT.has(code) ? code : FLUENT.has(bare) ? bare : null;
  return hit ? `/static/fe-${hit}.webp` : null;
};

const legacy = [];
export const PACKS = (() => {
  const packs = {};
  Object.entries(EMOJI).forEach(([pack, list]) => {
    list.forEach((e, i) => (packs[pack] = packs[pack] || []).push({ id: `em-${pack.length}-${i}-${[...e][0].codePointAt(0).toString(16)}`, emoji: e, src: fluentSrc(e) }));
  });
  Object.entries(DRAWN).forEach(([id, src]) => {
    if (!LABELS.test(id)) { legacy.push({ id, src }); return; }
    const pack = id.startsWith("gr-") ? "Грамматика" : id.startsWith("ck-") ? "Проверка" : "Надписи";
    (packs[pack] = packs[pack] || []).push({ id, src });
  });
  return packs;
})();

const ALL = [...Object.values(PACKS).flat(), ...legacy];
export const stickerById = (id) => ALL.find((s) => s.id === id);
