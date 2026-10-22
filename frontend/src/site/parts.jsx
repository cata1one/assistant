import { Check, ChevronDown, Mic, Video } from "lucide-react";
import { useState } from "react";
import { stickerById } from "../board/stickers.js";

export function Section({ eyebrow, title, text, children, className = "", center }) {
  return (
    <section className={`py-14 md:py-20 ${className}`}>
      {(title || eyebrow) && (
        <div className={`mb-10 max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          {title && <h2 className="mt-2 text-3xl md:text-[2.75rem]">{title}</h2>}
          {text && <p className="mt-4 text-lg text-ink-soft">{text}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

const PHRASES = [
  ["Nice to meet you", "Приятно познакомиться"], ["你好", "nǐ hǎo · привет"], ["Practice makes perfect", "Повторение — мать учения"],
  ["加油!", "jiā yóu · вперёд!"], ["Piece of cake", "Проще простого"], ["Bonjour", "Здравствуйте"],
  ["谢谢", "xièxie · спасибо"], ["Keep it up!", "Так держать!"], ["¡Hola!", "Привет"], ["Break a leg", "Ни пуха ни пера"],
  ["Grazie mille", "Большое спасибо"], ["Obrigado", "Спасибо"], ["شكراً", "shúkran · спасибо"], ["Хвала", "hvala · спасибо"],
  ["नमस्ते", "namaste · здравствуйте"], ["Γεια σου", "yia sou · привет"],
];

export function Marquee() {
  const row = [...PHRASES, ...PHRASES];
  return (
    <div aria-hidden="true" className="relative overflow-hidden border-y border-line bg-white/50 py-4 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div className="flex w-max animate-marquee gap-10 hover:[animation-play-state:paused]">
        {row.map(([p, t], i) => (
          <span key={i} className="flex items-baseline gap-2.5 whitespace-nowrap">
            <span className="font-display text-xl font-extrabold text-ink md:text-2xl">{p}</span>
            <span className="text-sm text-ink-mute">{t}</span>
            <span className="ml-6 text-brand">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Живой макет продукта: доска со стикерами, видео собеседника, конспект и карточка слова. */
export function ProductMock() {
  const sticker = (id, cls) => {
    const s = stickerById(id);
    return s?.src ? <img alt="" src={s.src} className={`absolute ${cls}`} /> : null;
  };
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="glass rounded-[2rem] p-3">
        <div className="flex items-center gap-1.5 px-2 pb-3 pt-1">
          <span className="h-3 w-3 rounded-full bg-teach/70" /><span className="h-3 w-3 rounded-full bg-sun" /><span className="h-3 w-3 rounded-full bg-mint/80" />
          <span className="ml-3 text-xs font-semibold text-ink-mute">Урок · Present Perfect</span>
          <span className="ml-auto flex items-center gap-1 rounded-full bg-teach-tint px-2 py-0.5 text-[11px] font-bold text-teach-deep"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teach" /> запись</span>
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div className="board-viewport relative h-64 rounded-2xl border border-line" style={{ backgroundSize: "18px 18px" }}>
            <div className="board-note absolute left-4 top-4 w-40 rotate-[-2deg] bg-[#FDE68A] p-3 text-sm font-bold">I have <u>been</u> to London ✈️</div>
            <div className="board-note absolute right-5 top-8 w-32 rotate-[3deg] bg-[#BFDBFE] p-3 text-sm font-bold">have + V3</div>
            <svg className="absolute left-36 top-24 h-20 w-28 overflow-visible" aria-hidden="true"><path d="M5 50 Q 50 0 100 40" stroke="#F2643D" strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M86 30l14 10-16 4" stroke="#F2643D" strokeWidth="4" fill="none" strokeLinecap="round" /></svg>
            {sticker("pr-great", "bottom-4 left-5 w-28 rotate-[-4deg] drop-shadow")}
            {sticker("hw-pumpkin", "bottom-5 right-24 w-14 animate-float")}
            {sticker("cny-lantern", "bottom-8 right-5 w-12")}
          </div>
          <div className="grid gap-3">
            <div className="relative grid place-items-center rounded-2xl bg-gradient-to-br from-study-soft to-lilac-soft"><span className="text-4xl">🧑‍🎓</span><span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-ink-soft">Миша</span></div>
            <div className="relative grid place-items-center rounded-2xl bg-gradient-to-br from-teach-soft to-sun-soft"><span className="text-4xl">👩‍🏫</span><span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-ink-soft">Анна</span></div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          {[Mic, Video].map((I, i) => <span key={i} className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-soft"><I size={16} /></span>)}
          <span className="rounded-full bg-teach px-4 py-2 text-xs font-bold text-white">Завершить урок</span>
        </div>
      </div>
      {/* Что приходит после урока */}
      <div className="glass absolute -bottom-10 -left-4 hidden w-56 rotate-[-3deg] rounded-3xl p-4 md:block">
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Конспект готов</p>
        <p className="mt-1 text-sm font-bold">6 новых слов · 2 правила · ДЗ</p>
        <p className="mt-1 text-xs text-ink-mute">Ученику и родителям — сразу после урока</p>
      </div>
      <div className="glass absolute -right-4 -top-6 hidden w-44 rotate-[4deg] rounded-3xl p-4 text-center md:block">
        <p className="font-display text-2xl font-extrabold">kitchen</p>
        <p className="text-sm text-ink-mute">кухня</p>
        <div className="mt-2 flex justify-center gap-1 text-[10px] font-bold"><span className="rounded-full bg-teach-soft px-2 py-0.5 text-teach-deep">Не помню</span><span className="rounded-full bg-mint-soft px-2 py-0.5 text-[#146b4c]">Помню</span></div>
      </div>
    </div>
  );
}

export function FeatureGrid({ items }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ icon: Icon, title, text, tone = "brand" }) => (
        <div key={title} className="card card-hover">
          <span className={`grid h-12 w-12 place-items-center rounded-2xl ${{ brand: "bg-brand-soft text-brand", mint: "bg-mint-soft text-mint", sun: "bg-sun-soft text-[#b07800]", lilac: "bg-lilac-soft text-lilac", teach: "bg-teach-soft text-teach", study: "bg-study-soft text-study" }[tone]}`}><Icon size={22} /></span>
          <h3 className="mt-4 text-xl">{title}</h3>
          <p className="mt-2 text-sm text-ink-soft">{text}</p>
        </div>
      ))}
    </div>
  );
}

export const PLANS = [
  { id: "teacher", title: "Преподаватель", who: "Для частных репетиторов", prices: { 1: 300, 3: 810, 12: 2880 }, hot: true,
    features: [
      "Ученики без ограничений",
      "Видеоуроки в браузере — без Zoom и Skype",
      "Доска: рисование, стикеры, фото с обрезкой, видео",
      "Конспект, новые слова, ДЗ и тест после урока — сами",
      "Интерактивные занятия: пропуски, пары, тесты, аудирование",
      "Создание занятий с ИИ и готовые уроки IELTS и HSK",
      "Своя база материалов: файлы, ссылки, видео",
      "Домашние задания с проверкой, фото ответа и вашим комментарием",
      "Карточки слов с интервальным повторением для учеников",
      "Отчёты родителям на сайте и переписка с ними",
      "Поиск новых учеников",
      "10 языков: английский, китайский, испанский и другие",
    ] },
  { id: "school", title: "Онлайн-школа", who: "Цена за одного преподавателя", prices: { 1: 500, 3: 1350, 12: 4800 },
    features: [
      "Всё из тарифа «Преподаватель» — каждому в команде",
      "Кабинет школы: преподаватели, ученики, уроки и отчёты",
      "Защита учеников: контакты в чате, речи и на доске блокируются",
      "Сигналы школе о попытках увести ученика",
      "Общая база материалов и занятий для всей команды",
      "Родители пишут напрямую в школу",
      "Преподаватели подключаются по одной ссылке",
    ] },
];

const PERIODS = [[1, "Месяц"], [3, "3 месяца · −10%"], [12, "Год · −20%"]];

export function PricingCards({ inApp }) {
  const [months, setMonths] = useState(1);
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Срок оплаты" className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-white p-1">
          {PERIODS.map(([m, t]) => (
            <button key={m} type="button" role="tab" aria-selected={months === m} onClick={() => setMonths(m)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${months === m ? "bg-ink text-white" : "text-ink-soft hover:bg-cream"}`}>{t}</button>
          ))}
        </div>
        {!inApp && <span className="chip chip-brand">3 дня бесплатно — со всеми функциями, без карты</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {PLANS.map((p) => {
          const total = p.prices[months];
          const perMonth = Math.round(total / months);
          return (
            <div key={p.id} data-brand={p.id === "school" ? "study" : "teach"} className={`card relative flex flex-col ${p.hot ? "border-brand shadow-teach-glow" : ""}`}>
              {p.hot && <span className="chip chip-brand absolute -top-3 left-6">Выбор репетиторов</span>}
              <h3 className="text-2xl">{p.title}</h3>
              <p className="mt-1 text-sm text-ink-mute">{p.who}</p>
              <p className="mt-4 flex items-baseline gap-1.5"><span className="num font-display text-5xl font-extrabold">{perMonth} ₽</span><span className="text-sm text-ink-mute">в месяц{p.id === "school" ? " за преподавателя" : ""}</span></p>
              <p className="mt-1 h-5 text-sm text-ink-mute">{months > 1 ? `${total.toLocaleString("ru-RU")} ₽ за ${months === 12 ? "год" : "3 месяца"}` : "Оплата помесячно"}</p>
              <ul className="mt-5 grid flex-1 content-start gap-2 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-mint" />{f}</li>)}
              </ul>
              {!inApp && <a href={p.id === "school" ? "#/register?role=school" : "#/register?role=tutor"} className={`mt-6 ${p.hot ? "btn-brand" : "btn-light"}`}>Попробовать 3 дня бесплатно</a>}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-ink-mute">Ученики и родители пользуются платформой бесплатно.</p>
    </>
  );
}

export function Faq({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="mx-auto grid max-w-3xl gap-3">
      {items.map(([q, a], i) => (
        <div key={q} className="card !p-0">
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left font-bold">
            {q}<ChevronDown size={18} className={`shrink-0 transition ${open === i ? "rotate-180" : ""}`} />
          </button>
          {open === i && <p className="px-6 pb-5 text-ink-soft">{a}</p>}
        </div>
      ))}
    </div>
  );
}
