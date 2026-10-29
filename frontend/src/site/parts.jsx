import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { firstMonth, PERIOD_DISCOUNT, PERIOD_TITLE, perDay, periodTotal, PRICE, rub } from "../lib/pricing.js";

export function Section({ label, title, text, children, className = "", center, id }) {
  return (
    <section id={id} className={`py-16 md:py-24 ${className}`}>
      {(title || label) && (
        <div className={`mb-10 max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
          {label && <p className="text-sm font-medium text-ink-mute">{label}</p>}
          {title && <h2 className="mt-2 text-[2rem] leading-[1.1] md:text-[2.6rem]">{title}</h2>}
          {text && <p className="mt-4 text-lg text-ink-soft">{text}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Настоящий скриншот кабинета в тонкой рамке. */
export function Shot({ src, alt, className = "" }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-white shadow-lift ${className}`}>
      <img src={src} alt={alt} loading="lazy" decoding="async" className="block h-auto w-full" />
    </div>
  );
}

/** Скриншот с телефона в корпусе. */
export function Phone({ src, alt, className = "" }) {
  return (
    <div className={`w-full max-w-[260px] rounded-[2.2rem] bg-ink p-[7px] shadow-lift ${className}`}>
      <img src={src} alt={alt} loading="lazy" decoding="async" className="block aspect-[390/844] w-full rounded-[1.75rem] bg-paper object-cover object-top" />
    </div>
  );
}

export function Ticks({ items, className = "" }) {
  return (
    <ul className={`grid gap-2.5 ${className}`}>
      {items.map((t) => <li key={t} className="flex gap-3 text-ink-soft"><Check size={18} className="mt-0.5 shrink-0 text-ink" strokeWidth={2.4} />{t}</li>)}
    </ul>
  );
}

export const PLANS = [
  { id: "teacher", title: "Преподаватель", who: "Репетиторам и преподавателям", hot: true,
    groups: [
      ["Урок", ["Видеосвязь в браузере и в приложении", "Расшифровка речи для конспекта, видео не сохраняется", "Чат урока и доска на одном экране"]],
      ["Доска", ["Рисование пальцем и пером, работает с телефона", "Карточки-перевёртыши, таблицы, таймер, страницы PDF", "446 стикеров, фото с обрезкой, видео по ссылке"]],
      ["После урока", ["Конспект, слова и домашка собираются сами, вы только правите", "Слова сразу попадают в карточки ученика", "Упражнения по теме урока в один клик"]],
      ["Материалы", ["43 готовых урока Bright: английский, IELTS, ОГЭ и ЕГЭ, HSK и другие", "Ваши PDF и картинки открываются прямо в платформе", "Интерактивные задания с автопроверкой"]],
      ["Искорка", ["Помощница внутри платформы: план урока, упражнения, письмо родителям", "Понимает голосовые"]],
      ["Деньги и ученики", ["Напоминания об оплате и пакеты занятий", "Голосовые сообщения с расшифровкой", "Отчёты родителям", "Заявки новых учеников"]],
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
              {PERIOD_TITLE[m]}{PERIOD_DISCOUNT[m] ? <span className={months === m ? "ml-1.5 text-sun" : "ml-1.5 text-ink-mute"}>−{PERIOD_DISCOUNT[m]}%</span> : null}
            </button>
          ))}
        </div>
        {!inApp && <span className="text-sm text-ink-mute">{PRICE.trialDays} дня бесплатно, без карты</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {PLANS.map((p) => {
          const total = periodTotal(p.id, months);
          const perMonth = Math.round(total / months);
          const first = p.id === "teacher" && months === 1 && !inApp;
          const shown = first ? firstMonth() : perMonth;
          return (
            <div key={p.id} data-brand={p.id === "school" ? "study" : "teach"} className={`card relative flex flex-col ${p.hot ? "!border-ink" : ""}`}>
              {p.hot && <span className="absolute -top-3 left-6 rounded-md bg-sun px-2 py-0.5 text-xs font-semibold">Для репетитора</span>}
              <h3 className="text-2xl">{p.title}</h3>
              <p className="mt-1 text-sm text-ink-mute">{p.who}</p>
              <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
                {first && <span className="num text-xl text-ink-mute line-through">{PRICE.teacher}</span>}
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
                    <ul className="grid gap-1.5">{items.map((f) => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-ink" />{f}</li>)}</ul>
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
    <div className="mx-auto max-w-3xl divide-y divide-line border-y border-line">
      {items.map(([q, a], i) => (
        <div key={q}>
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left text-[17px] font-semibold">
            {q}<ChevronDown size={18} className={`shrink-0 text-ink-mute transition ${open === i ? "rotate-180" : ""}`} />
          </button>
          {open === i && <p className="-mt-1 pb-5 pr-8 text-ink-soft">{a}</p>}
        </div>
      ))}
    </div>
  );
}
