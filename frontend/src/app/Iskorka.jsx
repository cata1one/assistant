/**
 * Искорка – помощница Bright: объёмная звёздочка (Fluent Emoji 3D, MIT) с нарисованным лицом.
 * Настроения: happy, joy (верно!), think, wow, oops (ошибка), sleep. Моргает и покачивается.
 */
const EYES = {
  open: (
    <g className="isk-eyes">
      <ellipse cx="41" cy="54" rx="6.2" ry="7.6" fill="#2A1B12" /><ellipse cx="59" cy="54" rx="6.2" ry="7.6" fill="#2A1B12" />
      <circle cx="43.2" cy="51" r="2.4" fill="#fff" /><circle cx="61.2" cy="51" r="2.4" fill="#fff" />
      <circle cx="39.6" cy="57" r="1.1" fill="#fff" opacity=".8" /><circle cx="57.6" cy="57" r="1.1" fill="#fff" opacity=".8" />
    </g>
  ),
  up: (
    <g className="isk-eyes">
      <ellipse cx="41" cy="53" rx="6.2" ry="7.6" fill="#2A1B12" /><ellipse cx="59" cy="53" rx="6.2" ry="7.6" fill="#2A1B12" />
      <circle cx="40" cy="48.5" r="2.4" fill="#fff" /><circle cx="58" cy="48.5" r="2.4" fill="#fff" />
    </g>
  ),
  big: (
    <g className="isk-eyes">
      <ellipse cx="41" cy="53" rx="7.4" ry="9" fill="#2A1B12" /><ellipse cx="59" cy="53" rx="7.4" ry="9" fill="#2A1B12" />
      <circle cx="43.6" cy="49.4" r="3" fill="#fff" /><circle cx="61.6" cy="49.4" r="3" fill="#fff" />
      <circle cx="39.4" cy="57" r="1.4" fill="#fff" opacity=".8" /><circle cx="57.4" cy="57" r="1.4" fill="#fff" opacity=".8" />
    </g>
  ),
  smile: (
    <g fill="none" stroke="#2A1B12" strokeWidth="3" strokeLinecap="round">
      <path d="M35.5 55q5.5-6.5 11 0" /><path d="M53.5 55q5.5-6.5 11 0" />
    </g>
  ),
  closed: (
    <g fill="none" stroke="#2A1B12" strokeWidth="2.8" strokeLinecap="round">
      <path d="M35.5 54q5.5 4 11 0" /><path d="M53.5 54q5.5 4 11 0" />
    </g>
  ),
};

const MOUTH = {
  smile: <path d="M45.5 63.5q4.5 4.6 9 0" stroke="#2A1B12" strokeWidth="2.6" fill="none" strokeLinecap="round" />,
  open: <path d="M44 62.5h12q-1 8-6 8t-6-8z" fill="#7A2E1D" />,
  o: <ellipse cx="50" cy="65" rx="3.2" ry="3.8" fill="#7A2E1D" />,
  small: <ellipse cx="50" cy="64.5" rx="2.2" ry="1.8" fill="#7A2E1D" />,
  wave: <path d="M44.5 65q2.75-2.6 5.5 0t5.5 0" stroke="#2A1B12" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
};

const FACES = {
  happy: [EYES.open, MOUTH.smile],
  joy: [EYES.smile, MOUTH.open],
  think: [EYES.up, MOUTH.small],
  wow: [EYES.big, MOUTH.o],
  oops: [EYES.open, MOUTH.wave, <g key="b" stroke="#2A1B12" strokeWidth="2.2" strokeLinecap="round"><path d="M35 44.5l8 2.2" /><path d="M65 44.5l-8 2.2" /></g>],
  sleep: [EYES.closed, MOUTH.small],
};

export default function Iskorka({ mood = "happy", size = 64, still = false, className = "", title }) {
  const [eyes, mouth, extra] = FACES[mood] || FACES.happy;
  return (
    <span className={`isk relative inline-block shrink-0 ${still ? "" : `isk-live isk-${mood}`} ${className}`} style={{ width: size, height: size }}
      role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <img src="/static/fe-2b50.webp" alt="" draggable="false" className="isk-body h-full w-full select-none" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <g transform="translate(0 2)">
          {eyes}
          {mood !== "sleep" && <><ellipse cx="32" cy="63" rx="5" ry="3.2" fill="#FF7A8A" opacity=".55" /><ellipse cx="68" cy="63" rx="5" ry="3.2" fill="#FF7A8A" opacity=".55" /></>}
          {mouth}
          {extra}
        </g>
      </svg>
      {mood === "joy" && !still && (
        <span className="isk-sparks pointer-events-none absolute inset-0" aria-hidden="true">
          <i style={{ left: "-6%", top: "8%" }} /><i style={{ right: "-4%", top: "2%" }} /><i style={{ right: "-8%", bottom: "26%" }} />
        </span>
      )}
      {mood === "sleep" && <span className="absolute -right-1 -top-1 text-[0.32em] font-bold text-ink-mute" style={{ fontSize: size * 0.22 }}>z</span>}
    </span>
  );
}
