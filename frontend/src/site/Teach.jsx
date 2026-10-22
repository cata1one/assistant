import {
  ArrowRight, FileStack, Gift, Lock, NotebookPen, PenTool, Repeat, Search, Sparkles, Users, Video,
} from "lucide-react";
import { useState } from "react";
import { useSession } from "../lib/session.js";
import { copy } from "../ui/kit.jsx";
import { Faq, FeatureGrid, Marquee, PricingCards, ProductMock, Section } from "./parts.jsx";

export default function Teach() {
  const session = useSession();
  const ref = session?.account?.referral?.code;
  const [copied, setCopied] = useState(false);
  // У вошедшего преподавателя — личная ссылка: по ней начисляется скидка
  const share = () => { copy(ref ? `${window.location.origin}/#/register?role=tutor&ref=${ref}` : `${window.location.origin}/#/teach`); setCopied(true); };
  return (
    <>
      <section className="grid items-center gap-14 pb-14 pt-28 md:pt-36 lg:grid-cols-[1.05fr_1fr]">
        <div className="animate-fadeup">
          <span className="chip chip-brand">BetterTeach — для репетиторов</span>
          <h1 className="mt-5 text-[clamp(2.2rem,5.2vw,3.9rem)]">Возможности онлайн-школы —<br /><span className="text-brand">в руках одного преподавателя</span></h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">Видеоурок, доска, материалы, интерактивные задания и отчёты родителям — в одном кабинете. Занятия становятся сильнее, подготовка — быстрее, а стоит всё 300 ₽ в месяц: дешевле одного урока.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#/register?role=tutor" className="btn-brand btn-lg">Попробовать 3 дня бесплатно <ArrowRight size={18} /></a>
            <a href="#/pricing" className="btn-light btn-lg">Тарифы</a>
          </div>
          <p className="mt-4 text-sm text-ink-mute">Все функции сразу, без карты. Регистрация — минута.</p>
        </div>
        <ProductMock />
      </section>
      <Marquee />

      <Section eyebrow="Почему удобно" title="Уроки, которые приятно готовить и вести">
        <FeatureGrid items={[
          { icon: PenTool, title: "Доска лучше, чем просто доска", text: "Рисуйте пальцем или мышкой, добавляйте видео, фото и стикеры, обрезайте картинки прямо на доске — без демонстрации экрана.", tone: "teach" },
          { icon: FileStack, title: "Все материалы под рукой", text: "Загрузите учебники, карточки, аудио и презентации один раз — и кладите их на доску в два клика.", tone: "sun" },
          { icon: Video, title: "Урок в браузере", text: "Ученик заходит по кнопке из кабинета. Звонок и доску открываете только вы.", tone: "study" },
          { icon: NotebookPen, title: "Отчёты без рутины", text: "Конспект ученику, отчёт родителю, ДЗ и тест — автоматически по записи урока.", tone: "mint" },
          { icon: Repeat, title: "Ученики учат слова сами", text: "Слова с урока, из домашки и занятий сразу становятся карточками с интервальным повторением. Слова можно добавить и вручную.", tone: "study" },
          { icon: Sparkles, title: "Интерактивные занятия", text: "Вставка слов в текст, пары, тесты и аудирование — ответы проверяются сами. Готовые занятия для IELTS и HSK или своё — за пару минут.", tone: "lilac" },
        ]} />
      </Section>

      <Section eyebrow="Ваше и только ваше" title="Частный репетитор или школа — вы решаете">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <h3 className="flex items-center gap-2 text-xl"><Lock size={20} className="text-brand" />Частный репетитор</h3>
            <p className="mt-3 text-ink-soft">Ваши ученики — ваши. Переписка не фильтруется и никому не передаётся. Ученики и родители видят только ваше имя — не телефон и не аккаунты.</p>
          </div>
          <div className="card">
            <h3 className="flex items-center gap-2 text-xl"><Users size={20} className="text-brand" />Преподаватель школы</h3>
            <p className="mt-3 text-ink-soft">Школа приглашает вас по ссылке, даёт учеников и общую базу материалов. Запись урока защищает вас в спорных ситуациях с учеником.</p>
          </div>
        </div>
      </Section>

      <Section eyebrow="Ученики" title="Найдите новых учеников">
        <div className="card grid items-center gap-6 md:grid-cols-[1.4fr_1fr] md:!p-10">
          <div>
            <p className="text-lg text-ink-soft">В каталоге ученики описывают задачу: цель, уровень, возраст, бюджет. Вы откликаетесь со своей ценой — ученик выбирает и сразу попадает к вам в кабинет.</p>
          </div>
          <a href="#/market" className="btn-brand btn-lg"><Search size={18} />Смотреть заявки</a>
        </div>
      </Section>

      <Section eyebrow="Тарифы" title="Один тариф — и всё включено"><PricingCards /></Section>

      <Section title="Вопросы преподавателей" center>
        <Faq items={[
          ["Как перенести материалы с ProgressMe?", "Выгрузите свои материалы файлами и перетащите их в «Материалы» — можно сразу пачкой. Видео переносятся ссылками."],
          ["Может ли ученик сам начать звонок или открыть доску?", "Нет. Урок и доску открывает преподаватель; ученик заходит по кнопке, когда урок начался."],
          ["Нужен ли ученику Telegram?", "Нет, всё работает на сайте. Telegram можно привязать для уведомлений."],
          ["Что с записью урока?", "Запись нужна для конспекта и отчётов. Ученик видит предупреждение и соглашается перед входом."],
        ]} />
      </Section>

      <section className="pb-6">
        <div className="card flex flex-wrap items-center justify-between gap-5 md:!p-10">
          <div className="flex min-w-0 flex-1 items-center gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Gift size={26} /></span>
            <div><h3 className="text-xl">Приведите коллегу — получите скидку 50%</h3><p className="mt-1 text-sm text-ink-soft">Поделитесь ссылкой с теми, кто тоже устал переключаться между пятью программами. Когда коллега оформит тариф, ваше следующее продление обойдётся вдвое дешевле.</p></div></div>
          <button type="button" onClick={share} className="btn-light"><Sparkles size={16} />{copied ? "Ссылка скопирована" : ref ? "Скопировать мою ссылку" : "Скопировать ссылку"}</button>
        </div>
      </section>
    </>
  );
}
