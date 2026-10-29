/**
 * Логотип Bright: чёрная плитка с буквой «b» и жёлтой искрой.
 * У онлайн-школ рядом пишется School.
 */
export function LogoMark({ size = 30, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="8" fill="#17171A" />
      <rect x="9" y="6.5" width="4.2" height="19" rx="2.1" fill="#fff" />
      <circle cx="18.2" cy="18.4" r="5.2" fill="none" stroke="#fff" strokeWidth="4.2" />
      <path d="M24.6 4.6l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" fill="#FFD43B" />
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
