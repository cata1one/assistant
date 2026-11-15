import { Mail, Send, X } from "lucide-react";
import { useState } from "react";
import { request } from "../lib/api.js";
import { useConfig } from "../lib/config.js";
import { useSession } from "../lib/session.js";
import { ErrorBox, Notice } from "../ui/kit.jsx";
import Iskorka from "../app/Iskorka.jsx";
import { SparkPage } from "../app/spark.jsx";

// Быстрые ответы на то, о чём спрашивают чаще всего; роль берётся из кабинета, на сайте показываем общие
const QUICK = {
  tutor: [
    ["Как добавить ученика?", "Раздел «Ученики»: впишите имя, нажмите «Добавить» и отправьте ему ссылку. Ссылка для родителя лежит рядом."],
    ["Как начать урок?", "На странице «Ученики» или на главной нажмите «Начать урок». Ученик получит уведомление и зайдёт по кнопке."],
    ["Как создать упражнение?", "В разделе «Материалы» создайте занятие и выберите формат задания. Для пропусков заключите ответы в квадратные скобки: She [works] here."],
    ["Где разговорные комнаты?", "Откройте главное меню сайта и выберите «Разговорные комнаты». Там можно найти или создать комнату."],
    ["Как сделать, чтобы ученики платили вовремя?", "Откройте «Ученики» → «Оплата занятий»: укажите цену, реквизиты и когда напоминать. Всё необязательно, выключено по умолчанию."],
    ["Конспект ушёл ученику с ошибкой", "В профиле включите «Проверять конспект перед отправкой». Тогда он придёт ученику только после вашего подтверждения."],
  ],
  student: [
    ["Как зайти на урок?", "Когда преподаватель начнёт урок, на главной появится кнопка «Войти в урок». Разрешите браузеру камеру и микрофон."],
    ["Где домашнее задание?", "Раздел «Домашка». К письменной работе можно приложить фото тетради."],
    ["Где разговорные комнаты?", "Откройте главное меню сайта и выберите «Разговорные комнаты». Выберите язык и тему или создайте свою комнату."],
    ["Где мои слова?", "Раздел «Карточки». Слова с уроков и из домашки добавляются сами, лишние можно удалить."],
    ["Как оплатить занятие?", "Если преподаватель включил оплату через платформу, на главной будет блок «Оплата занятий» с реквизитами."],
  ],
  public: [
    ["Это бесплатно?", "Ученикам и родителям бесплатно. Преподавателю 3 дня бесплатно, потом 100 ₽ в месяц."],
    ["Нужно ли что-то устанавливать?", "Нет, всё работает в браузере, в том числе на телефоне."],
    ["Как попасть в разговорную комнату?", "Выберите «Разговорные комнаты» в меню. Для участия войдите как ученик или преподаватель."],
    ["Я забыл пароль", "На странице входа нажмите «Забыли пароль?» и введите почту: пришлёт ссылку для нового пароля."],
  ],
};

export default function Help({ inApp = false, immersive = false }) {
  const session = useSession();
  const cfg = useConfig();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("faq"); // faq | write | sent
  const [f, setF] = useState({ text: "", contact: "", kind: "help" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const role = session.role === "tutor" || session.role === "school" ? "tutor" : session.role ? "student" : "public";
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const send = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await request("POST", "/site/v1/support", { ...f, name: session.account?.name, page: window.location.hash.slice(0, 120) });
      setView("sent"); setF({ text: "", contact: "", kind: "help" });
    } catch (x) { setError(x); }
    setBusy(false);
  };

  return (
    <div className={`spark-helper fixed right-3 z-50 flex flex-col items-end md:right-5 ${immersive ? "spark-helper-immersive" : inApp ? "spark-helper-app" : "spark-helper-public"}`}>
      {open && (
        <div role="dialog" aria-label="Помощь Искорки" className={`panel absolute right-0 w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden shadow-lift ${immersive ? "top-16" : "bottom-16"}`}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2"><Iskorka size={36} still /><div><p className="text-base font-semibold">Искорка рядом</p><p className="text-xs text-ink-mute">Помогу с вопросами о Bright</p></div></div>
            <button type="button" className="btn-ghost !p-1.5" onClick={() => setOpen(false)} aria-label="Закрыть"><X size={16} /></button>
          </div>
          {view === "chat" && session.role ? <><SparkPage compact /><button type="button" className="w-full border-t border-line px-4 py-2 text-sm font-semibold text-brand" onClick={() => setView("faq")}>Вопросы о платформе и поддержка</button></> : <div className="max-h-[min(60dvh,32rem)] overflow-y-auto p-4">
            {view === "faq" && (
              <>
                {session.role ? <button type="button" className="btn-brand mb-4 w-full" onClick={() => setView("chat")}>Спросить Искорку</button>
                  : <div className="mb-4 rounded-2xl bg-brand-tint p-3 text-sm text-ink-soft">Могу подсказать, как устроен Bright. <a className="font-semibold text-brand underline" href="#/login" onClick={() => setOpen(false)}>Войдите</a>, чтобы написать мне в чате.</div>}
                <div className="grid gap-2">
                  {QUICK[role].map(([q, a]) => (
                    <details key={q} className="rounded-2xl border border-line px-3 py-2 text-sm">
                      <summary className="cursor-pointer font-semibold">{q}</summary>
                      <p className="mt-2 text-ink-soft">{a}</p>
                    </details>
                  ))}
                </div>
                <button type="button" className="btn-brand mt-4 w-full" onClick={() => setView("write")}><Mail size={16} /> Написать нам</button>
                {cfg.bot && <a className="btn-light mt-2 w-full" href={`https://t.me/${cfg.bot}`} target="_blank" rel="noreferrer"><Send size={16} /> Telegram</a>}
                <p className="mt-3 text-center text-xs text-ink-mute">Почта: {cfg.support_email}. Отвечаем в течение дня.</p>
              </>
            )}
            {view === "write" && (
              <form onSubmit={send} className="grid gap-3">
                <label className="label">О чём
                  <select className="field" value={f.kind} onChange={set("kind")}>
                    <option value="help">Вопрос</option><option value="bug">Что-то не работает</option><option value="payment">Оплата</option><option value="idea">Идея</option>
                  </select>
                </label>
                <label className="label">Опишите, что случилось
                  <textarea className="field min-h-24" required minLength={5} maxLength={3000} value={f.text} onChange={set("text")} placeholder="Что вы делали и что пошло не так" />
                </label>
                {!session.account && (
                  <label className="label">Куда ответить
                    <input className="field" required maxLength={120} value={f.contact} onChange={set("contact")} placeholder="Почта или @ник в Telegram" />
                  </label>
                )}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" onChange={set("website")} />
                <ErrorBox error={error} />
                <div className="flex gap-2">
                  <button type="submit" className="btn-brand flex-1" disabled={busy}>{busy ? "Отправляем…" : "Отправить"}</button>
                  <button type="button" className="btn-ghost" onClick={() => setView("faq")}>Назад</button>
                </div>
              </form>
            )}
            {view === "sent" && (
              <div className="grid gap-3">
                <Notice tone="ok">Сообщение отправлено. Ответим на почту{session.account ? ` ${session.account.email}` : ""}, обычно в течение дня.</Notice>
                <button type="button" className="btn-light" onClick={() => setView("faq")}>Хорошо</button>
              </div>
            )}
          </div>}
        </div>
      )}
      <button type="button" onClick={() => { setOpen(!open); if (!open) setView(session.role ? "chat" : "faq"); }} aria-expanded={open} aria-label={open ? "Закрыть помощь" : "Спросить Искорку"}
        className="spark-helper-button flex h-14 items-center gap-1 rounded-full border border-[#b7cdea] bg-[#06469e] pl-1 pr-4 text-sm font-semibold text-white shadow-lift transition hover:bg-[#053477]">
        {open ? <X className="mx-3" size={20} /> : <><Iskorka size={46} still /><span className="hidden sm:inline">Помогу!</span></>}
      </button>
    </div>
  );
}
