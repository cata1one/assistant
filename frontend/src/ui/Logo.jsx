/** Bright: a B made from two open pages. The small mark and the wordmark share one master. */
export function LogoMark({ size = 30, className = "" }) {
  return <svg width={size} height={size} viewBox="0 0 64 68" aria-hidden="true" className={className}>
      <path d="M9 7h22c12 0 19 6 19 15 0 5-3 9-7 11 6 2 10 6 10 12 0 10-8 17-21 17H9Z" fill="#293DCD"/>
      <path d="M18 15c8-3 16-1 23 5v13c-8-5-15-7-23-4Z" fill="#FF8B72"/>
      <path d="M18 34c9-2 17 0 25 7v14c-9-6-17-9-25-6Z" fill="#FFE07A"/>
      <path d="M18 15v34" stroke="#FAFAF8" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="53" cy="9" r="7" fill="#F9C43B"/>
    </svg>;
}

export default function Logo({ size = 30, school = false, className = "", light = false }) {
  return <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label={school ? "Bright School" : "Bright"}>
    <LogoMark size={size} />
    <span className={`font-display text-[1.35rem] font-extrabold leading-none tracking-[-0.055em] ${light ? "text-white" : "text-ink"}`}>
      Bright{school && <span className={`ml-1.5 text-[0.72em] font-medium tracking-normal ${light ? "text-white/70" : "text-ink-mute"}`}>School</span>}
    </span>
  </span>;
}
