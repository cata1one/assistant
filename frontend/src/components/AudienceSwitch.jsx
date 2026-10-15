import { motion } from "framer-motion";
import { Baby, Briefcase } from "lucide-react";
import { useAudience } from "../lib/audience.js";

/** Переключатель «Взрослым / Детям»: один сайт, но каждый сразу видит своё. */
export default function AudienceSwitch({ className = "" }) {
  const { audience, setAudience } = useAudience();
  const items = [["adult", "Взрослым", Briefcase], ["kid", "Детям и подросткам", Baby]];
  return (
    <div role="tablist" aria-label="Для кого занятия" className={`glass inline-flex rounded-full p-1 ${className}`}>
      {items.map(([id, label, Icon]) => (
        <button key={id} type="button" role="tab" aria-selected={audience === id} onClick={() => setAudience(id)}
          className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300 ${
            audience === id ? "text-obsidian" : "text-zinc-300 hover:text-white"}`}>
          {audience === id && <motion.span layoutId="audience-pill" className="absolute inset-0 rounded-full bg-white"
            transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
          <Icon size={15} className="relative" /><span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}
