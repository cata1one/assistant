import {
  ArrowRight, BookOpenCheck, Building2, Clapperboard, FileStack, GraduationCap, Layers, MessagesSquare, NotebookPen,
  PenTool, Repeat, ShieldCheck, Users, Video, Wallet,
} from "lucide-react";
import { firstMonth, PRICE } from "../lib/pricing.js";
import Reviews from "./Reviews.jsx";
import { Faq, FeatureGrid, Marquee, PricingCards, ProductMock, Section } from "./parts.jsx";

const BEFORE = ["Zoom", "Miro", "Google Docs", "WhatsApp", "Quizlet", "Excel с оплатами", "Демонстрация экрана"];

export default function Landing() {
  return (
    <>
      <section className="grid items-center gap-14 pb-16 pt-28 md:pt-36 lg:grid-cols-[1.05fr_1fr]">
        <div className="animate-fadeup">
          <span className="chip"><span className="h-1.5 w-1.5 rounded-full bg-mint" /> 10 языков: английский, китайский, испанский, французский и другие</span>
          <h1 className="mt-5 text-[clamp(2.4rem,6vw,4.4rem)]">
            Уроки языков,<br />которые <span className="relative whitespace-nowrap text-brand">запоминаются<svg aria-hidden="true" viewBox="0 0 300 20" className="absolute -bottom-2 left-0 h-3 w-full text-sun"><path d="M4 14 Q 150 0 296 12" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round" /></svg></span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            Видеосвязь, доска, материалы и домашки в одном окне. Работает в браузере, в том числе на телефоне.
            После урока ученик получает конспект и карточки со словами, родители отчёт, а преподаватель свободный вечер.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <a href="#/teach" data-brand="teach" className="group card card-hover flex items-center gap-4 !p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><PenTool size={22} /></span>
              <span className="min-w-0 flex-1"><span className="block font-display text-lg font-extrabold">Я преподаю</span><span className="text-sm text-ink-mute">Репетиторам и школам</span></span>
              <ArrowRight className="text-brand transition group-hover:translate-x-1" size={18} />
            </a>
            <a href="#/study" data-brand="study" className="group card card-hover flex items-center gap-4 !p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><GraduationCap size={22} /></span>
              <span className="min-w-0 flex-1"><span className="block font-display text-lg font-extrabold">Я учусь</span><span className="text-sm text-ink-mute">Ученикам и родителям</span></span>
              <ArrowRight className="text-brand transition group-hover:translate-x-1" size={18} />
            </a>
          </div>
          <p className="mt-4 text-sm text-ink-mute">Своя онлайн-школа? <a href="#/register?role=school" className="link">Подключите всю команду</a></p>
        </div>
        <ProductMock />
      </section>

      <Marquee />

      <Section eyebrow="Хватит метаться" title="Вместо семи вкладок одна" text="Обычный урок сегодня: звонок в одной программе, доска в другой, материалы в третьей, видео через демонстрацию экрана, домашка в мессенджере. В Bright всё это в одном окне.">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
          <div className="card flex flex-wrap gap-2 !bg-cream">
            {BEFORE.map((b) => <span key={b} className="chip line-through decoration-teach/60">{b}</span>)}
          </div>
          <ArrowRight className="mx-auto rotate-90 text-ink-mute md:rotate-0" />
          <div className="card flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Layers size={26} /></span>
            <div><p className="font-display text-xl font-extrabold">Bright</p><p className="text-sm text-ink-mute">урок, доска, материалы, видео, домашки, слова, отчёты и оплата</p></div>
          </div>
        </div>
      </Section>

      <Section eyebrow="Возможности" title="Всё, что нужно для урока">
        <FeatureGrid items={[
          { icon: Video, title: "Видеоурок в браузере", text: "Ничего устанавливать не нужно. Речь расшифровывается для конспекта, видео не записывается.", tone: "study" },
          { icon: PenTool, title: "Доска, на которой приятно работать", text: "Заметки, фигуры, рисование, фото с обрезкой и стикеры к любому празднику: от Хэллоуина до китайского Нового года.", tone: "teach" },
          { icon: Clapperboard, title: "Видео без демонстрации экрана", text: "Вставьте ссылку на видео, и ученик смотрит его вместе с вами, без зависаний и рассинхрона звука.", tone: "lilac" },
          { icon: FileStack, title: "Все материалы в одном месте", text: "PDF, картинки, презентации, аудио. Можно перенести материалы из другой платформы пачкой файлов.", tone: "sun" },
          { icon: NotebookPen, title: "Конспект и домашка готовы сразу", text: "После урока: что разобрали, новые слова, упражнения по теме. Перед отправкой ученику всё можно поправить.", tone: "mint" },
          { icon: Repeat, title: "Карточки со словами", text: "Новые слова урока сами превращаются в карточки, которые повторяются по кривой забывания.", tone: "study" },
        ]} />
      </Section>

      <Section eyebrow="После урока" title="Каждый получает своё">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Ученик", "study", BookOpenCheck, ["Конспект: правила и ошибки", "Новые слова в карточках", "Упражнения с проверкой", "Домашнее задание"]],
            ["Родитель", "study", Users, ["Что прошли на уроке", "Успехи и на что обратить внимание", "Сделана ли домашка", "Отчёт на сайте, Telegram не обязателен"]],
            ["Преподаватель", "teach", PenTool, ["Полный отчёт с ответами", "Что повторить в следующий раз", "Отметки о выполненной домашке", "Оплаты и баланс занятий"]],
          ].map(([who, b, Icon, items]) => (
            <div key={who} data-brand={b} className="card">
              <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon size={20} /></span><p className="font-display text-lg font-extrabold">{who}</p></div>
              <ul className="mt-4 grid gap-2 text-sm text-ink-soft">{items.map((x) => <li key={x} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{x}</li>)}</ul>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Для онлайн-школ" title="Ваши преподаватели, ваши ученики">
        <div data-brand="study" className="card grid items-center gap-8 md:grid-cols-[1.3fr_1fr] md:!p-10">
          <div>
            <ul className="grid gap-3 text-ink-soft">
              {[[Building2, "Один кабинет: все преподаватели, ученики, уроки и отчёты"], [ShieldCheck, "Школа получает сигнал, если в переписке, речи или на доске пытаются обменяться контактами"],
                [FileStack, "Общая база материалов для всей команды"], [Wallet, "Общие реквизиты и правила оплаты занятий"], [MessagesSquare, "Родители пишут преподавателю или школе через платформу"]].map(([I, t]) => (
                <li key={t} className="flex gap-3"><I size={20} className="mt-0.5 shrink-0 text-brand" />{t}</li>))}
            </ul>
          </div>
          <div className="text-center">
            <p className="num font-display text-5xl font-extrabold">{PRICE.school} ₽</p>
            <p className="text-sm text-ink-mute">за преподавателя в месяц</p>
            <a href="#/register?role=school&start=trial" className="btn-brand mt-5">Подключить школу</a>
          </div>
        </div>
      </Section>

      <Section eyebrow="Тарифы" title={`${PRICE.teacher} ₽ в месяц, и всё включено`} text={`Попробуйте ${PRICE.trialDays} дня бесплатно или оплатите сразу: первый месяц стоит ${firstMonth()} ₽.`}>
        <PricingCards />
      </Section>

      <Section eyebrow="Отзывы" title="Что говорят пользователи"><Reviews limit={6} /></Section>

      <Section eyebrow="Вопросы" title="Частые вопросы" center>
        <Faq items={[
          ["Нужно ли что-то устанавливать?", "Нет. Урок, доска и материалы работают в браузере на компьютере, планшете и телефоне."],
          ["Видит ли ученик мой телефон или Telegram?", "Нет. Ученики и родители видят только ваше имя, переписка идёт через платформу."],
          ["Сколько это стоит?", `Преподавателю ${PRICE.teacher} ₽ в месяц, школе ${PRICE.school} ₽ за каждого преподавателя. Новые пользователи ${PRICE.trialDays} дня пользуются бесплатно, а при оплате сразу первый месяц стоит ${firstMonth()} ₽.`],
          ["Как перенести материалы с другой платформы?", "Выгрузите материалы файлами (PDF, картинки, презентации) и перетащите их в раздел «Материалы» пачкой. Ссылки на видео просто вставьте."],
          ["Нужен ли ученику Telegram?", "Нет. Уроки, домашка, карточки и отчёты есть на сайте. Telegram можно привязать, чтобы уведомления приходили и туда."],
          ["Записывается ли видео урока?", "Нет. Звук расшифровывается в текст для конспекта, видео и аудио не сохраняются."],
          ["Чем частный репетитор отличается от школы?", "Частный репетитор работает сам, его переписка не фильтруется. У школы преподаватели под контролем: школа видит уроки и отчёты и получает сигналы о попытках обменяться контактами."],
        ]} />
      </Section>

      <section className="pb-10">
        <div data-brand="teach" className="relative overflow-hidden rounded-[2.5rem] bg-ink px-6 py-14 text-center text-white md:px-16">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(30rem_20rem_at_15%_0%,rgba(242,100,61,.45),transparent),radial-gradient(30rem_20rem_at_85%_100%,rgba(61,99,245,.45),transparent)]" />
          <div className="relative">
            <h2 className="text-3xl !text-white md:text-5xl">Проведите первый урок сегодня</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/75">{PRICE.trialDays} дня бесплатно со всеми функциями. Регистрация занимает минуту, дальше пригласите ученика по ссылке.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="#/register?role=tutor&start=trial" className="btn-brand btn-lg">Я преподаю</a>
              <a href="#/register?role=student" className="btn btn-lg bg-white text-ink hover:bg-cream">Я учусь</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
