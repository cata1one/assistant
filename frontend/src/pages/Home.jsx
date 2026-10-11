import { ArrowRight, Users, User, UsersRound } from "lucide-react";
import DirectionsGrid from "../components/DirectionsGrid.jsx";
import Hero from "../components/Hero.jsx";
import MagneticButton from "../components/MagneticButton.jsx";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal.jsx";
import { SectionHead } from "../components/ui.jsx";
import { useCatalog } from "../lib/catalog.js";

const FORMAT_ICONS = [User, Users, UsersRound];

export function Steps() {
  const { steps } = useCatalog();
  return (
    <Stagger className="relative grid gap-4 md:grid-cols-5">
      {/* Линия-таймлайн с градиентом за шагами */}
      <div aria-hidden="true" className="absolute left-0 right-0 top-[38px] hidden h-px bg-gradient-to-r from-violet/0 via-violet/50 to-emerald/0 md:block" />
      {steps.map((s, i) => (
        <StaggerItem key={s.title}>
          <div className="card card-hover relative h-full !p-6">
            <span className="relative grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet to-emerald font-display text-lg font-bold text-white shadow-glow-violet">
              {i + 1}
            </span>
            <h3 className="mt-5 text-xl">{s.title}</h3>
            <p className="mt-2 text-sm">{s.text}</p>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

export default function Home() {
  const { formats } = useCatalog();
  return (
    <>
      <Hero />

      <section className="py-16">
        <SectionHead eyebrow="Направления" title="Выберите свою траекторию"
          text="Общий и профессиональный английский, международные экзамены и китайский — с программой под вашу цель." />
        <DirectionsGrid />
      </section>

      <section className="py-16">
        <SectionHead eyebrow="Процесс" title="Как мы учим" />
        <Steps />
      </section>

      <section className="py-16">
        <SectionHead eyebrow="Форматы" title="Как удобно вам" />
        <Stagger className="grid gap-4 md:grid-cols-3">
          {formats.map((f, i) => {
            const Icon = FORMAT_ICONS[i % FORMAT_ICONS.length];
            return (
              <StaggerItem key={f.title}>
                <div className="card card-hover group h-full">
                  <Icon size={22} className="text-violet-soft transition-transform duration-300 group-hover:-translate-y-1" />
                  <h3 className="mt-4 text-2xl">{f.title}</h3>
                  <p className="mt-2">{f.text}</p>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      <Reveal as="section" className="relative my-16 overflow-hidden rounded-[32px] border border-white/10 p-10 text-center md:p-16">
        {/* Финальный призыв: аврора-градиент внутри стеклянного блока */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_20%_0%,rgba(124,58,237,.45),transparent),radial-gradient(60%_80%_at_80%_100%,rgba(16,185,129,.35),transparent)]" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 backdrop-blur-2xl" />
        <h2 className="mx-auto max-w-3xl text-4xl md:text-6xl">Начните с бесплатного <span className="text-aurora italic">пробного урока</span></h2>
        <p className="mx-auto mt-5 max-w-xl text-lg">Определим уровень, поймём цель и подберём преподавателя и программу.</p>
        <div className="mt-9 flex justify-center">
          <MagneticButton href="#/apply" className="!px-8 !py-4 text-base">Оставить заявку <ArrowRight size={18} /></MagneticButton>
        </div>
      </Reveal>
    </>
  );
}
