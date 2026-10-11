import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

/**
 * Фон всего сайта: обсидиан и медленно плывущие размытые сферы (blur orbs) — эффект авроры.
 * Параллакс: при скролле сферы смещаются медленнее контента (useTransform от scrollY).
 */
const ORBS = [
  { cls: "left-[-10%] top-[-10%] h-[42rem] w-[42rem] bg-violet/40", drift: { x: [0, 80, -40, 0], y: [0, 60, 20, 0] }, speed: 0.15, t: 26 },
  { cls: "right-[-15%] top-[10%] h-[36rem] w-[36rem] bg-emerald/30", drift: { x: [0, -60, 30, 0], y: [0, 40, -30, 0] }, speed: 0.3, t: 32 },
  { cls: "left-[25%] top-[55%] h-[30rem] w-[30rem] bg-indigo-500/25", drift: { x: [0, 50, -60, 0], y: [0, -40, 30, 0] }, speed: 0.45, t: 38 },
];

function Orb({ orb, scrollY, still }) {
  const y = useTransform(scrollY, (v) => v * -orb.speed); // параллакс: фон отстаёт от переднего плана
  return (
    <motion.div style={{ y }} className="absolute inset-0">
      <motion.div
        className={`absolute rounded-full blur-[120px] ${orb.cls}`}
        animate={still ? undefined : orb.drift}
        transition={{ duration: orb.t, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

export default function Aurora() {
  const { scrollY } = useScroll();
  const still = useReducedMotion();
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-obsidian">
      {ORBS.map((o, i) => <Orb key={i} orb={o} scrollY={scrollY} still={still} />)}
      {/* Mesh-градиент поверх сфер: мягкое северное сияние у верхнего края */}
      <div className="absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(124,58,237,.25),transparent_70%)]" />
      {/* Виньетка: глубина к краям */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_40%,transparent_40%,#050505_100%)]" />
    </div>
  );
}
