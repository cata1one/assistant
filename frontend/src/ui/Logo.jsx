/**
 * Логотип Bright: жёлтая плитка и строчная «b», у которой чаша – облачко реплики: урок – это разговор.
 * У онлайн-школ рядом пишется School.
 */
export const MARK_PATHS = (
  <>
    <g transform="translate(2 1)">
      <rect x="14" y="8" width="9.5" height="38" rx="4.75" fill="#17171A" />
      <path d="M29 23A15 15 0 1 0 39.6 48.6L47.5 54.5L42.6 44.3A15 15 0 0 0 29 23Z" fill="#17171A" />
      <circle cx="29.5" cy="38" r="5.6" fill="#FFD43B" />
    </g>
  </>
);

export function LogoMark({ size = 30, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="16" fill="#FFD43B" />
      {MARK_PATHS}
    </svg>
  );
}

export default function Logo({ size = 30, school = false, className = "", light = false }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label={school ? "Bright School" : "Bright"}>
      <LogoMark size={size} />
      <span className={`font-display text-[1.25rem] font-bold leading-none tracking-[-0.04em] ${light ? "text-white" : "text-ink"}`}>
        Bright{school && <span className={`ml-1 font-medium ${light ? "text-white/60" : "text-ink-mute"}`}>School</span>}
      </span>
    </span>
  );
}
