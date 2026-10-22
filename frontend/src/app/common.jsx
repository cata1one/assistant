import {
  ArrowUpRight, BookOpen, Building2, Check, MessagesSquare, PenTool, Plus, Send, Star, Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fmtDate, request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { Empty, ErrorBox, Loading, Notice, PageTitle } from "../ui/kit.jsx";
import { DecorSettings } from "./decor.jsx";

/** Загрузка данных с сервера: { data, error, reload }. */
export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = () => request("GET", path).then((d) => { setData(d); setError(null); }).catch(setError);
  useEffect(() => { if (path) load(); }, [path, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, reload: load };
}

export function Panel({ title, icon: Icon, children, className = "", actions }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2.5 text-lg">{Icon && <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-soft text-brand"><Icon size={16} /></span>}{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export const shortDate = (iso) => {
  try { return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
};

// == Уроки ==================================================================================
export function startLesson(chatId, title) {
  return request("POST", "/site/v1/rooms", { chat_id: chatId, title: title || null })
    .then((r) => { window.location.hash = `#/room/${r.lesson_id}`; });
}

export function LiveBanner({ lessons }) {
  const live = (lessons || []).filter((l) => l.status === "active");
  if (!live.length) return null;
  return (
    <div className="grid gap-2">
      {live.map((l) => (
        <a key={l.id} href={`#/room/${l.id}`} className="flex items-center justify-between gap-3 rounded-3xl bg-teach px-5 py-4 font-bold text-white shadow-teach-glow transition hover:brightness-105">
          <span className="flex items-center gap-3"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />Идёт урок{l.title && l.title !== "Урок" ? `: ${l.title}` : ""}</span>
          <span className="flex items-center gap-1.5">Войти <ArrowUpRight size={16} /></span>
        </a>
      ))}
    </div>
  );
}

export function LessonList({ lessons, empty = "Уроков пока нет. Материалы появятся после первого занятия.", limit }) {
  const list = (lessons || []).slice(0, limit || undefined);
  if (!list.length) return <p className="text-sm text-ink-mute">{empty}</p>;
  return (
    <ul className="grid gap-2">
      {list.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3">
          <span className="min-w-0">
            <span className="block truncate font-semibold">{l.title}</span>
            <span className="text-xs text-ink-mute">{fmtDate(l.started_at)}{l.with ? ` · ${l.with}` : ""}{l.words ? ` · новых слов: ${l.words}` : ""}</span>
          </span>
          {l.status === "active" ? <a className="btn-brand btn-sm" href={`#/room/${l.id}`}>Войти в урок</a>
            : l.has_report ? <a className="btn-light btn-sm" href={`#/lesson/${l.id}`}>{l.role === "parent" ? "Отчёт" : "Конспект"} <ArrowUpRight size={14} /></a>
              : <span className="chip">готовится</span>}
        </li>
      ))}
    </ul>
  );
}

export function LessonsPage({ title = "Уроки", text }) {
  const { me } = useSession();
  const titles = Object.fromEntries((me?.chats || []).map((c) => [c.chat_id, c.title]));
  const lessons = (me?.lessons || []).map((l) => ({ ...l, with: titles[l.chat_id] }));
  return (
    <>
      <PageTitle title={title} text={text} />
      <LiveBanner lessons={lessons} />
      <div className="mt-4"><LessonList lessons={lessons} /></div>
    </>
  );
}

// == Доски ==================================================================================
export function BoardsPage() {
  const { role } = useSession();
  const { data, error } = useApi("/site/v1/boards");
  const [chat, setChat] = useState("");
  const [title, setTitle] = useState("");
  const [err, setErr] = useState(null);
  const canCreate = role === "tutor" || role === "admin";
  const chats = (data?.chats || []).filter((c) => c.role === "tutor" || c.role === "admin");
  const create = async (e) => {
    e.preventDefault();
    try {
      const b = await request("POST", "/site/v1/boards", { chat_id: chat || chats[0]?.chat_id, title });
      window.location.hash = `#/board?id=${b.id}`;
    } catch (x) { setErr(x); }
  };
  return (
    <>
      <PageTitle title="Доски" text={canCreate ? "Общие доски с учениками: заметки, стикеры, материалы и видео. Доска урока создаётся сама." : "Доски, которые открыл преподаватель."}
        actions={<a href="#/board" className="btn-light">Личная доска</a>} />
      <ErrorBox error={error} />
      {canCreate && chats.length > 0 && (
        <form onSubmit={create} className="card mb-4 grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
          <select className="field" aria-label="С кем доска" value={chat} onChange={(e) => setChat(e.target.value)}>
            {chats.map((c) => <option key={c.chat_id} value={c.chat_id}>{c.title}</option>)}
          </select>
          <input className="field" aria-label="Название" maxLength={80} placeholder="Название, например «Present Perfect»" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="submit" className="btn-brand"><Plus size={16} /> Новая доска</button>
          {err && <div className="md:col-span-3"><ErrorBox error={err} /></div>}
        </form>
      )}
      {!data ? <Loading /> : !data.boards.length ? <Empty icon={PenTool} title="Досок пока нет" text={canCreate ? "Создайте доску для ученика или начните урок — доска появится автоматически." : "Когда преподаватель откроет доску, она появится здесь."} /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.boards.map((b) => (
            <a key={b.id} href={`#/board?id=${b.id}`} className="card card-hover !p-5">
              <div className="board-viewport mb-4 h-24 rounded-2xl border border-line" style={{ backgroundSize: "14px 14px" }} />
              <p className="font-bold">{b.title}</p>
              <p className="text-sm text-ink-mute">с {b.with}</p>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

// == Сообщения ==============================================================================
const KIND = { student: "Ученик и преподаватель", parent: "Родитель и преподаватель", school: "Школа" };

export function MessagesPage() {
  const { data, error } = useApi("/site/v1/chats");
  const [active, setActive] = useState(null);
  const chats = data?.chats || [];
  useEffect(() => { if (!active && chats[0]) setActive(chats[0].chat_id); }, [chats, active]);
  return (
    <>
      <PageTitle title="Сообщения" text="Переписка идёт через платформу — личные контакты собеседники не видят." />
      <ErrorBox error={error} />
      {!data ? <Loading /> : !chats.length ? <Empty icon={MessagesSquare} title="Переписок пока нет" text="Они появятся, когда к вам подключится ученик, преподаватель или родитель." /> : (
        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <ul className="card grid min-w-0 content-start gap-1 !p-2">
            {chats.map((c) => (
              <li key={c.chat_id} className="min-w-0">
                <button type="button" onClick={() => setActive(c.chat_id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left transition ${active === c.chat_id ? "bg-brand-tint" : "hover:bg-cream"}`}>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate font-semibold">{c.kind === "school" ? <Building2 size={14} /> : c.kind === "parent" ? <Users size={14} /> : null}{c.title}</span>
                    <span className="block truncate text-xs text-ink-mute">{c.last ? c.last.text : KIND[c.kind]}</span>
                  </span>
                  {c.unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-brand px-1.5 text-xs font-bold text-white">{c.unread}</span>}
                </button>
              </li>
            ))}
          </ul>
          {active && <Conversation key={active} chatId={active} />}
        </div>
      )}
    </>
  );
}

function Conversation({ chatId }) {
  const [data, setData] = useState({ messages: [] });
  const [text, setText] = useState("");
  const [warn, setWarn] = useState(null);
  const box = useRef(null);
  const last = useRef(0);
  const pull = async () => {
    const d = await request("GET", `/site/v1/chats/${encodeURIComponent(chatId)}/messages?since=${last.current}`);
    if (d.messages.length) last.current = d.messages[d.messages.length - 1].id;
    setData((old) => ({ ...d, messages: [...old.messages, ...d.messages.filter((m) => !old.messages.some((o) => o.id === m.id))] }));
  };
  useEffect(() => {
    let stop = false;
    const tick = () => { if (!stop && document.visibilityState !== "hidden") pull().catch(() => {}); };
    tick();
    const t = setInterval(tick, 4000);
    return () => { stop = true; clearInterval(t); };
  }, [chatId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [data.messages.length]);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const r = await request("POST", `/site/v1/chats/${encodeURIComponent(chatId)}/messages`, { text });
      setWarn(r.moderation.action === "block" ? `Сообщение не доставлено: ${r.moderation.summary}.` : r.moderation.warning || null);
      setText("");
      await pull();
    } catch (err) { setWarn(err.message); }
  };
  return (
    <div className="card flex min-h-[480px] flex-col !p-4 md:!p-5">
      <h3 className="mb-3 text-lg">{data.with || "Переписка"}</h3>
      <div ref={box} className="flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 460 }}>
        {!data.messages.length && <p className="text-sm text-ink-mute">Напишите первое сообщение.</p>}
        {data.messages.map((m) => {
          const mine = m.role === data.role;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-brand text-white" : "bg-cream text-ink"} ${m.blocked ? "opacity-60" : ""}`}>
                {!mine && <span className="mb-0.5 block text-xs font-bold text-brand">{m.author}</span>}
                <span className="whitespace-pre-wrap">{m.text}</span>
                <span className={`mt-1 block text-right text-[10px] ${mine ? "text-white/70" : "text-ink-mute"}`}>{shortDate(m.created_at)}{m.source === "telegram" ? " · Telegram" : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
      {warn && <Notice tone="warn" className="mt-3">{warn}</Notice>}
      {data.can_write === false ? <p className="mt-3 text-sm text-ink-mute">Школа видит переписку, но не пишет в неё.</p> : (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input className="field" maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Сообщение…" aria-label="Сообщение" />
          <button type="submit" className="btn-brand !px-4" aria-label="Отправить"><Send size={16} /></button>
        </form>
      )}
    </div>
  );
}

// == Словарь ================================================================================
export function Flashcard({ w }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button type="button" onClick={() => setFlipped(!flipped)} aria-label={`${w.word} — ${flipped ? "показать слово" : "показать перевод"}`}
      className={`card card-hover flex min-h-[110px] flex-col items-center justify-center !p-4 text-center ${flipped ? "!bg-brand-tint" : ""}`}>
      <span className="font-display text-lg font-extrabold">{flipped ? w.translation || "—" : w.word}</span>
      {!flipped && w.transcription && <span className="mt-1 text-sm text-ink-mute">{w.transcription}</span>}
      {flipped && w.example && <span className="mt-1 text-xs text-ink-mute">{w.example}</span>}
    </button>
  );
}

// == Профиль ================================================================================
export function ProfilePage() {
  const session = useSession();
  const acc = session.account;
  const [name, setName] = useState(acc?.name || "");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [tg, setTg] = useState(null);
  const save = async (e) => {
    e.preventDefault(); setError(null); setMsg(null);
    try {
      await request("POST", "/site/v1/account", { name, ...(password ? { password } : {}) });
      setPassword(""); setMsg("Сохранено"); session.reload();
    } catch (x) { setError(x); }
  };
  const linkTelegram = async () => {
    try { setTg(await request("POST", "/site/v1/account/telegram", {})); } catch (x) { setError(x); }
  };
  return (
    <>
      <PageTitle title="Профиль" />
      {session.role === "student" && acc && <div className="mb-4"><DecorSettings /></div>}
      <div className="grid gap-4 lg:grid-cols-2">
        {acc ? (
          <form onSubmit={save} className="card grid gap-4">
            <h2 className="text-lg">Аккаунт</h2>
            <p className="text-sm text-ink-mute">{acc.email}{acc.org ? ` · ${acc.org.name}` : ""}</p>
            <label className="label">Имя<input className="field" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <p className="-mt-2 text-xs text-ink-mute">Другие участники видят только имя, без фамилии.</p>
            <label className="label">Новый пароль<input className="field" type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Оставьте пустым, чтобы не менять" /></label>
            {msg && <Notice tone="ok">{msg}</Notice>}
            <ErrorBox error={error} />
            <button type="submit" className="btn-brand w-fit"><Check size={16} /> Сохранить</button>
          </form>
        ) : <Notice>Вы вошли по ссылке из Telegram-бота. Чтобы входить по почте и паролю, зарегистрируйтесь на сайте.</Notice>}
        <div className="grid content-start gap-4">
          {acc && (
            <div className="card">
              <h2 className="text-lg">Telegram</h2>
              <p className="mt-1 text-sm text-ink-soft">{acc.telegram ? "Привязан: уведомления, отчёты и сообщения дублируются в Telegram." : "Необязательно. Если привязать, уведомления будут приходить и туда."}</p>
              {tg?.link ? <a className="btn-brand mt-4" href={tg.link} target="_blank" rel="noopener">Открыть бота и привязать</a>
                : tg ? <Notice tone="warn" className="mt-4">Бот не настроен на сервере.</Notice>
                  : <button type="button" className="btn-light mt-4" onClick={linkTelegram}>{acc.telegram ? "Привязать другой аккаунт" : "Привязать Telegram"}</button>}
            </div>
          )}
          <FeedbackForm />
          {session.role !== "school" && <ReviewForm />}
          <button type="button" className="btn-ghost w-fit" onClick={() => { session.logout(); window.location.hash = "#/"; }}>Выйти на всех устройствах</button>
        </div>
      </div>
    </>
  );
}

const FEEDBACK = [["idea", "💡 Идея"], ["bug", "🐞 Что-то не работает"], ["praise", "❤️ Спасибо"], ["other", "✉️ Другое"]];

/** Обратная связь команде платформы: идеи, ошибки, пожелания. */
function FeedbackForm() {
  const [kind, setKind] = useState("idea");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const send = async (e) => {
    e.preventDefault(); setError(null);
    try { await request("POST", "/site/v1/feedback", { kind, text }); setText(""); setMsg("Спасибо! Мы прочитаем и ответим на почту, если нужно."); } catch (x) { setError(x); }
  };
  return (
    <form id="feedback" onSubmit={send} className="card grid gap-3">
      <h2 className="text-lg">Обратная связь</h2>
      <p className="-mt-1 text-sm text-ink-mute">Предложите идею или расскажите, что неудобно, — мы читаем каждое сообщение.</p>
      <div className="flex flex-wrap gap-1.5">{FEEDBACK.map(([k, t]) => <button key={k} type="button" onClick={() => setKind(k)} className={`chip !text-sm ${kind === k ? "chip-brand" : ""}`}>{t}</button>)}</div>
      <textarea className="field min-h-[90px]" required minLength={5} maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "bug" ? "Что делали, что произошло, с телефона или компьютера" : "Ваше сообщение"} aria-label="Сообщение" />
      {msg && <Notice tone="ok">{msg}</Notice>}
      <ErrorBox error={error} />
      <button type="submit" className="btn-light w-fit">Отправить</button>
    </form>
  );
}

function ReviewForm() {
  const [f, setF] = useState({ rating: 5, text: "", author_name: "" });
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setError(null);
    try {
      await request("POST", "/site/v1/reviews", f);
      setMsg("Спасибо! Отзыв появится после проверки."); setF({ ...f, text: "" });
    } catch (x) { setError(x); }
  };
  return (
    <form onSubmit={submit} className="card grid gap-3">
      <h2 className="text-lg">Отзыв о платформе</h2>
      <div className="flex gap-1" role="radiogroup" aria-label="Оценка">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onClick={() => setF({ ...f, rating: i })} aria-label={`${i} из 5`} aria-pressed={f.rating === i}>
            <Star size={24} className={i <= f.rating ? "fill-sun text-sun" : "text-line"} />
          </button>
        ))}
      </div>
      <input className="field" required maxLength={60} value={f.author_name} onChange={(e) => setF({ ...f, author_name: e.target.value })} placeholder="Как подписать: «Ольга, мама Миши»" aria-label="Подпись" />
      <textarea className="field min-h-[90px]" required minLength={20} maxLength={1500} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Что понравилось, что улучшить" aria-label="Отзыв" />
      {msg && <Notice tone="ok">{msg}</Notice>}
      <ErrorBox error={error} />
      <button type="submit" className="btn-light w-fit">Отправить</button>
    </form>
  );
}

// == Пустой кабинет (вошли из бота, но ни к кому не подключены) =================================
export function NotConnected() {
  return <Empty icon={BookOpen} title="Вы пока ни к кому не подключены" text="Откройте ссылку-приглашение от преподавателя или школы — и всё появится здесь." />;
}
