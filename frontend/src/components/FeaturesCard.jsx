import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { BookOpenText, CheckCircle2, NotebookPen, Sparkles, Users } from "lucide-react";

const FEATURES = [
  { icon: BookOpenText, title: "Конспект урока", text: "Правила, ключевые моменты, работа над ошибками" },
  { icon: Sparkles, title: "Новые слова", text: "Сразу в ваш словарь, с переводом и примером" },
  { icon: CheckCircle2, title: "Тест для дома", text: "Самопроверка, ответы проверяет сервер" },
  { icon: NotebookPen, title: "Домашнее задание", text: "От преподавателя и дополнительное по теме" },
  { icon: Users, title: "Отчёт родителям", text: "Успехи, замечания, статус ДЗ" },
];

/**
 * Интерактивная стеклянная карточка с 3D-наклоном (tilt): положение курсора → rotateX/rotateY
 * через пружину. Блик (radial-gradient) следует за курсором поверх стекла.
 */
export default function FeaturesCard() {
  const still = useReducedMotion();
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(my, [0, 1], [8, -8]), { stiffness: 150, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-10, 10]), { stiffness: 150, damping: 18 });
  const glareX = useTransform(mx, (v) => `${v * 100}%`);
  const glareY = useTransform(my, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(420px circle at ${glareX} ${glareY}, rgba(255,255,255,.12), transparent 60%)`;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const reset = () => { mx.set(0.5); my.set(0.5); };

  return (
    <div className="[perspective:1200px]">
      <motion.div onMouseMove={onMove} onMouseLeave={reset}
        style={still ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="glass relative overflow-hidden rounded-[32px] p-6 shadow-glow-violet md:p-8">
        <motion.div aria-hidden="true" style={{ background: glare }} className="pointer-events-none absolute inset-0" />
        {/* Mesh внутри карточки: два цветных пятна под стеклом */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-emerald/20 blur-3xl" />

        <div className="relative" style={{ transform: "translateZ(40px)" }}>
          <p className="eyebrow">После каждого урока</p>
          <h3 className="mt-2 text-2xl md:text-3xl">Всё — автоматически</h3>
          <ul className="mt-6 grid gap-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title}
                className="group flex items-center gap-4 rounded-2xl border border-transparent p-2.5 transition-all duration-300 ease-out hover:border-white/10 hover:bg-white/5">
                {/* Иконка подсвечивается градиентом при наведении */}
                <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-zinc-300 transition-all duration-300 ease-out group-hover:border-transparent group-hover:text-white group-hover:shadow-glow-violet">
                  <span aria-hidden="true" className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet to-emerald opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <Icon size={19} className="relative" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="block text-sm text-mist">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-zinc-500">Приходит в Telegram и хранится в личном кабинете.</p>
        </div>
      </motion.div>
    </div>
  );
}
