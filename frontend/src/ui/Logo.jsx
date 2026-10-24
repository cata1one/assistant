/**
 * Логотип Bright: буква «b» на цветной плитке и тёплая искра рядом, как луч света.
 * Цвет плитки берётся у текущей роли (коралловый для преподавателей, синий для учеников) через currentColor.
 * У онлайн-школ рядом пишется School, у остальных название остаётся просто Bright.
 */
export function LogoMark({ size = 30, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={`text-brand ${className}`}>
      <rect width="32" height="32" rx="9.5" fill="currentColor" />
      <rect x="9" y="6.5" width="4.2" height="19" rx="2.1" fill="#fff" />
      <circle cx="18.2" cy="18.4" r="5.2" fill="none" stroke="#fff" strokeWidth="4.2" />
      <path d="M24.6 5.2l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z" fill="#FFD25E" />
    </svg>
  );
}

export default function Logo({ size = 30, school = false, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label={school ? "Bright School" : "Bright"}>
      <LogoMark size={size} />
      <span className="font-display text-[1.28rem] font-extrabold leading-none tracking-[-0.035em] text-ink">
        Bright{school && <span className="ml-1 font-semibold text-brand">School</span>}
      </span>
    </span>
  );
}
