import { ArrowRight, Search, Smartphone } from "lucide-react";
import { Faq, Phone, Section, Ticks } from "./parts.jsx";

export default function Study() {
  return (
    <>
      <section className="grid items-center gap-12 pb-4 pt-28 md:pt-36 lg:grid-cols-[1.15fr_1fr]">
        <div className="animate-fadeup">
          <p className="text-sm font-medium text-ink-mute">Ученикам и родителям</p>
          <h1 className="mt-4 text-[clamp(2.3rem,5.6vw,4rem)] leading-[1.04]">Учиться удобно, даже <span className="mark">в дороге</span></h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft md:text-xl">Урок с преподавателем, конспект, домашка и карточки новых слов в одном кабинете. С компьютера, с телефона или из приложения.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#/register?role=student" className="btn-brand btn-lg">Меня пригласил преподаватель</a>
            <a href="#/market/new" className="btn-light btn-lg"><Search size={18} />Найти преподавателя</a>
          </div>
          <p className="mt-4 text-sm text-ink-mute">Ученикам и родителям бесплатно. <a href="#/download" className="link font-medium"><Smartphone size={14} className="mr-1 inline align-[-2px]" />Скачать приложение</a></p>
        </div>
        <div className="flex items-end justify-center gap-4">
          <Phone src="/static/shot-phone-home.webp" alt="Главная ученика на телефоне" />
          <Phone src="/static/shot-phone-words.webp" alt="Карточки слов на телефоне" className="hidden translate-y-6 sm:block" />
        </div>
      </section>

      <Section label="Ученику" title="Всё, что задали, в одном месте">
        <div className="grid gap-x-10 gap-y-10 md:grid-cols-3">
          {[["Карточки, которые помнят за вас", "Слова с урока сами попадают в карточки. Трудные возвращаются чаще, выученные реже. Пара минут в день вместо зубрёжки перед уроком."],
            ["Конспект после каждого урока", "Правила с примерами, ваши ошибки с исправлениями, новые слова и короткий тест. Удобно повторить перед следующим занятием."],
            ["Голосовые преподавателю", "Не хочется печатать в дороге? Запишите голосовое. Преподаватель услышит его и увидит текст."]].map(([t, d]) => (
            <div key={t} className="border-t border-line pt-6"><h3 className="text-xl">{t}</h3><p className="mt-2 text-ink-soft">{d}</p></div>
          ))}
        </div>
      </Section>

      <section className="grid items-center gap-10 py-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <div className="flex justify-center gap-4 lg:order-2">
          <Phone src="/static/shot-phone-spark.webp" alt="Искорка проверяет слова" />
          <Phone src="/static/shot-phone-chat.webp" alt="Чат с преподавателем" className="hidden translate-y-6 sm:block" />
        </div>
        <div>
          <p className="text-sm font-medium text-ink-mute">Искорка</p>
          <h2 className="mt-2 text-[1.9rem] leading-[1.1] md:text-[2.4rem]">Помощница, которая не устаёт от вопросов</h2>
          <p className="mt-4 text-lg text-ink-soft">Попросите Искорку проверить слова, объяснить правило или придумать пример. Можно голосом.</p>
          <Ticks className="mt-6" items={["Отвечает внутри платформы, ничего ставить не нужно", "Знает ваши слова с уроков", "Подскажет, где найти домашку и конспект"]} />
        </div>
      </section>

      <Section label="Родителям" title="Видно, как ребёнок занимается">
        <div className="grid gap-x-10 gap-y-10 md:grid-cols-3">
          {[["Отчёт после каждого урока", "Что прошли, что получилось, над чем поработать и как помочь дома. Отчёт приходит на сайт, Telegram не нужен."],
            ["Связь без лишних номеров", "Напишите преподавателю прямо в кабинете. Если ребёнок учится в онлайн-школе, можно написать и в школу."],
            ["Домашка и слова под контролем", "Видно, какие задания выполнены и сколько слов уже выучено."]].map(([t, d]) => (
            <div key={t} className="border-t border-line pt-6"><h3 className="text-xl">{t}</h3><p className="mt-2 text-ink-soft">{d}</p></div>
          ))}
        </div>
      </Section>

      <Section label="Как начать" title="Есть преподаватель или ещё нет">
        <div className="grid gap-4 md:grid-cols-2">
          <a href="#/register?role=student" className="card card-hover md:!p-8"><h3 className="text-xl">Преподаватель уже есть</h3><p className="mt-2 text-ink-soft">Попросите у него ссылку-приглашение. Откройте её и зарегистрируйтесь за минуту, и вы сразу в общем кабинете.</p><span className="link mt-4 inline-flex items-center gap-1">Зарегистрироваться <ArrowRight size={16} /></span></a>
          <a href="#/market/new" className="card card-hover md:!p-8"><h3 className="text-xl">Преподавателя пока нет</h3><p className="mt-2 text-ink-soft">Расскажите, чего хотите добиться и какой у вас бюджет. Преподаватели откликнутся со своими условиями, а вы выберете подходящего.</p><span className="link mt-4 inline-flex items-center gap-1">Оставить заявку <ArrowRight size={16} /></span></a>
        </div>
      </Section>

      <Section label="Вопросы" title="Частые вопросы" center>
        <Faq items={[
          ["Это платно для ученика?", "Нет. Ученики и родители пользуются платформой бесплатно. Сами занятия вы оплачиваете преподавателю, как и раньше."],
          ["Нужно что-то устанавливать?", "Нет, всё работает в браузере. Если удобнее приложение, его можно поставить на странице «Приложение»."],
          ["Как родителю получать отчёты?", "Преподаватель даёт отдельную ссылку для родителя. Откройте её и зарегистрируйтесь, отчёты после уроков будут приходить в ваш кабинет."],
          ["Увидит ли преподаватель мой номер телефона?", "Нет. Преподаватель видит только имя. Общение идёт через платформу."],
          ["Можно ли добавить свои слова в карточки?", "Да. В разделе «Слова» можно добавить свои слова и убрать лишние."],
        ]} />
      </Section>
    </>
  );
}
