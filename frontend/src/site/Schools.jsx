import { useState } from "react";
import { useConfig } from "../lib/config.js";
import { PRICE, rub } from "../lib/pricing.js";
import { Faq, Section, Shot, Ticks } from "./parts.jsx";

const BLOCKS = [
  ["Ученики остаются в школе", ["Телефоны, ссылки и ники в чатах, речи на уроке и на доске скрываются", "Школа получает сигнал о попытке обменяться контактами", "Расшифровка урока помогает в спорных ситуациях"]],
  ["Всё видно в одном кабинете", ["Преподаватели и их ученики", "Уроки и конспекты каждого преподавателя", "Общие реквизиты и правила оплаты занятий"]],
  ["Команда работает в одном месте", ["Преподаватели подключаются по одной ссылке", "Общая база материалов и 43 готовых урока Bright", "Новые преподаватели сразу работают по вашим материалам"]],
  ["Родители довольны", ["Отчёт после каждого урока на понятном языке", "Пишут преподавателю или в школу прямо из кабинета", "Ученикам удобно с телефона и из приложения"]],
];

export default function Schools() {
  const cfg = useConfig();
  const [n, setN] = useState(5);
  return (
    <>
      <section className="pb-4 pt-28 md:pt-36">
        <div className="max-w-3xl animate-fadeup">
          <p className="text-sm font-medium text-ink-mute">Онлайн-школам от 2 до 30 преподавателей</p>
          <h1 className="mt-4 text-[clamp(2.3rem,5.6vw,4rem)] leading-[1.04]">Своя онлайн-школа без своей разработки</h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-soft md:text-xl">
            Уроки с доской, домашка, конспекты, оплаты и отчёты родителям уже готовы. Вы подключаете преподавателей и видите всё, что происходит в школе.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#/register?role=school&start=trial" className="btn-brand btn-lg">Подключить школу бесплатно</a>
            <a href={`mailto:${cfg.support_email}?subject=${encodeURIComponent("Переезд школы на Bright")}`} className="btn-light btn-lg">Обсудить переезд</a>
          </div>
          <p className="mt-4 text-sm text-ink-mute">{PRICE.trialDays} дня на всю команду бесплатно, без карты.</p>
        </div>
        <Shot src="/static/shot-today.webp" alt="Кабинет Bright: уроки, ученики и задачи на сегодня" className="mt-14" />
      </section>

      <Section label="Что получает школа" title="Меньше ручного контроля, больше уроков">
        <div className="grid gap-x-10 gap-y-12 md:grid-cols-2">
          {BLOCKS.map(([t, items]) => (
            <div key={t} className="border-t border-line pt-6">
              <h3 className="text-xl">{t}</h3>
              <Ticks items={items} className="mt-4" />
            </div>
          ))}
        </div>
      </Section>

      <Section label="Цена" title="Считается по преподавателям">
        <div className="grid items-center gap-8 rounded-3xl border border-line bg-white p-6 md:grid-cols-[1.2fr_1fr] md:p-10">
          <div>
            <label htmlFor="teachers" className="font-semibold">Преподавателей в школе: <span className="num">{n}</span></label>
            <input id="teachers" type="range" min="1" max="30" value={n} onChange={(e) => setN(Number(e.target.value))} className="mt-4 w-full accent-ink" />
            <p className="mt-4 text-ink-soft">Учеников и родителей сколько угодно, они пользуются бесплатно. Одна оплата за всех преподавателей, картой или через СБП.</p>
          </div>
          <div className="md:text-right">
            <p className="num text-5xl font-bold">{rub(n * PRICE.school)}</p>
            <p className="mt-1 text-sm text-ink-mute">в месяц, {PRICE.school} ₽ за преподавателя</p>
            <a href="#/register?role=school&start=trial" className="btn-brand btn-lg mt-6">Попробовать {PRICE.trialDays} дня</a>
          </div>
        </div>
      </Section>

      <Section label="Переезд" title="Поможем перенести школу">
        <div className="grid gap-6 md:grid-cols-3">
          {[["1", "Напишите нам", "Расскажите, где сейчас проходят уроки и сколько у вас преподавателей."],
            ["2", "Переносим материалы", "Загружаем ваши PDF, картинки и аудио, раскладываем по папкам."],
            ["3", "Подключаем команду", "Преподаватели заходят по ссылке, ученики по приглашению. Первые уроки проходят с нашей поддержкой."]].map(([k, t, d]) => (
            <div key={k}>
              <p className="num text-sm font-semibold text-ink-mute">{k}</p>
              <h3 className="mt-2 text-xl">{t}</h3>
              <p className="mt-2 text-ink-soft">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-ink-soft">Почта: <a className="link" href={`mailto:${cfg.support_email}`}>{cfg.support_email}</a>{cfg.bot && <> · Telegram: <a className="link" href={`https://t.me/${cfg.bot}`} target="_blank" rel="noreferrer">@{cfg.bot}</a></>}</p>
      </Section>

      <Section label="Вопросы" title="Вопросы школ" center>
        <Faq items={[
          ["Как подключить преподавателей?", "В кабинете школы есть ссылка-приглашение. Преподаватель открывает её, регистрируется и сразу работает по тарифу школы, сам он ничего не платит."],
          ["Видит ли школа уроки преподавателей?", "Да: уроки и конспекты каждого преподавателя, сообщения родителей школе и сигналы о попытках обменяться контактами."],
          ["Как работает защита от ухода учеников в личку?", "В чатах, расшифровке речи и на доске платформа находит телефоны, ссылки и ники мессенджеров, скрывает их и сообщает школе."],
          ["Что будет с данными, если мы уйдём?", "Материалы можно скачать файлами. Мы ничего не удерживаем."],
        ]} />
      </Section>
    </>
  );
}
