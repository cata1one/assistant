import {
  ArrowRight, BookOpenCheck, Building2, Clapperboard, FileStack, GraduationCap, Layers, MessagesSquare, NotebookPen,
  PenTool, Repeat, ShieldCheck, Users, Video,
} from "lucide-react";
import Reviews from "./Reviews.jsx";
import { Faq, FeatureGrid, Marquee, PricingCards, ProductMock, Section } from "./parts.jsx";

const BEFORE = ["Zoom", "Miro", "Google Docs", "WhatsApp", "Quizlet", "Excel с оплатами", "Демонстрация экрана"];

export default function Landing() {
  return (
    <>
      {/* Первый экран: что это и для кого — за три секунды */}
      <section className="grid items-center gap-14 pb-16 pt-28 md:pt-36 lg:grid-cols-[1.05fr_1fr]">
        <div className="animate-fadeup">
          <span className="chip"><span className="h-1.5 w-1.5 rounded-full bg-mint" /> 10 языков: английский, китайский, испанский, французский и другие</span>
          <h1 className="mt-5 text-[clamp(2.4rem,6vw,4.4rem)]">
            Уроки языков,<br />которые <span className="relative whitespace-nowrap text-brand">запоминаются<svg aria-hidden="true" viewBox="0 0 300 20" className="absolute -bottom-2 left-0 h-3 w-full text-sun"><path d="M4 14 Q 150 0 296 12" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round" /></svg></span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            Урок, доска, материалы и видео — в одном окне, прямо в браузере и на телефоне. После занятия ученик
            получает конспект и карточки новых слов, родители — отчёт, а преподаватель — свободный вечер.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <a href="#/teach" data-brand="teach" className="group card card-hover flex items-center gap-4 !p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><PenTool size={22} /></span>
              <span className="min-w-0 flex-1"><span className="block font-display text-lg font-extrabold">Я преподаю</span><span className="text-sm text-ink-mute">BetterTeach — для репетиторов</span></span>
              <ArrowRight className="text-brand transition group-hover:translate-x-1" size={18} />
            </a>
            <a href="#/study" data-brand="study" className="group card card-hover flex items-center gap-4 !p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><GraduationCap size={22} /></span>
              <span className="min-w-0 flex-1"><span className="block font-display text-lg font-extrabold">Я учусь</span><span className="text-sm text-ink-mute">BetterStudy — ученикам и родителям</span></span>
              <ArrowRight className="text-brand transition group-hover:translate-x-1" size={18} />
            </a>
          </div>
          <p className="mt-4 text-sm text-ink-mute">Онлайн-школа? <a href="#/register?role=school" className="link">Подключите всю команду</a></p>
        </div>
        <ProductMock />
      </section>

      <Marquee />

      <Section eyebrow="Хватит метаться" title="Семь вкладок — или одна" text="Обычный урок сегодня: созвон в одной программе, доска в другой, материалы в третьей, видео через демонстрацию экрана, домашка в мессенджере. В Better всё это — одна вкладка.">
        <div className="grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
          <div className="card flex flex-wrap gap-2 !bg-cream">
            {BEFORE.map((b) => <span key={b} className="chip line-through decoration-teach/60">{b}</span>)}
          </div>
          <ArrowRight className="mx-auto rotate-90 text-ink-mute md:rotate-0" />
          <div className="card flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Layers size={26} /></span>
            <div><p className="font-display text-xl font-extrabold">Better</p><p className="text-sm text-ink-mute">урок, доска, материалы, видео, ДЗ, слова и отчёты</p></div>
          </div>
        </div>
      </Section>

      <Section eyebrow="Возможности" title="Всё, что нужно для урока">
        <FeatureGrid items={[
          { icon: Video, title: "Видеоурок в браузере", text: "Без установки программ. Запись и расшифровка урока — для конспекта.", tone: "study" },
          { icon: PenTool, title: "Доска, на которой приятно работать", text: "Заметки, фигуры, рисование, стикеры к праздникам — Хэллоуин, Новый год, китайский Новый год.", tone: "teach" },
          { icon: Clapperboard, title: "Видео без демонстрации экрана", text: "Добавляйте видео прямо на доску — ученик смотрит вместе с вами, без зависаний и задержки звука.", tone: "lilac" },
          { icon: FileStack, title: "Своя база материалов", text: "PDF, картинки, презентации, аудио. Перенесите материалы с ProgressMe пачкой файлов.", tone: "sun" },
          { icon: NotebookPen, title: "Конспект и ДЗ сами", text: "После урока — правила, ошибки, новые слова, тест и домашнее задание.", tone: "mint" },
          { icon: Repeat, title: "Карточки как в ReWord", text: "Новые слова урока сразу превращаются в карточки с повторением по кривой забывания.", tone: "study" },
        ]} />
      </Section>

      <Section eyebrow="После урока" title="Каждый получает своё">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Ученик", "BetterStudy", "study", BookOpenCheck, ["Конспект: правила и ошибки", "Новые слова — в карточки", "Тест с проверкой", "Домашнее задание"]],
            ["Родитель", "BetterStudy", "study", Users, ["Что прошли на уроке", "Успехи и на что обратить внимание", "Сделано ли ДЗ", "Отчёт на сайте — Telegram не обязателен"]],
            ["Преподаватель", "BetterTeach", "teach", PenTool, ["Полный отчёт с ответами", "Что повторить в следующий раз", "Отметки о выполненном ДЗ", "Ни минуты на рутину"]],
          ].map(([who, brand, b, Icon, items]) => (
            <div key={who} data-brand={b} className="card">
              <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand"><Icon size={20} /></span><div><p className="font-display text-lg font-extrabold">{who}</p><p className="text-xs font-semibold text-brand">{brand}</p></div></div>
              <ul className="mt-4 grid gap-2 text-sm text-ink-soft">{items.map((x) => <li key={x} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{x}</li>)}</ul>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Для онлайн-школ" title="Ваши преподаватели — ваши ученики">
        <div data-brand="study" className="card grid items-center gap-8 md:grid-cols-[1.3fr_1fr] md:!p-10">
          <div>
            <ul className="grid gap-3 text-ink-soft">
              {[[Building2, "Один кабинет: все преподаватели, ученики, уроки и отчёты"], [ShieldCheck, "Сигнал школе, если в переписке, речи или на доске пытаются обменяться контактами"],
                [FileStack, "Общая база материалов для всей команды"], [MessagesSquare, "Родители пишут преподавателю или школе — через платформу"]].map(([I, t]) => (
                <li key={t} className="flex gap-3"><I size={20} className="mt-0.5 shrink-0 text-brand" />{t}</li>))}
            </ul>
          </div>
          <div className="text-center">
            <p className="num font-display text-5xl font-extrabold">500 ₽</p>
            <p className="text-sm text-ink-mute">за преподавателя в месяц</p>
            <a href="#/register?role=school" className="btn-brand mt-5">Подключить школу</a>
          </div>
        </div>
      </Section>

      <Section eyebrow="Тарифы" title="300 ₽ в месяц — и всё включено" text="Попробуйте 3 дня бесплатно со всеми функциями. Карта не нужна.">
        <PricingCards />
      </Section>

      <Section eyebrow="Отзывы" title="Что говорят пользователи"><Reviews limit={6} /></Section>

      <Section eyebrow="Вопросы" title="Частые вопросы" center>
        <Faq items={[
          ["Нужно ли что-то устанавливать?", "Нет. Урок, доска и материалы работают в браузере — на компьютере, планшете и телефоне."],
          ["Видит ли ученик мой телефон или Telegram?", "Нет. Ученики и родители видят только ваше имя. Переписка идёт через платформу."],
          ["Как перенести материалы с ProgressMe?", "Выгрузите материалы файлами (PDF, картинки, презентации) и перетащите их в раздел «Материалы» — пачкой, за один раз. Ссылки на видео просто вставьте."],
          ["Нужен ли ученику Telegram?", "Нет. Всё есть на сайте: уроки, домашка, карточки, отчёты. Telegram можно привязать, чтобы уведомления приходили туда."],
          ["Чем частный репетитор отличается от школы?", "Частный репетитор работает сам — его переписка не фильтруется. У школы преподаватели под контролем: школа видит уроки и отчёты и получает сигналы о попытках обменяться контактами."],
        ]} />
      </Section>

      <section className="pb-10">
        <div data-brand="teach" className="relative overflow-hidden rounded-[2.5rem] bg-ink px-6 py-14 text-center text-white md:px-16">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(30rem_20rem_at_15%_0%,rgba(242,100,61,.45),transparent),radial-gradient(30rem_20rem_at_85%_100%,rgba(61,99,245,.45),transparent)]" />
          <div className="relative">
            <h2 className="text-3xl !text-white md:text-5xl">Проведите первый урок сегодня</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/75">3 дня бесплатно со всеми функциями. Регистрация за минуту — пригласите ученика по ссылке и начинайте.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="#/register?role=tutor" className="btn-brand btn-lg">Я преподаю</a>
              <a href="#/register?role=student" className="btn btn-lg bg-white text-ink hover:bg-cream">Я учусь</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
