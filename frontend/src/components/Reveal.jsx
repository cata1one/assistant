import { motion, useReducedMotion } from "framer-motion";

/** Появление при скролле: fade-up снизу вверх. Внутри <Stagger> дети идут с задержкой (stagger). */
const item = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export function Reveal({ children, className = "", as = "div", delay = 0 }) {
  const still = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag className={className} initial={still ? false : "hidden"} whileInView="show" viewport={{ once: true, margin: "-60px" }}
      variants={item} transition={{ delay }}>
      {children}
    </Tag>
  );
}

export function Stagger({ children, className = "", gap = 0.08 }) {
  const still = useReducedMotion();
  return (
    <motion.div className={className} initial={still ? false : "hidden"} whileInView="show"
      viewport={{ once: true, margin: "-60px" }} variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = "" }) {
  return <motion.div className={className} variants={item}>{children}</motion.div>;
}
