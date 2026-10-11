import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useRef } from "react";

/**
 * Магнитная кнопка: при наведении слегка притягивается к курсору (spring-смещение до 30% отступа),
 * а внутри за курсором движется градиентное свечение (CSS-переменные --x/--y).
 */
export default function MagneticButton({ href, children, className = "", variant = "primary", onClick, type, strength = 0.3 }) {
  const ref = useRef(null);
  const still = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 15, mass: 0.4 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 15, mass: 0.4 });

  const move = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (!still) { x.set(dx * strength); y.set(dy * strength); }
    el.style.setProperty("--x", `${e.clientX - r.left}px`);
    el.style.setProperty("--y", `${e.clientY - r.top}px`);
  };
  const leave = () => { x.set(0); y.set(0); };

  const Tag = href ? motion.a : motion.button;
  const base = variant === "primary"
    ? "bg-white text-obsidian hover:shadow-glow-violet"
    : "glass text-white hover:bg-white/10";
  return (
    <Tag ref={ref} href={href} type={href ? undefined : type || "button"} onClick={onClick}
      onMouseMove={move} onMouseLeave={leave} style={{ x, y }}
      className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-3 text-sm font-semibold transition-[box-shadow,background-color] duration-300 ease-out ${base} ${className}`}>
      {/* Свечение внутри кнопки: радиальный градиент следует за курсором */}
      <span aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 [background:radial-gradient(120px_circle_at_var(--x)_var(--y),rgba(124,58,237,.45),rgba(16,185,129,.25)_45%,transparent_70%)]" />
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </Tag>
  );
}
