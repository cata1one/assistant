/**
 * Логотип Bright: открытая книга и восходящее солнце — знания открывают мир.
 * У онлайн-школ рядом пишется School.
 */
export function LogoMark({ size = 30, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
<rect x="2" y="2" width="60" height="60" rx="16" fill="#FFD43B" />
      <path d="M10 29c8-3 15-1 22 4 7-5 14-7 22-4v23c-8-3-15-1-22 4-7-5-14-7-22-4Z" fill="#173D36" />
      <path d="M32 34v20" stroke="#FFD43B" strokeWidth="2.5" />
      <path d="M23 24a9 9 0 0 1 18 0" fill="#E4572E" />
      <path d="M32 9v4M17 14l3 3M47 14l-3 3" stroke="#173D36" strokeWidth="3" strokeLinecap="round" />
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
