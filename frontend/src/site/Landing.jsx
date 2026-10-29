import { ArrowRight, Smartphone } from "lucide-react";
import { useState } from "react";
import { firstMonth, PRICE } from "../lib/pricing.js";
import { useSession } from "../lib/session.js";
import { copy } from "../ui/kit.jsx";
import Reviews from "./Reviews.jsx";
import { Faq, Phone, PricingCards, Section, Shot, Ticks } from "./parts.jsx";

// Слова коллег, которые попробовали Bright со своими учениками. Публикуются как есть.
const COLLEAGUES = [
  "Данное приложение очень подходит для работы с учениками, которые занимаются с приложения, мне очень понравилось!",
  "Очень удобно, что есть расшифровка, правда, иногда работает неточно.",
  "Кастомизацию любят мои ученики, но не хватает больше стикеров и элементов для работы на доске с учениками.",
];

const AFTER = [
  ["На доске", "446 стикеров вместо сотни, карточки-перевёртыши, таблицы, таймер и страницы учебника из PDF."],
  ["Расшифровка", "Распознавание выбирает только между языками урока: русским и тем, который изучаете. Ошибок стало меньше."],
  ["Телефон", "Новое мобильное меню, приложение для Android и установка на iPhone."],
];

/** Блок «текст + картинка»: на компьютере картинка чередуется слева и справа. */
function Feature({ label, title, text, items, flip, children, more }) {
  return (
    <section className={`grid items-center gap-10 py-14 md:py-20 lg:gap-16 ${flip ? "lg:grid-cols-[1.15fr_0.85fr]" : "lg:grid-cols-[0.85fr_1.15fr]"}`}>
      <div className={flip ? "lg:order-2" : ""}>
        <p className="text-sm font-medium text-ink-mute">{label}</p>
        <h2 className="mt-2 text-[1.9rem] leading-[1.1] md:text-[2.4rem]">{title}</h2>
        <p className="mt-4 text-lg text-ink-soft">{text}</p>
        {items && <Ticks items={items} className="mt-6" />}
        {more}
      </div>
      <div className={flip ? "lg:order-1" : ""}>{children}</div>
    </section>
  );
}

export default function Landing() {
  const session = useSession();
  const ref = session?.account?.referral?.code;
  const [copied, setCopied] = useState(false);
  const share = () => { copy(ref ? `${window.location.origin}/#/register?role=tutor&ref=${ref}` : window.location.origin); setCopied(true); };
  return (
    <>
      <section className="pb-6 pt-28 md:pt-36">
        <div className="max-w-3xl animate-fadeup">
          <p className="text-sm font-medium text-ink-mute">Для репетиторов языков и небольших онлайн-школ</p>
          <h1 className="mt-4 text-[clamp(2.5rem,6.4vw,4.6rem)] leading-[1.02]">Урок ведёте <span className="mark">вы</span>.<br />Остальное сделает Bright</h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-soft md:text-xl">
            Видеосвязь с доской и стикерами, конспект и слова сразу после урока, домашка, которую хочется делать, оплата занятий и новые ученики. Ученики заходят с компьютера, с телефона или из приложения.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#/register?role=tutor&start=trial" className="btn-brand btn-lg">Попробовать {PRICE.trialDays} дня бесплатно</a>
            <a href="#/study" className="btn-light btn-lg">Я ученик или родитель</a>
          </div>
          <p className="mt-4 text-sm text-ink-mute">{PRICE.teacher} ₽ в месяц, первый месяц {firstMonth()} ₽. Для пробного периода карта не нужна.</p>
        </div>
        <div className="relative mt-14 md:mt-16">
          <Shot src="/static/shot-board.webp" alt="Доска Bright: заметки, таблица Present Perfect, карточка со словом, таймер и стикеры" className="hidden sm:block lg:mr-28" />
          <Phone src="/static/shot-phone-home.webp" alt="Кабинет ученика на телефоне" className="mx-auto sm:hidden" />
          <Phone src="/static/shot-phone-home.webp" alt="Кабинет ученика на телефоне" className="absolute -bottom-14 right-0 hidden !max-w-[200px] lg:block" />
        </div>
      </section>

      <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
        {[["В браузере и в приложении", "Ничего не нужно устанавливать, но можно"], ["Видео не записывается", "Только текст речи для конспекта"], ["Ученикам и родителям бесплатно", "Платит преподаватель или школа"]].map(([t, d]) => (
          <div key={t} className="bg-white p-5"><p className="font-semibold">{t}</p><p className="mt-1 text-sm text-ink-mute">{d}</p></div>
        ))}
      </div>

      <Feature label="На уроке" title="Доска, за которой ученику интересно"
        text="Рисуйте пальцем или мышкой, кладите на доску материалы, видео и страницы учебника. Ученик видит всё сразу, демонстрация экрана не нужна."
        items={["Карточки-перевёртыши, таблицы и таймер для упражнений", "Страница учебника из PDF прямо на доску", "446 стикеров: похвала, грамматика, праздники"]}>
        <Shot src="/static/shot-stickers.webp" alt="Доска с открытой панелью стикеров" />
      </Feature>

      <Feature flip label="После урока" title="Конспект собирается сам. Вы только проверяете"
        text="Речь на уроке расшифровывается в текст. Bright собирает из него правила, ошибки, новые слова и домашку. Ученик и родитель получат конспект, когда вы нажмёте «Отправить»."
        items={["Слова сразу попадают в карточки ученика", "Родителю отдельный понятный отчёт", "Упражнения по теме урока в один клик"]}>
        <Shot src="/static/shot-lesson.webp" alt="Конспект урока: главное и правила" />
      </Feature>

      <Feature label="С телефона" title="Ученик повторит слова в метро"
        text="Многие ученики занимаются с телефона, некоторые прямо в дороге. В Bright для них отдельное мобильное меню и приложение."
        items={["Карточки по кривой забывания: пара минут в день", "Голосовые сообщения преподавателю с расшифровкой", "Домашка с фото тетради прямо с телефона"]}
        more={<a href="#/download" className="link mt-6 inline-flex items-center gap-1.5"><Smartphone size={16} />Скачать приложение</a>}>
        <div className="flex items-end justify-center gap-3 sm:gap-5">
          <Phone src="/static/shot-phone-words.webp" alt="Карточки слов на телефоне" className="hidden sm:block sm:translate-y-6" />
          <Phone src="/static/shot-phone-home.webp" alt="Главная ученика на телефоне" />
          <Phone src="/static/shot-phone-chat.webp" alt="Чат с преподавателем на телефоне" className="hidden sm:block sm:translate-y-6" />
        </div>
      </Feature>

      <Feature flip label="Искорка" title="Помощница внутри платформы"
        text="Искорка отвечает в чате и понимает голосовые. Преподавателю составит план урока, упражнения или письмо родителям. Ученику проверит слова и объяснит правило простыми словами."
        items={["Работает на сервере Bright, без сторонних сервисов", "Подсказывает, где что найти на платформе", "Без настроек: открыли и спросили"]}>
        <div className="flex justify-center"><Phone src="/static/shot-phone-spark.webp" alt="Искорка проверяет слова ученика" className="!max-w-[280px]" /></div>
      </Feature>

      <Feature label="Материалы" title="Готовые уроки и ваши учебники в одном месте"
        text="43 урока Bright с заданиями и автопроверкой: английский от A1 до B2, IELTS, ОГЭ и ЕГЭ, HSK, испанский, французский, итальянский и другие. Свои PDF загружаете один раз и открываете прямо на уроке."
        items={["Урок можно выдать как домашку в два касания", "Ученик видит результат сразу, вы видите ошибки", "Свои занятия собираются из тех же блоков"]}>
        <Shot src="/static/shot-courses.webp" alt="Курсы Bright: список готовых уроков" />
      </Feature>

      <div className="grid gap-4 py-6 md:grid-cols-2">
        <div className="card md:!p-8">
          <p className="text-sm font-medium text-ink-mute">Оплата занятий</p>
          <h3 className="mt-2 text-2xl">Не нужно напоминать об оплате самому</h3>
          <p className="mt-3 text-ink-soft">Напоминания до или после урока, пакеты на 4, 8 или 10 занятий. Ученик отмечает оплату, вы подтверждаете, баланс считается сам. Деньги идут вам напрямую.</p>
        </div>
        <div className="card md:!p-8">
          <p className="text-sm font-medium text-ink-mute">Новые ученики</p>
          <h3 className="mt-2 text-2xl">Заявки учеников</h3>
          <p className="mt-3 text-ink-soft">Ученики пишут, чего хотят добиться, какой у них уровень и бюджет. Вы откликаетесь со своей ценой, ученик выбирает и сразу попадает к вам в кабинет.</p>
          <a href="#/market?tab=students" className="link mt-4 inline-flex items-center gap-1">Смотреть заявки <ArrowRight size={16} /></a>
        </div>
      </div>

      <Section label="Отзывы" title="Коллеги попробовали Bright со своими учениками">
        <div className="grid gap-8 md:grid-cols-3 md:gap-6">
          {COLLEAGUES.map((q) => (
            <figure key={q} className="border-t-2 border-ink pt-5">
              <blockquote className="text-lg leading-snug md:text-xl">«{q}»</blockquote>
              <figcaption className="mt-4 text-sm text-ink-mute">Преподаватель</figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-12 rounded-2xl bg-cream p-6 md:p-8">
          <p className="font-semibold">Что мы поменяли после этих отзывов</p>
          <dl className="mt-4 grid gap-5 md:grid-cols-3">
            {AFTER.map(([t, d]) => <div key={t}><dt className="text-sm font-semibold">{t}</dt><dd className="mt-1 text-sm text-ink-soft">{d}</dd></div>)}
          </dl>
        </div>
        <div className="mt-10"><Reviews limit={3} tabs={false} hideEmpty /></div>
      </Section>

      <section className="py-6">
        <div className="grid items-center gap-8 rounded-3xl bg-ink p-8 text-white md:grid-cols-[1.4fr_1fr] md:p-12">
          <div>
            <p className="text-sm font-medium text-white/50">Онлайн-школам</p>
            <h2 className="mt-2 text-[1.9rem] leading-[1.1] !text-white md:text-[2.4rem]">Своя школа на Bright</h2>
            <p className="mt-4 text-lg text-white/70">Все преподаватели и ученики в одном кабинете. Школа видит уроки, отчёты и оплаты, а контакты в чатах и на доске скрываются, чтобы ученики не уходили в личку.</p>
          </div>
          <div className="md:text-right">
            <p className="num text-5xl font-bold">{PRICE.school} ₽</p>
            <p className="mt-1 text-sm text-white/60">в месяц за преподавателя</p>
            <a href="#/schools" className="btn-accent btn-lg mt-6">Подробнее для школ</a>
          </div>
        </div>
      </section>

      <Section label="Тарифы" title={`${PRICE.teacher} ₽ в месяц, всё включено`} text={`Попробуйте ${PRICE.trialDays} дня бесплатно или оплатите сразу: первый месяц стоит ${firstMonth()} ₽.`}>
        <PricingCards />
      </Section>

      <Section label="Вопросы" title="Частые вопросы" center>
        <Faq items={[
          ["Нужно ли что-то устанавливать?", "Нет. Всё работает в браузере на компьютере, планшете и телефоне. Для телефона есть приложение: его можно скачать на странице «Приложение»."],
          ["Видит ли ученик мой телефон или Telegram?", "Нет. Ученики и родители видят только ваше имя, переписка идёт через платформу."],
          ["Записывается ли видео урока?", "Нет. Звук расшифровывается в текст для конспекта, видео и аудио не сохраняются. Ученик видит предупреждение и соглашается перед входом."],
          ["Можно ли проверить конспект до отправки ученику?", "Да. Конспект уходит ученику и родителю только после того, как вы нажмёте «Отправить». Любой пункт можно поправить."],
          ["Как перенести материалы с другой платформы?", "Выгрузите материалы файлами (PDF, картинки, аудио) и перетащите их в «Материалы» пачкой. Ссылки на видео просто вставьте."],
          ["Сколько стоит?", `Преподавателю ${PRICE.teacher} ₽ в месяц без ограничений по ученикам, школе ${PRICE.school} ₽ за преподавателя. Первые ${PRICE.trialDays} дня бесплатно, при оплате сразу первый месяц стоит ${firstMonth()} ₽.`],
        ]} />
      </Section>

      <section className="pb-6">
        <div className="rounded-3xl border border-line bg-white px-6 py-12 text-center md:px-16 md:py-16">
          <h2 className="text-[2rem] leading-[1.1] md:text-[2.6rem]">Проведите первый урок сегодня</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink-soft">Регистрация занимает минуту. Добавьте ученика, отправьте ему ссылку и начните урок.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#/register?role=tutor&start=trial" className="btn-brand btn-lg">Попробовать бесплатно</a>
            <button type="button" onClick={share} className="btn-light btn-lg">{copied ? "Ссылка скопирована" : "Отправить коллеге"}</button>
          </div>
          <p className="mx-auto mt-5 max-w-md text-sm text-ink-mute">Когда коллега оформит тариф по вашей ссылке, ваше следующее продление будет вдвое дешевле.</p>
        </div>
      </section>
    </>
  );
}
