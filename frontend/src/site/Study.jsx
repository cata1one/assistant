import { ArrowRight, BookOpenCheck, Brain, HeartHandshake, MessageCircle, Search, ShieldCheck, Users } from "lucide-react";
import { Faq, FeatureGrid, Marquee, Section } from "./parts.jsx";

function CardDemo() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="glass rounded-[2rem] p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-brand">Повторить сегодня · 12 слов</p>
        <div className="mt-4 rounded-3xl border border-line bg-white px-6 py-10 shadow-soft">
          <p className="font-display text-4xl font-extrabold">wardrobe</p>
          <p className="mt-2 text-ink-mute">[ˈwɔːdrəʊb]</p>
          <p className="mt-5 rounded-2xl bg-brand-tint px-4 py-2 font-semibold text-brand-deep">шкаф для одежды</p>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 text-xs font-bold">
          {[["Не помню", "bg-teach-soft text-teach-deep", "10 мин"], ["Трудно", "bg-sun-soft text-[#7a5300]", "1 д"], ["Помню", "bg-mint-soft text-[#146b4c]", "3 д"], ["Легко", "bg-study-soft text-study-deep", "4 д"]].map(([t, c, d]) => (
            <span key={t} className={`rounded-2xl px-2 py-2.5 ${c}`}>{t}<span className="block font-normal opacity-70">{d}</span></span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Study() {
  return (
    <>
      <section className="grid items-center gap-14 pb-14 pt-28 md:pt-36 lg:grid-cols-[1.05fr_1fr]">
        <div className="animate-fadeup">
          <span className="chip chip-brand">BetterStudy — ученикам и родителям</span>
          <h1 className="mt-5 text-[clamp(2.3rem,5.6vw,4.2rem)]">Занятия, после которых<br /><span className="text-brand">слова не забываются</span></h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">Урок с преподавателем, конспект, домашка и карточки новых слов — в одном кабинете. Ничего не теряется в переписке, а родители видят, как идут дела.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#/market/new" className="btn-brand btn-lg"><Search size={18} />Найти преподавателя</a>
            <a href="#/register?role=student" className="btn-light btn-lg">Меня пригласил преподаватель</a>
          </div>
          <p className="mt-4 text-sm text-ink-mute">Для учеников и родителей — бесплатно.</p>
        </div>
        <CardDemo />
      </section>
      <Marquee />

      <Section eyebrow="Для ученика" title="Всё, что задали, — в одном месте">
        <FeatureGrid items={[
          { icon: Brain, title: "Карточки, которые помнят за вас", text: "Слова с урока и из домашки сами попадают в карточки. Трудные слова возвращаются чаще, выученные — всё реже. Пять минут в день вместо зубрёжки перед уроком.", tone: "study" },
          { icon: BookOpenCheck, title: "Конспект после каждого урока", text: "Правила с примерами, ваши ошибки с исправлениями, новые слова и короткий тест. Удобно повторить перед следующим занятием.", tone: "mint" },
          { icon: MessageCircle, title: "Домашка без пересылки фото в мессенджер", text: "Задания с проверкой ответов, а к письменной работе можно приложить фото тетради или скриншот. Вопрос преподавателю — в чате тут же.", tone: "lilac" },
        ]} />
      </Section>

      <Section eyebrow="Для родителей" title="Видно, как ребёнок занимается">
        <div className="grid gap-4 md:grid-cols-3">
          {[[Users, "Отчёт после каждого урока", "Что прошли, что получилось, над чем ещё поработать и как помочь дома. Отчёт приходит на сайт — Telegram не нужен."],
            [HeartHandshake, "Связь без лишних номеров", "Напишите преподавателю прямо в кабинете. Если ребёнок занимается в онлайн-школе, можно написать и в школу."],
            [ShieldCheck, "Домашка и слова под контролем", "Видно, какие задания выполнены и сколько слов ребёнок уже выучил по карточкам."]].map(([I, t, d]) => (
            <div key={t} className="card"><I size={24} className="text-brand" /><h3 className="mt-3 text-xl">{t}</h3><p className="mt-2 text-sm text-ink-soft">{d}</p></div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Как начать" title="Есть преподаватель или ещё нет">
        <div className="grid gap-4 md:grid-cols-2">
          <a href="#/register?role=student" className="card card-hover"><h3 className="text-xl">Преподаватель уже есть</h3><p className="mt-2 text-ink-soft">Попросите у него ссылку-приглашение. Откройте её, зарегистрируйтесь за минуту — и вы сразу в общем кабинете.</p><span className="link mt-4 inline-flex items-center gap-1">Зарегистрироваться <ArrowRight size={16} /></span></a>
          <a href="#/market/new" className="card card-hover"><h3 className="text-xl">Преподавателя пока нет</h3><p className="mt-2 text-ink-soft">Расскажите, чего хотите добиться и какой у вас бюджет. Преподаватели откликнутся со своими условиями, а вы выберете подходящего.</p><span className="link mt-4 inline-flex items-center gap-1">Оставить заявку <ArrowRight size={16} /></span></a>
        </div>
      </Section>

      <Section title="Частые вопросы" center>
        <Faq items={[
          ["Это платно для ученика?", "Нет. Ученики и родители пользуются платформой бесплатно. За платформу платит преподаватель или школа, а сами занятия вы оплачиваете преподавателю, как и раньше."],
          ["Нужно что-то устанавливать?", "Нет. Уроки, домашка и карточки работают в браузере — на компьютере, планшете и телефоне."],
          ["Как родителю получать отчёты?", "Преподаватель даёт отдельную ссылку для родителя. Откройте её и зарегистрируйтесь — отчёты после уроков будут приходить в ваш кабинет."],
          ["Увидит ли преподаватель мой номер телефона?", "Нет. Преподаватель видит только имя. Общение идёт через платформу."],
          ["Можно ли добавить свои слова в карточки?", "Да. В разделе «Словарь» можно добавить свои слова и убрать лишние — карточки обновятся сразу."],
        ]} />
      </Section>
    </>
  );
}
