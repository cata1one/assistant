import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Baby, Gamepad2, GraduationCap, Plane, ShieldCheck, Stethoscope, Terminal } from "lucide-react";
import { useAudience } from "../lib/audience.js";
import { useCatalog } from "../lib/catalog.js";
import AudienceSwitch from "./AudienceSwitch.jsx";
import FeaturesCard from "./FeaturesCard.jsx";
import MagneticButton from "./MagneticButton.jsx";

const TITLES = {
  adult: [{ w: "Язык," }, { w: "который" }, { w: "ведёт" }, { w: "к", accent: true }, { w: "цели.", accent: true, italic: true }],
  kid: [{ w: "Учиться" }, { w: "интересно," }, { w: "а" }, { w: "прогресс", accent: true }, { w: "виден.", accent: true, italic: true }],
};

const TRACKS = {
  adult: [[Terminal, "IT English"], [Plane, "Aviation · ICAO"], [Stethoscope, "Medical · OET"], [GraduationCap, "IELTS · HSK"]],
  kid: [[Gamepad2, "Игровые уроки с 6 лет"], [GraduationCap, "ОГЭ · ЕГЭ · YCT"], [Baby, "Отчёт родителям"], [ShieldCheck, "Без личных контактов"]],
};

/** Кинетическая типографика: каждое слово проявляется из размытия (blur-in) с задержкой. */
function KineticTitle({ audience }) {
  const still = useReducedMotion();
  return (
    <h1 className="text-[clamp(2.6rem,7.5vw,6rem)] font-bold leading-[0.98]">
      {TITLES[audience].map((t, i) => (
        <motion.span key={`${audience}-${i}`} className={`mr-[0.22em] inline-block ${t.accent ? "text-aurora" : ""} ${t.italic ? "italic" : ""}`}
          initial={still ? false : { opacity: 0, y: 30, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}>
          {t.w}
        </motion.span>
      ))}
    </h1>
  );
}

/** Плавающие «пузыри» фраз вокруг карточки — мотив языковой школы. */
const BUBBLES = [
  { text: "Hello!", cls: "-left-10 -top-6", d: 0 },
  { text: "你好", cls: "-right-7 top-[38%]", d: 1.2, cn: true },
  { text: "A2 → B2", cls: "-left-14 bottom-[18%]", d: 0.6 },
  { text: "HSK 4 ✓", cls: "right-8 -bottom-6", d: 1.8 },
];

function Bubbles() {
  const still = useReducedMotion();
  return BUBBLES.map((b) => (
    <motion.span key={b.text} aria-hidden="true"
      className={`glass-strong pointer-events-none absolute z-10 hidden rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-glow-violet md:block ${b.cls} ${b.cn ? "font-display text-lg" : ""}`}
      animate={still ? undefined : { y: [0, -10, 0] }} transition={{ duration: 4.5, delay: b.d, repeat: Infinity, ease: "easeInOut" }}>
      {b.text}
    </motion.span>
  ));
}

export default function Hero() {
  const { audience } = useAudience();
  const catalog = useCatalog();
  const copy = catalog.audiences?.[audience];
  const { scrollY } = useScroll();
  const yText = useTransform(scrollY, [0, 600], [0, 80]); // параллакс: текст уходит медленнее скролла
  const fade = useTransform(scrollY, [0, 500], [1, 0.3]);
  return (
    <section className="relative grid items-center gap-12 pb-16 pt-32 md:pt-40 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
      <motion.div style={{ y: yText, opacity: fade }}>
        <AudienceSwitch />
        <div className="mt-7"><KineticTitle audience={audience} /></div>
        <AnimatePresence mode="wait">
          <motion.div key={audience} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}>
            <p className="mt-6 max-w-xl text-lg font-light text-mist md:text-xl">{copy?.text}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {TRACKS[audience].map(([Icon, label]) => (
                <li key={label} className="chip gap-2 transition-all duration-300 hover:border-white/25 hover:text-white">
                  <Icon size={13} /> {label}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <MagneticButton href="#/apply" className="!px-7 !py-3.5 text-base">
            {audience === "kid" ? "Пробный урок для ребёнка" : "Записаться на пробный урок"} <ArrowRight size={18} />
          </MagneticButton>
          <MagneticButton href="#/market" variant="ghost" className="!px-7 !py-3.5 text-base">Подобрать преподавателя</MagneticButton>
        </div>
      </motion.div>
      <motion.div className="relative" initial={{ opacity: 0, y: 40, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ delay: 0.4, duration: 1, ease: [0.22, 1, 0.36, 1] }}>
        <Bubbles />
        <FeaturesCard />
      </motion.div>
    </section>
  );
}
