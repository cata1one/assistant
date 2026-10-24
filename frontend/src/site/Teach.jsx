import {
  ArrowRight, FileStack, Gift, Lock, NotebookPen, PenTool, Repeat, Search, Sparkles, Users, Video, Wallet,
} from "lucide-react";
import { useState } from "react";
import { firstMonth, PRICE } from "../lib/pricing.js";
import { useSession } from "../lib/session.js";
import { copy } from "../ui/kit.jsx";
import { Faq, FeatureGrid, Marquee, PricingCards, ProductMock, Section } from "./parts.jsx";

const STEPS = [
  ["Добавили ученика", "Вписали имя и отправили ему ссылку. Регистрация у ученика занимает минуту."],
  ["Провели урок", "Нажали «Начать урок». Видео, доска и материалы уже на одном экране."],
  ["Конспект ушёл сам", "Слова попали в карточки, домашка и упражнения готовы. Вы только проверяете и отправляете."],
];

export default function Teach() {
  const session = useSession();
  const ref = session?.account?.referral?.code;
  const [copied, setCopied] = useState(false);
  // У вошедшего преподавателя своя ссылка: по ней начисляется скидка
  const share = () => { copy(ref ? `${window.location.origin}/#/register?role=tutor&ref=${ref}` : `${window.location.origin}/#/teach`); setCopied(true); };
  return (
    <>
      <section className="grid items-center gap-14 pb-14 pt-28 md:pt-36 lg:grid-cols-[1.05fr_1fr]">
        <div className="animate-fadeup">
          <span className="chip chip-brand">Для репетиторов и онлайн-школ</span>
          <h1 className="mt-5 text-[clamp(2.2rem,5.2vw,3.9rem)]">Ведите уроки,<br /><span className="text-brand">а не пять программ</span></h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">Функции, которые есть у онлайн-школ, и всё качество урока за {PRICE.teacher} ₽ в месяц. Видеосвязь, доска, материалы, домашки, конспекты и оплата занятий в одной вкладке.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#/register?role=tutor&start=trial" className="btn-brand btn-lg">Попробовать {PRICE.trialDays} дня бесплатно <ArrowRight size={18} /></a>
            <a href="#/register?role=tutor&start=pay" className="btn-light btn-lg">Сразу за {firstMonth()} ₽</a>
          </div>
          <p className="mt-4 text-sm text-ink-mute">Без карты. Ученику ничего ставить не нужно: он заходит по ссылке с телефона или компьютера.</p>
        </div>
        <ProductMock />
      </section>
      <Marquee />

      <Section eyebrow="Как это работает" title="Один урок от начала до конца">
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="card">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
              <h3 className="mt-4 text-xl">{t}</h3>
              <p className="mt-2 text-sm text-ink-soft">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section eyebrow="Что внутри" title="Уроки, которые приятно готовить и вести">
        <FeatureGrid items={[
          { icon: PenTool, title: "Доска с телефона и компьютера", text: "Рисуйте пальцем или мышкой, добавляйте видео, фото и стикеры, обрезайте картинки прямо на доске. Демонстрация экрана не нужна.", tone: "teach" },
          { icon: FileStack, title: "Материалы в одном месте", text: "Загрузите учебники, карточки, аудио и презентации один раз, а на доску кладите в два касания.", tone: "sun" },
          { icon: Video, title: "Урок в браузере", text: "Ученик заходит по кнопке из кабинета. Звонок и доску запускаете вы.", tone: "study" },
          { icon: NotebookPen, title: "Конспект без рутины", text: "Что разобрали, новые слова, домашка и упражнения по теме. Перед отправкой ученику любой пункт можно поправить.", tone: "mint" },
          { icon: Repeat, title: "Слова запоминаются сами", text: "Слова урока, домашки и занятий попадают в карточки с интервальным повторением. Вручную добавлять тоже можно.", tone: "study" },
          { icon: Sparkles, title: "Интерактивные занятия", text: "Вставка слов в текст, пары, тесты и аудирование с автопроверкой. Есть готовые материалы для IELTS и HSK.", tone: "lilac" },
        ]} />
      </Section>

      <Section eyebrow="Оплата занятий" title="Не нужно напоминать об оплате самому">
        <div className="card grid items-center gap-8 md:grid-cols-[1.3fr_1fr] md:!p-10">
          <div>
            <p className="text-lg text-ink-soft">Включите это, если хотите, чтобы платформа сама напоминала ученикам, а вы не писали «не забудьте оплатить». Выключено по умолчанию.</p>
            <ul className="mt-4 grid gap-2.5 text-ink-soft">
              {["Напоминание до урока или после него, на почту и в Telegram", "Предоплата за 1, 4, 5, 8 или 10 занятий сразу", "Можно не пускать на урок без оплаченного занятия", "Ученик нажимает «Я оплатил(а)», вы подтверждаете, баланс считается сам"].map((t) => (
                <li key={t} className="flex gap-3"><Wallet size={18} className="mt-0.5 shrink-0 text-brand" />{t}</li>))}
            </ul>
          </div>
          <p className="rounded-3xl bg-brand-tint p-5 text-sm text-ink-soft">Деньги идут вам напрямую по вашим реквизитам. Платформа их не принимает и комиссию не берёт.</p>
        </div>
      </Section>

      <Section eyebrow="Ваше и только ваше" title="Частный репетитор или школа">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <h3 className="flex items-center gap-2 text-xl"><Lock size={20} className="text-brand" />Частный репетитор</h3>
            <p className="mt-3 text-ink-soft">Ваши ученики остаются вашими. Переписка не фильтруется и никому не передаётся. Ученики и родители видят только ваше имя, без телефона и аккаунтов.</p>
          </div>
          <div className="card">
            <h3 className="flex items-center gap-2 text-xl"><Users size={20} className="text-brand" />Преподаватель школы</h3>
            <p className="mt-3 text-ink-soft">Школа приглашает вас по ссылке, даёт учеников и общую базу материалов. Расшифровка урока защищает вас в спорных ситуациях с учеником.</p>
          </div>
        </div>
      </Section>

      <Section eyebrow="Ученики" title="Найдите новых учеников">
        <div className="card grid items-center gap-6 md:grid-cols-[1.4fr_1fr] md:!p-10">
          <p className="text-lg text-ink-soft">В каталоге ученики описывают задачу: цель, уровень, возраст, бюджет. Вы откликаетесь со своей ценой, ученик выбирает и сразу попадает к вам в кабинет.</p>
          <a href="#/market?tab=students" className="btn-brand btn-lg"><Search size={18} />Смотреть заявки</a>
        </div>
      </Section>

      <Section eyebrow="Тарифы" title={`Один тариф, всё включено: ${PRICE.teacher} ₽`}><PricingCards /></Section>

      <Section title="Вопросы преподавателей" center>
        <Faq items={[
          ["Сколько стоит после пробного периода?", `${PRICE.teacher} ₽ в месяц, без ограничений по числу учеников. При оплате сразу первый месяц стоит ${firstMonth()} ₽, за год выходит ещё дешевле.`],
          ["Как перенести материалы с другой платформы?", "Выгрузите свои материалы файлами и перетащите их в «Материалы», можно сразу пачкой. Видео переносятся ссылками."],
          ["Может ли ученик сам начать звонок или открыть доску?", "Нет. Урок и доску открывает преподаватель, ученик заходит по кнопке, когда урок начался."],
          ["Нужен ли ученику Telegram?", "Нет, всё работает на сайте. Telegram можно привязать для уведомлений."],
          ["Что с записью урока?", "Звук расшифровывается в текст для конспекта, видео и аудио не сохраняются. Ученик видит предупреждение и соглашается перед входом."],
          ["Можно ли проверить конспект до отправки ученику?", "Да, в профиле включается проверка перед отправкой. Тогда конспект придёт ученику только после вашего нажатия."],
        ]} />
      </Section>

      <section className="pb-6">
        <div className="card flex flex-wrap items-center justify-between gap-5 md:!p-10">
          <div className="flex min-w-0 flex-1 items-center gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Gift size={26} /></span>
            <div><h3 className="text-xl">Расскажите коллеге и получите скидку 50%</h3><p className="mt-1 text-sm text-ink-soft">Отправьте ссылку тем, кто тоже устал переключаться между программами. Когда коллега оформит тариф, следующее продление у вас обойдётся вдвое дешевле.</p></div></div>
          <button type="button" onClick={share} className="btn-light"><Sparkles size={16} />{copied ? "Ссылка скопирована" : ref ? "Скопировать мою ссылку" : "Скопировать ссылку"}</button>
        </div>
      </section>
    </>
  );
}
