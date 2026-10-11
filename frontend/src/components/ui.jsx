import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { categoryById, useCatalog } from "../lib/catalog.js";
import { Reveal } from "./Reveal.jsx";

export function SectionHead({ eyebrow, title, text, className = "" }) {
  return (
    <Reveal className={`mb-10 max-w-3xl ${className}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-3 text-4xl md:text-5xl">{title}</h2>
      {text && <p className="mt-4 text-lg text-mist">{text}</p>}
    </Reveal>
  );
}

export function PageHead({ eyebrow, title, text, children }) {
  return (
    <header className="pb-10 pt-36 md:pt-40">
      <Reveal>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-3 text-5xl md:text-7xl">{title}</h1>
        {text && <p className="mt-5 max-w-2xl text-lg text-mist">{text}</p>}
        {children}
      </Reveal>
    </header>
  );
}

export function Notice({ tone = "info", children, role }) {
  const tones = {
    ok: "border-emerald/30 bg-emerald/10 text-emerald-soft",
    warn: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    bad: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    info: "border-violet/30 bg-violet/10 text-zinc-100",
  };
  return <div role={role} className={`rounded-2xl border px-5 py-4 text-sm backdrop-blur-xl ${tones[tone]}`}>{children}</div>;
}

export const ErrorBox = ({ error }) => <Notice tone="bad" role="alert">{error.message || String(error)}</Notice>;

export function Bullets({ items }) {
  if (!items || !items.length) return null;
  return (
    <ul className="grid gap-2.5">
      {items.map((x, i) => (
        <li key={i} className="flex gap-3 text-zinc-300">
          <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-violet to-emerald" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

export function Loading() {
  return (
    <div className="flex items-center gap-3 py-10 text-mist">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-violet-soft" /> Загружаем…
    </div>
  );
}

export function Segmented({ items, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="glass inline-flex max-w-full flex-wrap gap-1 rounded-full p-1">
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={value === it.id} onClick={() => onChange(it.id)}
          className={`relative rounded-full px-4 py-2 text-sm transition-colors duration-300 ease-out ${value === it.id ? "text-obsidian" : "text-zinc-300 hover:text-white"}`}>
          {value === it.id && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-full bg-white"
            transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
          <span className="relative">{it.title}</span>
        </button>
      ))}
    </div>
  );
}

export function CourseCard({ c }) {
  const catalog = useCatalog();
  const cat = categoryById(catalog, c.category) || {};
  return (
    <motion.article whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="card card-hover group flex h-full flex-col hover:shadow-glow-violet">
      <span className="chip chip-accent w-fit">{cat.title}</span>
      <h3 className="mt-4 text-2xl">{c.title}</h3>
      <p className="mt-2 flex-1 text-sm">{c.short}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">{(c.levels || []).map((l) => <span key={l} className="chip">{l}</span>)}</div>
      <div className="mt-6 flex flex-wrap gap-2">
        <a href={`#/course/${c.id}`} className="btn-ghost btn-sm">Подробнее</a>
        <a href={`#/apply?course=${c.id}`} className="btn-primary btn-sm">Пробный урок <ArrowUpRight size={14} /></a>
      </div>
    </motion.article>
  );
}

export function Panel({ title, icon: Icon, children, className = "" }) {
  if (!children || (Array.isArray(children) && !children.filter(Boolean).length)) return null;
  return (
    <Reveal className={`card ${className}`}>
      <h3 className="mb-4 flex items-center gap-3 text-xl md:text-2xl">
        {Icon && <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white"><Icon size={17} /></span>}
        {title}
      </h3>
      {children}
    </Reveal>
  );
}
