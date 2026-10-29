/**
 * Логотип Bright: буква «B» в облачке реплики – урок это разговор.
 * У онлайн-школ рядом пишется School.
 */
export function LogoMark({ size = 30, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M12 6h40a8 8 0 0 1 8 8v30a8 8 0 0 1-8 8H30L16 62V52h-4a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z" fill="#FFD43B" />
      <path transform="translate(3.95 1.8) scale(.85)" fill="#17171A" fillRule="evenodd" d="M19 12H34C41 12 45 16.5 45 22C45 26 43 29 39.5 30.5C44 32 47 35.5 47 41C47 47.5 42 52 34.5 52H19ZM28 19V28H33.5C36.5 28 37.5 26 37.5 23.5C37.5 21 36 19 33.5 19ZM28 35V45H34C37.5 45 39.5 43 39.5 40C39.5 37 37.5 35 34 35Z" />
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
