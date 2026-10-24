import { Check, ChevronDown, Mic, Video } from "lucide-react";
import { useState } from "react";
import { stickerById } from "../board/stickers.js";
import { firstMonth, PERIOD_DISCOUNT, PERIOD_TITLE, perDay, periodTotal, PRICE, rub } from "../lib/pricing.js";

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
  ["Nice to meet you", "Приятно познакомиться"], ["你好", "nǐ hǎo · привет"], ["Practice makes perfect", "Повторение – мать учения"],
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
        <p className="mt-1 text-xs text-ink-mute">Ученику и родителям – сразу после урока</p>
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
  { id: "teacher", title: "Преподаватель", who: "Репетиторам и преподавателям", hot: true,
    groups: [
      ["Урок", ["Видеосвязь в браузере, ставить Zoom не нужно", "Запись речи для конспекта (видео не сохраняется, только текст)", "Чат урока и доска на одном экране"]],
      ["Доска", ["Рисование пальцем и пером, работает с телефона", "Стикеры к праздникам, фото с обрезкой, видео по ссылке", "Материалы кладутся на доску в два касания"]],
      ["После урока", ["Конспект, новые слова и домашка собираются сами, вы только правите", "Слова сразу попадают в карточки ученика", "Упражнения по теме урока в один клик", "Конспект можно проверить до отправки"]],
      ["Занятия и домашка", ["Интерактивные занятия: пропуски, пары, тесты, аудирование", "Готовые уроки IELTS и HSK, создание занятий с ИИ", "Ответы учеников с фото и ваши комментарии"]],
      ["Деньги", ["Напоминания об оплате до или после урока", "Предоплата за 1, 4, 5, 8 или 10 занятий", "Подтверждение оплаты и письма на почту"]],
      ["Ученики и родители", ["Учеников сколько угодно", "Отчёты и переписка с родителями", "Кабинеты учеников с оформлением и мини-настроением", "Поиск новых учеников, 10 языков"]],
    ] },
  { id: "school", title: "Онлайн-школа", who: "Цена за одного преподавателя",
    groups: [
      ["Всё из тарифа «Преподаватель»", ["Каждому преподавателю в команде"]],
      ["Контроль", ["Кабинет школы: преподаватели, ученики, уроки, отчёты", "Контакты в чате, речи и на доске блокируются", "Сигналы школе о попытках увести ученика"]],
      ["Команда", ["Общая база материалов и занятий", "Преподаватели подключаются по одной ссылке", "Родители пишут напрямую в школу"]],
      ["Деньги", ["Общие реквизиты и правила оплаты занятий", "Одна оплата за всех преподавателей"]],
    ] },
];

const PERIODS = [1, 3, 12];

/** Цена периода: крупно в месяц, ниже сумма и «сколько в день». Первый месяц преподавателя показан со скидкой. */
export function PricingCards({ inApp }) {
  const [months, setMonths] = useState(1);
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Срок оплаты" className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-white p-1">
          {PERIODS.map((m) => (
            <button key={m} type="button" role="tab" aria-selected={months === m} onClick={() => setMonths(m)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${months === m ? "bg-ink text-white" : "text-ink-soft hover:bg-cream"}`}>
              {PERIOD_TITLE[m]}{PERIOD_DISCOUNT[m] ? <span className={months === m ? "ml-1.5 text-sun" : "ml-1.5 text-mint"}>−{PERIOD_DISCOUNT[m]}%</span> : null}
            </button>
          ))}
        </div>
        {!inApp && <span className="chip chip-brand">{PRICE.trialDays} дня бесплатно, без карты</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {PLANS.map((p) => {
          const total = periodTotal(p.id, months);
          const perMonth = Math.round(total / months);
          const first = p.id === "teacher" && months === 1 && !inApp;
          const shown = first ? firstMonth() : perMonth;
          return (
            <div key={p.id} data-brand={p.id === "school" ? "study" : "teach"} className={`card relative flex flex-col ${p.hot ? "border-brand shadow-teach-glow" : ""}`}>
              {p.hot && <span className="chip chip-brand absolute -top-3 left-6">Выбор репетиторов</span>}
              <h3 className="text-2xl">{p.title}</h3>
              <p className="mt-1 text-sm text-ink-mute">{p.who}</p>
              <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
                {first && <span className="num text-xl text-ink-mute line-through decoration-teach/70">{PRICE.teacher}</span>}
                <span className="num font-display text-5xl font-extrabold tracking-tight">{shown}</span>
                <span className="font-display text-2xl font-bold text-ink-soft">₽</span>
                <span className="text-sm text-ink-mute">в месяц{p.id === "school" ? " за преподавателя" : ""}</span>
              </p>
              <p className="mt-1 min-h-5 text-sm text-ink-mute">
                {first ? <>Первый месяц на {PRICE.firstDiscount}% дешевле, дальше {PRICE.teacher} ₽</>
                  : months > 1 ? <>{rub(total)} за {months === 12 ? "год" : "3 месяца"}, это {perDay(perMonth)} ₽ в день</>
                    : <>Это {perDay(shown)} ₽ в день</>}
              </p>
              <div className="mt-5 grid flex-1 content-start gap-4 text-sm">
                {p.groups.map(([title, items]) => (
                  <div key={title}>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-mute">{title}</p>
                    <ul className="grid gap-1.5">{items.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-mint" />{f}</li>)}</ul>
                  </div>
                ))}
              </div>
              {!inApp && (
                <div className="mt-6 grid gap-2">
                  <a href={`#/register?role=${p.id === "school" ? "school" : "tutor"}&start=trial`} className={p.hot ? "btn-brand" : "btn-light"}>Попробовать {PRICE.trialDays} дня бесплатно</a>
                  <a href={`#/register?role=${p.id === "school" ? "school" : "tutor"}&start=pay`} className="text-center text-sm font-semibold text-ink-mute hover:text-ink">
                    {p.id === "teacher" ? `Сразу оплатить за ${firstMonth()} ₽` : "Сразу оплатить"}</a>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-ink-mute">Ученики и родители пользуются платформой бесплатно. Оплата картой или через СБП.</p>
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
