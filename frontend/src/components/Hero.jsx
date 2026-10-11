import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Plane, Stethoscope, Terminal } from "lucide-react";
import FeaturesCard from "./FeaturesCard.jsx";
import MagneticButton from "./MagneticButton.jsx";

const TITLE = [
  { w: "Языки," }, { w: "которые" }, { w: "ведут" }, { w: "к", accent: true }, { w: "цели.", accent: true, italic: true },
];

/** Кинетическая типографика: каждое слово заголовка проявляется из размытия (blur-in) с задержкой. */
function KineticTitle() {
  const still = useReducedMotion();
  return (
    <h1 className="text-[clamp(2.75rem,8vw,6.25rem)] font-bold leading-[0.95]">
      {TITLE.map((t, i) => (
        <motion.span key={i} className={`mr-[0.22em] inline-block ${t.accent ? "text-aurora" : ""} ${t.italic ? "italic" : ""}`}
          initial={still ? false : { opacity: 0, y: 30, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, delay: 0.15 + i * 0.09, ease: [0.22, 1, 0.36, 1] }}>
          {t.w}
        </motion.span>
      ))}
    </h1>
  );
}

const TRACKS = [
  { icon: Terminal, label: "IT English" },
  { icon: Plane, label: "Aviation · ICAO" },
  { icon: Stethoscope, label: "Medical · OET" },
];

export default function Hero() {
  const { scrollY } = useScroll();
  const yText = useTransform(scrollY, [0, 600], [0, 80]); // параллакс: текст уходит медленнее скролла
  const fade = useTransform(scrollY, [0, 500], [1, 0.3]);
  return (
    <section className="relative grid items-center gap-12 pb-20 pt-36 md:pt-44 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
      <motion.div style={{ y: yText, opacity: fade }}>
        <motion.p className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
          Онлайн-школа английского и китайского
        </motion.p>
        <div className="mt-5"><KineticTitle /></div>
        <motion.p className="mt-7 max-w-xl text-lg font-light text-mist md:text-xl"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.8 }}>
          Английский для жизни, IT, авиации и медицины. IELTS, TOEFL, Duolingo и Cambridge.
          Китайский с нуля и HSK — от первого уровня до 7–9.
        </motion.p>
        <motion.div className="mt-9 flex flex-wrap items-center gap-3"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.8 }}>
          <MagneticButton href="#/apply" className="!px-7 !py-3.5 text-base">
            Записаться на пробный урок <ArrowRight size={18} />
          </MagneticButton>
          <MagneticButton href="#/courses" variant="ghost" className="!px-7 !py-3.5 text-base">Все направления</MagneticButton>
        </motion.div>
        <motion.ul className="mt-10 flex flex-wrap gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05 }}>
          {TRACKS.map(({ icon: Icon, label }) => (
            <li key={label} className="chip gap-2 transition-all duration-300 hover:border-white/25 hover:text-white">
              <Icon size={13} /> {label}
            </li>
          ))}
        </motion.ul>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 40, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ delay: 0.5, duration: 1, ease: [0.22, 1, 0.36, 1] }}>
        <FeaturesCard />
      </motion.div>
    </section>
  );
}
