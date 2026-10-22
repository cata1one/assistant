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
          <h1 className="mt-5 text-[clamp(2.3rem,5.6vw,4.2rem)]">Учить язык легче,<br />когда <span className="text-brand">всё под рукой</span></h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">Уроки, конспекты, домашка и карточки новых слов — в одном кабинете. Родители видят отчёты и успехи после каждого урока.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#/market/new" className="btn-brand btn-lg"><Search size={18} />Найти преподавателя</a>
            <a href="#/register?role=student" className="btn-light btn-lg">У меня есть приглашение</a>
          </div>
        </div>
        <CardDemo />
      </section>
      <Marquee />

      <Section eyebrow="Для ученика" title="Слова запоминаются сами">
        <FeatureGrid items={[
          { icon: Brain, title: "Карточки по кривой забывания", text: "Слова с урока сразу в колоде. Повторяете ровно тогда, когда начинаете забывать: 10 минут, день, три дня — и реже.", tone: "study" },
          { icon: BookOpenCheck, title: "Конспект каждого урока", text: "Правила с примерами, ваши ошибки и как правильно, что повторить к следующему разу.", tone: "mint" },
          { icon: MessageCircle, title: "Вопрос преподавателю — в любое время", text: "Чат прямо на сайте. Домашку можно сдать там же.", tone: "lilac" },
        ]} />
      </Section>

      <Section eyebrow="Для родителей" title="Понятно, за что вы платите">
        <div className="grid gap-4 md:grid-cols-3">
          {[[Users, "Отчёт после урока", "Что прошли, успехи, на что обратить внимание, замечания преподавателя."],
            [HeartHandshake, "Связь с преподавателем", "Пишите преподавателю или школе прямо в кабинете — без обмена номерами."],
            [ShieldCheck, "Безопасно", "Преподаватель видит только имя ребёнка. Telegram не обязателен — всё есть на сайте."]].map(([I, t, d]) => (
            <div key={t} className="card"><I size={24} className="text-brand" /><h3 className="mt-3 text-xl">{t}</h3><p className="mt-2 text-sm text-ink-soft">{d}</p></div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Как начать" title="Два способа">
        <div className="grid gap-4 md:grid-cols-2">
          <a href="#/market/new" className="card card-hover"><h3 className="text-xl">Нет преподавателя</h3><p className="mt-2 text-ink-soft">Опишите задачу и бюджет — преподаватели предложат свои условия. Бесплатно.</p><span className="link mt-4 inline-flex items-center gap-1">Разместить заявку <ArrowRight size={16} /></span></a>
          <a href="#/register?role=student" className="card card-hover"><h3 className="text-xl">Есть преподаватель</h3><p className="mt-2 text-ink-soft">Откройте ссылку-приглашение от него или зарегистрируйтесь и введите код.</p><span className="link mt-4 inline-flex items-center gap-1">Зарегистрироваться <ArrowRight size={16} /></span></a>
        </div>
      </Section>

      <Section title="Вопросы" center>
        <Faq items={[
          ["Сколько это стоит ученику?", "Ничего. Платформой платит преподаватель или школа."],
          ["Нужно ли что-то устанавливать?", "Нет, всё работает в браузере — и на телефоне тоже."],
          ["Как подключить родителя?", "Преподаватель даёт отдельную ссылку для родителя. По ней родитель создаёт свой кабинет и видит отчёты."],
        ]} />
      </Section>
    </>
  );
}
