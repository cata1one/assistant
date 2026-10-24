// Праздники: баннер с поздравлением и подсказкой, чем украсить кабинет или доску.
// Подвижные даты (Пасха, Масленица, китайский Новый год) считаются или берутся из таблицы.

const day = (y, m, d) => new Date(y, m - 1, d);
const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

/** Православная Пасха: алгоритм Мееуса для юлианского календаря + 13 дней (верно для 1900–2099). */
export function easter(year) {
  const a = year % 4, b = year % 7, c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const dd = ((d + e + 114) % 31) + 1;
  return addDays(day(year, month, dd), 13);
}

const CNY = { 2025: [1, 29], 2026: [2, 17], 2027: [2, 6], 2028: [1, 26], 2029: [2, 13], 2030: [2, 3], 2031: [1, 23] };

/** Окна праздников: [название, поздравление, начало, конец, набор стикеров, фон кабинета ученика]. */
function windows(y) {
  const pasha = easter(y);
  const list = [
    ["newyear", "С Новым годом!", "Скоро праздник: нарядите кабинет и доску.", day(y, 12, 15), day(y + 1, 1, 10), "Новый год", "newyear"],
    ["newyear", "С Новым годом!", "Скоро праздник: нарядите кабинет и доску.", day(y - 1, 12, 15), day(y, 1, 10), "Новый год", "newyear"],
    ["christmas", "С Рождеством!", "Тёплых праздников вам и вашим близким.", day(y, 1, 5), day(y, 1, 8), "Рождество", "newyear"],
    ["valentine", "С Днём всех влюблённых!", "Немного сердечек на доске никому не помешает.", day(y, 2, 10), day(y, 2, 14), "Валентин", "valentine"],
    ["feb23", "С 23 Февраля!", "С праздником, защитники и их учителя.", day(y, 2, 18), day(y, 2, 23), "23 февраля", "ocean"],
    ["mar8", "С 8 Марта!", "Весеннего настроения.", day(y, 3, 3), day(y, 3, 8), "8 Марта", "spring8"],
    ["maslenitsa", "Широкая Масленица!", "Блины на доске и в настроении.", addDays(pasha, -56), addDays(pasha, -49), "Масленица", "summer"],
    ["easter", "Светлой Пасхи!", "Яркой и доброй недели.", addDays(pasha, -7), pasha, "Пасха", "easter"],
    ["knowledge", "С Днём знаний!", "Новый учебный год: пусть будет интересно.", day(y, 8, 28), day(y, 9, 3), "День знаний", "forest"],
    ["teacher", "С Днём учителя!", "Спасибо за ваш труд.", day(y, 10, 3), day(y, 10, 6), "Школа", "default"],
    ["halloween", "Happy Halloween!", "Тыквы и привидения уже ждут на доске.", day(y, 10, 24), day(y, 11, 1), "Хэллоуин", "halloween"],
  ];
  const cny = CNY[y];
  if (cny) list.push(["cny", "新年快乐! С китайским Новым годом!", "Красные фонарики и конверты для урока китайского.", addDays(day(y, cny[0], cny[1]), -5),
    addDays(day(y, cny[0], cny[1]), 7), "Китайский Новый год", "sunset"]);
  return list;
}

export function currentHoliday(now = new Date()) {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
    for (const [id, title, text, from, to, pack, theme] of windows(y)) {
      if (t >= from && t <= to) return { id: `${id}-${to.getFullYear()}`, title, text, pack, theme };
    }
  }
  return null;
}
