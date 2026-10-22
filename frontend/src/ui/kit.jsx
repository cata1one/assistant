import { X } from "lucide-react";
import { useEffect } from "react";

export function Loading({ text = "Загружаем…" }) {
  return (
    <div className="flex items-center gap-3 py-10 text-ink-mute">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" /> {text}
    </div>
  );
}

export function Notice({ tone = "info", children, className = "" }) {
  const tones = {
    info: "border-brand/20 bg-brand-tint text-ink-soft",
    ok: "border-mint/30 bg-mint-soft text-[#146b4c]",
    warn: "border-sun/40 bg-sun-soft text-[#7a5300]",
    bad: "border-teach/30 bg-teach-tint text-teach-deep",
  };
  return <div role={tone === "bad" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm ${tones[tone]} ${className}`}>{children}</div>;
}

export const ErrorBox = ({ error }) => (error ? <Notice tone="bad">{error.message || String(error)}</Notice> : null);

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      {Icon && <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon size={26} /></span>}
      <h3 className="mt-4 text-xl">{title}</h3>
      {text && <p className="mt-2 max-w-md text-sm text-ink-mute">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Tabs({ items, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-line bg-white p-1">
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={value === it.id} onClick={() => onChange(it.id)}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${value === it.id ? "bg-ink text-white" : "text-ink-soft hover:bg-cream"}`}>
          {it.title}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 p-3 backdrop-blur-sm sm:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-lift animate-fadeup ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl">{title}</h3>
          <button type="button" className="btn-ghost !p-2" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageTitle({ title, text, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        {text && <p className="mt-1.5 text-ink-mute">{text}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ value, label, tone = "brand" }) {
  const bg = { brand: "bg-brand-tint text-brand-deep", mint: "bg-mint-soft text-[#146b4c]", sun: "bg-sun-soft text-[#7a5300]", lilac: "bg-lilac-soft text-[#4b3fb8]" }[tone];
  return (
    <div className={`flex flex-col items-center justify-center rounded-3xl px-4 py-5 text-center ${bg}`}>
      <span className="num font-display text-3xl font-extrabold leading-none">{value}</span>
      <span className="mt-2 text-xs font-semibold opacity-80">{label}</span>
    </div>
  );
}

export function Avatar({ name, size = 40 }) {
  const initials = (name || "?").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const hue = [...(name || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 70% 62%)` }}>{initials}</span>
  );
}

export function Bullets({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="grid gap-2">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2.5 text-ink-soft">
          <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

export function copy(text) {
  try { navigator.clipboard?.writeText(text); return true; } catch { return false; }
}
