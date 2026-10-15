import { motion } from "framer-motion";
import { ArrowUpRight, Briefcase, GraduationCap, Languages } from "lucide-react";
import { useState } from "react";
import { forAudience, useAudience } from "../lib/audience.js";
import { categoryHref, useCatalog } from "../lib/catalog.js";
import { Stagger, StaggerItem } from "./Reveal.jsx";

/**
 * Bento Grid направлений: асимметричная сетка разных по размеру карточек.
 * Флаги-эмодзи заменены иконками и глифом «中»: Windows не рисует эмодзи флагов и показывает «GB»/«CN».
 */
const TILES = {
  english: {
    span: "md:col-span-3 md:row-span-2", icon: Languages, tone: "from-violet/40 via-indigo-500/10",
    glow: "hover:shadow-glow-violet", tagline: "От нуля до свободной речи. Разговорный, для детей, ОГЭ и ЕГЭ.",
  },
  exams: {
    span: "md:col-span-3", icon: GraduationCap, tone: "from-emerald/35 via-teal-500/10",
    glow: "hover:shadow-glow-emerald", tagline: "IELTS · TOEFL · Duolingo · Cambridge · PTE · OET",
  },
  professional: {
    span: "md:col-span-3", icon: Briefcase, tone: "from-fuchsia-500/30 via-violet/10",
    glow: "hover:shadow-glow-violet", tagline: "IT English, авиационный ICAO, медицинский, деловой",
  },
  chinese: {
    span: "md:col-span-4", glyph: "中", tone: "from-rose-500/30 via-amber-500/10",
    glow: "hover:shadow-glow-violet", tagline: "Тоны и иероглифы с первого урока. HSK 1–6 и 7–9, HSKK, YCT.",
  },
};

function Tile({ cat, count, courses }) {
  const t = TILES[cat.id] || TILES.english;
  const big = cat.id === "english";
  const [hover, setHover] = useState(false);
  const Icon = t.icon;
  return (
    <StaggerItem className={`${t.span}`}>
      <motion.a href={categoryHref(cat.id)} onHoverStart={() => setHover(true)} onHoverEnd={() => setHover(false)}
        whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className={`group glass relative flex h-full min-h-[220px] flex-col justify-between overflow-hidden rounded-[30px] p-7 transition-[background-color,border-color,box-shadow] duration-300 ease-out hover:border-white/20 hover:bg-white/[.08] ${t.glow}`}>
        {/* Градиентный меш внутри карточки; при наведении становится ярче */}
        <div aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.tone} to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-100`} />
        {/* Абстрактная «3D»-графика: концентрические кольца со стеклянной сферой */}
        <div aria-hidden="true" className={`pointer-events-none absolute -right-16 -top-16 ${big ? "h-80 w-80" : "h-56 w-56"}`}>
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div className="absolute inset-8 rounded-full border border-white/10" />
          <div className="absolute inset-16 rounded-full bg-gradient-to-br from-white/25 to-white/0 blur-[1px] transition-transform duration-700 ease-out group-hover:scale-110" />
        </div>

        <div className="relative flex items-start justify-between">
          {/* Иконка начинает парить при наведении (floating animation) */}
          <motion.span animate={hover ? { y: [0, -8, 0] } : { y: 0 }}
            transition={hover ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
            className="grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white backdrop-blur-xl">
            {Icon ? <Icon size={24} /> : <span className="font-display text-2xl font-bold">{t.glyph}</span>}
          </motion.span>
          <span className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-white transition-all duration-300 group-hover:rotate-45 group-hover:bg-white group-hover:text-obsidian">
            <ArrowUpRight size={18} />
          </span>
        </div>

        <div className="relative mt-10">
          <p className="text-xs uppercase tracking-[.2em] text-zinc-400"><span className="num">{count}</span> {count === 1 ? "программа" : count < 5 ? "программы" : "программ"}</p>
          <h3 className={`mt-2 ${big ? "text-4xl md:text-5xl" : "text-2xl md:text-3xl"}`}>{cat.title}</h3>
          <p className="mt-3 max-w-md text-sm text-zinc-300">{t.tagline}</p>
          {big && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {courses.slice(0, 4).map((c) => <li key={c.id} className="chip">{c.title}</li>)}
            </ul>
          )}
        </div>
      </motion.a>
    </StaggerItem>
  );
}

export default function DirectionsGrid() {
  const catalog = useCatalog();
  const { audience } = useAudience();
  const byCat = (id) => catalog.courses.filter((c) => c.category === id && forAudience(c, audience));
  const order = ["english", "exams", "professional", "chinese"];
  const cats = order.map((id) => catalog.categories.find((c) => c.id === id)).filter(Boolean);
  return (
    <Stagger className="grid auto-rows-[minmax(220px,auto)] gap-4 md:grid-cols-6">
      {cats.map((cat) => <Tile key={cat.id} cat={cat} count={byCat(cat.id).length} courses={byCat(cat.id)} />)}
      {/* Шестая клетка сетки — призыв к действию, чтобы bento закрывался ровно */}
      <StaggerItem className="md:col-span-2">
        <motion.a href="#/apply" whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="group relative flex h-full min-h-[220px] flex-col justify-between overflow-hidden rounded-[30px] bg-white p-7 text-obsidian transition-shadow duration-300 hover:shadow-glow-emerald">
          <span className="text-xs font-semibold uppercase tracking-[.2em] text-zinc-500">Бесплатно</span>
          <span>
            <span className="block font-display text-3xl font-bold tracking-tightest">Пробный урок</span>
            <span className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
              Уровень, цель и преподаватель
              <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
            </span>
          </span>
        </motion.a>
      </StaggerItem>
    </Stagger>
  );
}
