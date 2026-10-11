import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import CustomLogo from "./CustomLogo.jsx";
import MagneticButton from "./MagneticButton.jsx";

export const NAV = [
  ["home", "#/", "Главная"],
  ["courses", "#/courses", "Направления"],
  ["exams", "#/exams", "Экзамены"],
  ["chinese", "#/chinese", "Китайский"],
  ["how", "#/how", "Как учимся"],
  ["board", "#/board", "Доска"],
  ["cabinet", "#/cabinet", "Кабинет"],
];

/**
 * Плавающий стеклянный навбар. После 40px скролла сжимается: меньше отступы и ширина,
 * плотнее фон (backdrop-blur-2xl + bg-white/5 → bg-black/60).
 */
export default function Navbar({ active }) {
  const { scrollY } = useScroll();
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setCompact(v > 40));
  useEffect(() => setOpen(false), [active]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <motion.nav
        aria-label="Разделы"
        animate={{ maxWidth: compact ? 980 : 1180, paddingTop: compact ? 8 : 12, paddingBottom: compact ? 8 : 12 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className={`flex w-full items-center gap-4 rounded-full border px-4 transition-colors duration-300 ease-out md:px-5 ${
          compact ? "border-white/10 bg-black/60 backdrop-blur-2xl shadow-glow-violet" : "border-white/10 bg-white/5 backdrop-blur-2xl"}`}>
        <a href="#/" className="shrink-0" aria-label="Better study — на главную"><CustomLogo compact={compact} /></a>

        <ul className="mx-auto hidden items-center gap-1 lg:flex">
          {NAV.map(([id, href, label]) => (
            <li key={id}>
              <a href={href} aria-current={active === id ? "page" : undefined}
                className={`relative rounded-full px-3.5 py-2 text-sm transition-all duration-300 ease-out ${
                  active === id ? "text-white" : "text-mist hover:text-white"}`}>
                {active === id && (
                  // Подложка активной вкладки «перетекает» между пунктами (shared layout)
                  <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-white/10"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                )}
                <span className="relative">{label}</span>
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <MagneticButton href="#/apply" className="!px-4 !py-2 text-xs sm:!px-5 sm:text-sm">
            Пробный урок <ArrowUpRight size={15} />
          </MagneticButton>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Меню"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white transition-all duration-300 hover:bg-white/10 lg:hidden">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="glass-strong absolute inset-x-4 top-[84px] grid gap-1 rounded-[28px] p-3 lg:hidden">
            {NAV.map(([id, href, label]) => (
              <li key={id}>
                <a href={href} className={`block rounded-2xl px-4 py-3 text-base transition-all duration-300 ${
                  active === id ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white"}`}>{label}</a>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </header>
  );
}
