import { ArrowRight, ArrowUpRight, Baby, Briefcase, CheckCircle2, Users, User, UsersRound } from "lucide-react";
import DirectionsGrid from "../components/DirectionsGrid.jsx";
import Hero from "../components/Hero.jsx";
import MagneticButton from "../components/MagneticButton.jsx";
import Phrases from "../components/Phrases.jsx";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal.jsx";
import Reviews from "../components/Reviews.jsx";
import { SectionHead } from "../components/ui.jsx";
import { useAudience } from "../lib/audience.js";
import { useCatalog } from "../lib/catalog.js";

const FORMAT_ICONS = [User, Users, UsersRound];

export function Steps() {
  const { steps } = useCatalog();
  return (
    <Stagger className="relative grid gap-4 md:grid-cols-5">
      {/* Линия-таймлайн проходит ровно через центры кружков */}
      <div aria-hidden="true" className="absolute left-0 right-0 top-[44px] hidden h-px bg-gradient-to-r from-violet/0 via-violet/50 to-emerald/0 md:block" />
      {steps.map((s, i) => (
        <StaggerItem key={s.title}>
          <div className="card card-hover relative h-full !p-6">
            <span className="num-badge relative h-10 w-10 text-base shadow-glow-violet">{i + 1}</span>
            <h3 className="mt-5 text-xl">{s.title}</h3>
            <p className="mt-2 text-sm">{s.text}</p>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/** Полоса фактов: цифры строго по центру своих ячеек, табличные цифры Inter. */
function Facts() {
  const c = useCatalog();
  const exams = c.courses.filter((x) => x.exam).length;
  const facts = [
    [String(c.courses.length), "программ обучения"],
    ["2", "языка — английский и китайский"],
    [String(exams), "международных экзаменов"],
    ["1–9", "все уровни HSK"],
  ];
  return (
    <Stagger className="glass grid grid-cols-2 divide-white/10 overflow-hidden rounded-[28px] md:grid-cols-4 md:divide-x">
      {facts.map(([n, t]) => (
        <StaggerItem key={t} className="flex flex-col items-center px-4 py-8 text-center">
          <span className="stat-num text-4xl md:text-5xl">{n}</span>
          <span className="mt-3 max-w-[12rem] text-sm text-zinc-400">{t}</span>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/** Две двери на одном сайте: взрослым и детям. Выбор переключает весь сайт. */
function ForWhom() {
  const { audiences } = useCatalog();
  const { audience, setAudience } = useAudience();
  const cards = [["adult", Briefcase, "from-violet/35"], ["kid", Baby, "from-emerald/30"]];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map(([id, Icon, tone]) => {
        const a = audiences[id];
        const active = audience === id;
        return (
          <Reveal key={id}>
            <button type="button" onClick={() => { setAudience(id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className={`card card-hover group relative h-full w-full overflow-hidden text-left ${active ? "!border-white/25" : ""}`}>
              <div aria-hidden="true" className={`absolute inset-0 bg-gradient-to-br ${tone} to-transparent opacity-50 transition-opacity duration-500 group-hover:opacity-90`} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white"><Icon size={22} /></span>
                  {active ? <span className="chip chip-accent">сейчас выбрано</span> : <ArrowUpRight className="text-white transition-transform duration-300 group-hover:rotate-45" />}
                </div>
                <p className="eyebrow mt-6">{a.title}</p>
                <h3 className="mt-2 text-3xl">{a.headline}</h3>
                <ul className="mt-5 grid gap-2">
                  {a.points.map((p) => <li key={p} className="flex gap-2 text-sm text-zinc-300"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-soft" />{p}</li>)}
                </ul>
              </div>
            </button>
          </Reveal>
        );
      })}
    </div>
  );
}

function MarketTeaser() {
  return (
    <Reveal className="card relative overflow-hidden md:!p-12">
      <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald/25 blur-3xl" />
      <div className="relative grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="eyebrow">Биржа учеников</p>
          <h2 className="mt-3 text-4xl md:text-5xl">Опишите задачу — преподаватели предложат цену</h2>
          <p className="mt-4 text-lg">Бесплатно и без звонков: расскажите о цели, уровне и бюджете. Проверенные преподаватели школы откликнутся, а вы выберете того, кто подходит.</p>
        </div>
        <div className="flex flex-col gap-3">
          <MagneticButton href="#/market/new" className="!py-4 text-base">Разместить заявку <ArrowRight size={18} /></MagneticButton>
          <a href="#/market" className="btn-ghost !py-4">Смотреть заявки — для преподавателей</a>
        </div>
      </div>
    </Reveal>
  );
}

export default function Home() {
  const { formats } = useCatalog();
  const { audience } = useAudience();
  return (
    <>
      <Hero />
      <Facts />
      <Phrases />

      <section className="py-14">
        <SectionHead eyebrow="Направления" title={audience === "kid" ? "Программы для детей и подростков" : "Выберите свою траекторию"}
          text={audience === "kid" ? "Английский и китайский в игровом формате, школьная программа, ОГЭ, ЕГЭ, YCT и HSK."
            : "Общий и профессиональный английский, международные экзамены и китайский — с программой под вашу цель."} />
        <DirectionsGrid />
      </section>

      <section className="py-14">
        <SectionHead eyebrow="Для кого" title="Одна школа — два подхода" text="Выберите, для кого занятия, — сайт покажет подходящие программы." />
        <ForWhom />
      </section>

      <section className="py-14">
        <SectionHead eyebrow="Процесс" title="Как мы учим" />
        <Steps />
      </section>

      <section className="py-14">
        <SectionHead eyebrow="Отзывы" title="Что говорят о школе" text="Ученики, родители и преподаватели — только настоящие отзывы после модерации." />
        <Reviews limit={6} />
        <div className="mt-8"><a href="#/reviews" className="link">Все отзывы →</a></div>
      </section>

      <section className="py-14"><MarketTeaser /></section>

      <section className="py-14">
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
        <h2 className="mx-auto max-w-3xl text-4xl md:text-6xl">Начните с бесплатного <span className="text-aurora italic">пробного урока</span></h2>
        <p className="mx-auto mt-5 max-w-xl text-lg">Определим уровень, поймём цель и подберём преподавателя и программу.</p>
        <div className="mt-9 flex justify-center">
          <MagneticButton href="#/apply" className="!px-8 !py-4 text-base">Оставить заявку <ArrowRight size={18} /></MagneticButton>
        </div>
      </Reveal>
    </>
  );
}
