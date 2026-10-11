/**
 * Логотип Better study.
 *
 * Знак (вариант Б, швейцарский минимализм): буква «B» собрана из трёх линий толщиной 2px,
 * которые не смыкаются. Нижняя чаша сдвинута вправо, поэтому между линиями остаётся
 * негативное пространство: в нём читается ступенька вверх, символ роста. Точка в углу —
 * «ученик», который вышел за рамки. Квадратные окончания, радиусы на сетке 4px.
 * Цвет знака — currentColor, точка — акцент (меняется через prop).
 *
 * Вордмарк набран Playfair Display: «Better» — белым, «study» — приглушённым, а в конце
 * стоит та же точка-акцент, что и в знаке. Так знак и надпись рифмуются.
 */
export function LogoMark({ size = 28, accent = "#10B981", className = "", title = "Better study" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label={title} className={className}>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
        {/* Ствол «B» — чуть выше верхней чаши, асимметрия как у ручной отрисовки */}
        <path d="M8 27V5" />
        {/* Верхняя чаша: открыта к стволу снизу */}
        <path d="M8 5h7.5a5.25 5.25 0 0 1 0 10.5H12" />
        {/* Нижняя чаша сдвинута вправо на 4px — ступенька в негативном пространстве */}
        <path d="M12 15.5h5.5a5.75 5.75 0 0 1 0 11.5H8" />
      </g>
      <circle cx="25.5" cy="6" r="2.25" fill={accent} />
    </svg>
  );
}

export default function CustomLogo({ compact = false, accent }) {
  return (
    <span className="group inline-flex items-center gap-2.5 text-white">
      <LogoMark size={compact ? 26 : 30} accent={accent}
        className="transition-transform duration-300 ease-out group-hover:-rotate-6" />
      <span className={`font-display font-semibold tracking-tightest ${compact ? "text-lg" : "text-xl"}`}>
        Better<span className="text-mist">{"\u2009"}study</span><span style={{ color: accent || "#10B981" }}>.</span>
      </span>
    </span>
  );
}
