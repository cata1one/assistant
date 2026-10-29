import { X } from "lucide-react";
import { useEffect } from "react";

export function Loading({ text = "Загружаем…" }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-ink-mute">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink" /> {text}
    </div>
  );
}

export function Notice({ tone = "info", children, className = "" }) {
  const tones = {
    info: "border-line bg-white text-ink-soft",
    ok: "border-mint/25 bg-mint-soft text-[#13623E]",
    warn: "border-sun/60 bg-sun-soft text-[#6B4E00]",
    bad: "border-teach/25 bg-teach-tint text-teach-deep",
  };
  return <div role={tone === "bad" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm ${tones[tone]} ${className}`}>{children}</div>;
}

export const ErrorBox = ({ error }) => (error ? <Notice tone="bad">{error.message || String(error)}</Notice> : null);

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-12 text-center">
      {Icon && <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cream text-ink-soft"><Icon size={22} /></span>}
      <h3 className="mt-4 text-lg">{title}</h3>
      {text && <p className="mt-1.5 max-w-md text-sm text-ink-mute">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Переключатель разделов: серый трек и белая «таблетка» у выбранного. */
export function Tabs({ items, value, onChange, label, className = "" }) {
  return (
    <div role="tablist" aria-label={label} className={`inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-cream p-1 ${className}`}>
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={value === it.id} onClick={() => onChange(it.id)}
          className={`whitespace-nowrap rounded-[8px] px-3.5 py-1.5 text-sm font-semibold transition ${value === it.id ? "bg-white text-ink shadow-soft" : "text-ink-mute hover:text-ink"}`}>
          {it.title}{it.badge ? <span className="ml-1.5 rounded-md bg-ink px-1.5 text-[11px] text-white">{it.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Окно: на компьютере по центру, на телефоне выезжает снизу. */
export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-4xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lift animate-fadeup sm:rounded-4xl sm:p-6 ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg">{title}</h3>
          <button type="button" className="btn-ghost !h-9 !w-9 !p-0" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageTitle({ title, text, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.7rem] md:text-[2rem]">{title}</h1>
        {text && <p className="mt-1 max-w-2xl text-[15px] text-ink-mute">{text}</p>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ value, label, href, accent }) {
  const body = (
    <>
      <span className={`num font-display text-[1.75rem] font-bold leading-none ${accent ? "text-ink" : ""}`}>{value}</span>
      <span className="mt-1.5 text-[13px] text-ink-mute">{label}</span>
      {accent && <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-sun" />}
    </>
  );
  const cls = "panel relative flex flex-col px-4 py-4 transition";
  return href ? <a href={href} className={`${cls} hover:border-ink/25`}>{body}</a> : <div className={cls}>{body}</div>;
}

export function Avatar({ name, size = 40 }) {
  const initials = (name || "?").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const tones = ["#FFE7A3", "#D9E4FF", "#FFD9CC", "#D6F0E2", "#E8E2FF", "#F1E6D6"];
  const tone = tones[[...(name || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length];
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-semibold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.38, background: tone }}>{initials}</span>
  );
}

export function Bullets({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="grid gap-2">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2.5 text-ink-soft">
          <span aria-hidden="true" className="mt-[0.65em] h-1.5 w-1.5 shrink-0 rounded-full bg-ink/40" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

/** Строка списка: аватар или значок, заголовок, подпись и действия справа. */
export function Row({ left, title, sub, right, href, onClick }) {
  const inner = (
    <>
      {left}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        {sub && <span className="block truncate text-[13px] text-ink-mute">{sub}</span>}
      </span>
      {right}
    </>
  );
  const cls = "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-cream";
  if (href) return <a href={href} className={cls}>{inner}</a>;
  if (onClick) return <button type="button" onClick={onClick} className={`${cls} w-full text-left`}>{inner}</button>;
  return <div className="flex items-center gap-3 px-3 py-2.5">{inner}</div>;
}

export function copy(text) {
  try { navigator.clipboard?.writeText(text); return true; } catch { return false; }
}
