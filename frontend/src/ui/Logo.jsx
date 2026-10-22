/**
 * Логотип Better: облачко реплики (язык — это разговор) с буквой «b» внутри.
 * Цвет — текущий продукт (BetterStudy синий, BetterTeach коралловый) через currentColor.
 */
export function LogoMark({ size = 30, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={`text-brand ${className}`}>
      <path fill="currentColor" d="M8 3h17a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H15l-6.2 4.6c-.6.4-1.3 0-1.3-.7V25H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5z" />
      <rect x="9.6" y="7" width="3.4" height="14.2" rx="1.7" fill="#fff" />
      <circle cx="17" cy="16.6" r="4.4" fill="none" stroke="#fff" strokeWidth="3.4" />
    </svg>
  );
}

export default function Logo({ brand = "study", size = 30, className = "" }) {
  const word = brand === "teach" ? "Teach" : "Study";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label={`Better${word}`}>
      <LogoMark size={size} />
      <span className="font-display text-[1.2rem] font-extrabold tracking-[-0.03em] text-ink">
        Better<span className="text-brand">{word}</span>
      </span>
    </span>
  );
}
