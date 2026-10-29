import {
  ArrowLeft, ArrowUpRight, BookOpen, Building2, Check, ChevronRight, MessagesSquare, PenTool, Plus, Send, Star, Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fmtDate, request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { sendVoice } from "../lib/voice.js";
import { Avatar, Empty, ErrorBox, Loading, Notice, PageTitle, Tabs } from "../ui/kit.jsx";
import { DecorSettings } from "./decor.jsx";
import { PhotoSettings, ReviewSetting } from "./extras.jsx";
import VoiceButton from "./VoiceButton.jsx";

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
    <section className={`panel p-5 ${className}`}>
      {title && (
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-normal">{Icon && <Icon size={17} className="text-ink-mute" />}{title}</h2>
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

/** Идущий урок: самое важное на экране, поэтому тёмная плашка во всю ширину. */
export function LiveBanner({ lessons }) {
  const live = (lessons || []).filter((l) => l.status === "active");
  if (!live.length) return null;
  return (
    <div className="mb-4 grid gap-2">
      {live.map((l) => (
        <a key={l.id} href={`#/room/${l.id}`} className="flex items-center justify-between gap-3 rounded-3xl bg-ink px-5 py-4 text-white transition hover:bg-black">
          <span className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teach opacity-60" /><span className="relative h-3 w-3 rounded-full bg-teach" /></span>
            <span className="min-w-0"><span className="block font-semibold">Идёт урок{l.title && l.title !== "Урок" ? `: ${l.title}` : ""}</span>{l.with && <span className="block truncate text-sm text-white/60">{l.with}</span>}</span>
          </span>
          <span className="btn-accent btn-sm shrink-0">Войти</span>
        </a>
      ))}
    </div>
  );
}

export function LessonList({ lessons, empty = "Уроков пока нет. Конспекты появятся после первого занятия.", limit }) {
  const list = (lessons || []).slice(0, limit || undefined);
  if (!list.length) return <p className="py-2 text-sm text-ink-mute">{empty}</p>;
  return (
    <ul className="-mx-2 grid">
      {list.map((l) => {
        const href = l.status === "active" ? `#/room/${l.id}` : l.has_report ? `#/lesson/${l.id}` : null;
        const inner = (
          <>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cream text-center text-[11px] font-semibold leading-tight text-ink-soft">
              {new Date(l.started_at).toLocaleDateString("ru-RU", { day: "numeric" })}<br />{new Date(l.started_at).toLocaleDateString("ru-RU", { month: "short" }).replace(".", "")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{l.title}</span>
              <span className="block truncate text-[13px] text-ink-mute">{l.with || ""}{l.words ? ` · слов: ${l.words}` : ""}</span>
            </span>
            {l.status === "active" ? <span className="btn-accent btn-sm">Войти</span>
              : l.has_report ? <span className="hidden text-[13px] font-medium text-ink-soft sm:inline">{l.role === "parent" ? "Отчёт" : "Конспект"}</span>
                : <span className="chip">готовится</span>}
            {href && <ChevronRight size={16} className="shrink-0 text-ink-mute" />}
          </>
        );
        return (
          <li key={l.id}>
            {href ? <a href={href} className="flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-cream">{inner}</a>
              : <div className="flex items-center gap-3 px-2 py-2">{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export function LessonsHub({ route }) {
  const { me, role } = useSession();
  const [tab, setTab] = useState(route?.parts?.[1] === "boards" ? "boards" : "lessons");
  const titles = Object.fromEntries((me?.chats || []).map((c) => [c.chat_id, c.title]));
  const lessons = (me?.lessons || []).map((l) => ({ ...l, with: titles[l.chat_id] }));
  const parent = role === "parent";
  return (
    <>
      <PageTitle title={parent ? "Отчёты об уроках" : "Уроки"} text={parent ? "После каждого урока здесь появляется отчёт преподавателя." : null}
        actions={!parent && <Tabs label="Раздел" value={tab} onChange={setTab} items={[{ id: "lessons", title: "Уроки" }, { id: "boards", title: "Доски" }]} />} />
      {tab === "boards" && !parent ? <BoardsPage /> : (
        <>
          <LiveBanner lessons={lessons} />
          <div className="panel p-3"><LessonList lessons={lessons} /></div>
        </>
      )}
    </>
  );
}

export const LessonsPage = LessonsHub;

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
      <ErrorBox error={error} />
      {canCreate && chats.length > 0 && (
        <form onSubmit={create} className="panel mb-4 grid gap-2.5 p-4 md:grid-cols-[220px_1fr_auto]">
          <select className="field" aria-label="С кем доска" value={chat} onChange={(e) => setChat(e.target.value)}>
            {chats.map((c) => <option key={c.chat_id} value={c.chat_id}>{c.title}</option>)}
          </select>
          <input className="field" aria-label="Название" maxLength={80} placeholder="Название, например «Present Perfect»" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="submit" className="btn-brand !h-[46px]"><Plus size={16} /> Новая доска</button>
          {err && <div className="md:col-span-3"><ErrorBox error={err} /></div>}
        </form>
      )}
      {!data ? <Loading /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <a href="#/board" className="panel group flex flex-col p-4 transition hover:border-ink/25">
            <div className="board-viewport mb-3 grid h-24 place-items-center rounded-2xl border border-dashed border-line" style={{ backgroundSize: "14px 14px" }}><PenTool size={20} className="text-ink-mute" /></div>
            <p className="font-semibold">Личная доска</p><p className="text-[13px] text-ink-mute">Черновик, видна только вам</p>
          </a>
          {data.boards.map((b) => (
            <a key={b.id} href={`#/board?id=${b.id}`} className="panel flex flex-col p-4 transition hover:border-ink/25">
              <div className="board-viewport mb-3 h-24 rounded-2xl border border-line" style={{ backgroundSize: "14px 14px" }} />
              <p className="truncate font-semibold">{b.title}</p>
              <p className="text-[13px] text-ink-mute">с {b.with}</p>
            </a>
          ))}
          {!data.boards.length && <p className="self-center text-sm text-ink-mute sm:col-span-2">{canCreate ? "Доска урока создаётся сама, когда вы начинаете урок. Можно сделать и отдельную." : "Когда преподаватель откроет доску, она появится здесь."}</p>}
        </div>
      )}
    </>
  );
}

// == Сообщения ==============================================================================
const KIND = { student: "Ученик и преподаватель", parent: "Родитель и преподаватель", school: "Школа" };

export function MessagesPage() {
  const { data, error, reload } = useApi("/site/v1/chats");
  const [active, setActive] = useState(null);
  const chats = data?.chats || [];
  const wide = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
  useEffect(() => { if (!active && chats[0] && wide) setActive(chats[0].chat_id); }, [chats, active, wide]);
  const current = chats.find((c) => c.chat_id === active);
  return (
    <>
      <div className={active ? "hidden md:block" : ""}><PageTitle title="Сообщения" text="Переписка внутри платформы: можно писать и отправлять голосовые. Личные контакты собеседники не видят." /></div>
      <ErrorBox error={error} />
      {!data ? <Loading /> : !chats.length ? <Empty icon={MessagesSquare} title="Переписок пока нет" text="Они появятся, когда к вам подключится ученик, преподаватель или родитель." /> : (
        <div className="grid gap-4 md:grid-cols-[300px_1fr]">
          <ul className={`panel min-w-0 content-start gap-0.5 p-1.5 ${active ? "hidden md:grid" : "grid"}`}>
            {chats.map((c) => (
              <li key={c.chat_id} className="min-w-0">
                <button type="button" onClick={() => setActive(c.chat_id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition ${active === c.chat_id ? "bg-cream" : "hover:bg-cream/60"}`}>
                  {c.kind === "school" ? <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cream"><Building2 size={18} /></span> : <Avatar name={c.title} size={40} />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate font-semibold">{c.kind === "parent" && <Users size={13} className="text-ink-mute" />}{c.title}</span>
                    <span className="block truncate text-[13px] text-ink-mute">{c.last ? c.last.text : KIND[c.kind]}</span>
                  </span>
                  {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-md bg-ink px-1.5 text-[11px] font-semibold text-white">{c.unread}</span>}
                </button>
              </li>
            ))}
          </ul>
          {active && <Conversation key={active} chatId={active} title={current?.title} onBack={() => { setActive(null); reload(); }} />}
        </div>
      )}
    </>
  );
}

function Bubble({ m, mine }) {
  const [showText, setShowText] = useState(false);
  const voice = m.source === "voice";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] ${mine ? "rounded-br-md bg-ink text-white" : "rounded-bl-md bg-cream text-ink"} ${m.blocked ? "opacity-60" : ""}`}>
        {!mine && <span className="mb-0.5 block text-xs font-semibold text-ink-mute">{m.author}</span>}
        {voice && m.audio ? (
          <>
            <audio controls preload="none" src={m.audio} className="h-9 w-56 max-w-full" />
            <button type="button" onClick={() => setShowText(!showText)} className={`mt-1 block text-xs font-medium underline-offset-2 hover:underline ${mine ? "text-white/70" : "text-ink-mute"}`}>
              {showText ? "Скрыть текст" : "Показать текст"}
            </button>
            {showText && <span className="mt-1 block whitespace-pre-wrap text-sm">{m.text}</span>}
          </>
        ) : <span className="whitespace-pre-wrap">{m.text}</span>}
        <span className={`mt-0.5 block text-right text-[10.5px] ${mine ? "text-white/50" : "text-ink-mute"}`}>{shortDate(m.created_at)}{m.source === "telegram" ? " · Telegram" : ""}</span>
      </div>
    </div>
  );
}

function Conversation({ chatId, title, onBack }) {
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
  const after = (r) => setWarn(r.moderation.action === "block" ? `Сообщение не доставлено: ${r.moderation.summary}.` : r.moderation.warning || null);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      after(await request("POST", `/site/v1/chats/${encodeURIComponent(chatId)}/messages`, { text }));
      setText("");
      await pull();
    } catch (err) { setWarn(err.message); }
  };
  const voice = async (blob) => {
    setWarn(null);
    after(await sendVoice(`/site/v1/chats/${encodeURIComponent(chatId)}/voice`, blob));
    await pull();
  };
  return (
    <div className="panel flex h-[calc(100dvh-10.5rem)] min-h-[420px] flex-col md:h-[600px]">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <button type="button" onClick={onBack} className="btn-ghost !h-9 !w-9 !p-0 md:hidden" aria-label="К списку"><ArrowLeft size={18} /></button>
        <h3 className="truncate text-[15px] font-semibold">{data.with || title || "Переписка"}</h3>
      </div>
      <div ref={box} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {!data.messages.length && <p className="py-6 text-center text-sm text-ink-mute">Напишите первое сообщение или отправьте голосовое.</p>}
        {data.messages.map((m) => <Bubble key={m.id} m={m} mine={m.role === data.role} />)}
      </div>
      {warn && <Notice tone="warn" className="mx-3 mb-2">{warn}</Notice>}
      {data.can_write === false ? <p className="border-t border-line px-4 py-3 text-sm text-ink-mute">Школа видит переписку, но не пишет в неё.</p> : (
        <form onSubmit={send} className="relative flex items-center gap-2 border-t border-line p-2.5">
          <input className="field !h-10 !py-0" maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Сообщение" aria-label="Сообщение" />
          {text.trim() ? <button type="submit" className="btn-brand !h-10 !w-10 shrink-0 !p-0" aria-label="Отправить"><Send size={17} /></button>
            : <VoiceButton onSend={voice} />}
        </form>
      )}
    </div>
  );
}

// == Словарь ================================================================================
export function Flashcard({ w }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button type="button" onClick={() => setFlipped(!flipped)} aria-label={`${w.word} – ${flipped ? "показать слово" : "показать перевод"}`}
      className={`panel flex min-h-[104px] flex-col items-center justify-center p-4 text-center transition hover:border-ink/25 ${flipped ? "!bg-sun-soft" : ""}`}>
      <span className="font-display text-lg font-semibold">{flipped ? w.translation || "–" : w.word}</span>
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
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid content-start gap-4">
          {acc && <PhotoSettings />}
          {session.role === "student" && acc && <DecorSettings />}
          {session.role === "tutor" && acc && <ReviewSetting />}
          {acc ? (
            <form onSubmit={save} className="panel grid gap-4 p-5">
              <div><h2 className="text-[15px] font-semibold tracking-normal">Аккаунт</h2><p className="text-sm text-ink-mute">{acc.email}{acc.org ? ` · ${acc.org.name}` : ""}</p></div>
              <label className="label">Имя<input className="field" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></label>
              <p className="-mt-2 text-xs text-ink-mute">Другие участники видят только имя, без фамилии.</p>
              <label className="label">Новый пароль<input className="field" type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Оставьте пустым, чтобы не менять" /></label>
              {msg && <Notice tone="ok">{msg}</Notice>}
              <ErrorBox error={error} />
              <button type="submit" className="btn-brand w-fit"><Check size={16} /> Сохранить</button>
            </form>
          ) : <Notice>Вы вошли по ссылке из Telegram-бота. Чтобы входить по почте и паролю, зарегистрируйтесь на сайте.</Notice>}
        </div>
        <div className="grid content-start gap-4">
          <a href="#/download" className="panel flex items-center gap-4 p-5 transition hover:border-ink/25">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sun text-ink"><ArrowUpRight size={20} /></span>
            <span className="min-w-0"><span className="block font-semibold">Приложение Bright на телефон</span><span className="text-sm text-ink-mute">Уроки, домашка и сообщения в одно касание</span></span>
          </a>
          {acc && (
            <div className="panel p-5">
              <h2 className="text-[15px] font-semibold tracking-normal">Telegram</h2>
              <p className="mt-1 text-sm text-ink-mute">{acc.telegram ? "Привязан: уведомления дублируются в Telegram." : "Необязательно. Если привязать, уведомления будут приходить и туда."}</p>
              {tg?.link ? <a className="btn-brand mt-3" href={tg.link} target="_blank" rel="noopener">Открыть бота и привязать</a>
                : tg ? <Notice tone="warn" className="mt-3">Бот не настроен на сервере.</Notice>
                  : <button type="button" className="btn-light mt-3" onClick={linkTelegram}>{acc.telegram ? "Привязать другой аккаунт" : "Привязать Telegram"}</button>}
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

const FEEDBACK = [["idea", "Идея"], ["bug", "Что-то не работает"], ["praise", "Спасибо"], ["other", "Другое"]];

/** Обратная связь команде платформы: идеи, ошибки, пожелания. */
function FeedbackForm() {
  const [kind, setKind] = useState("idea");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const send = async (e) => {
    e.preventDefault(); setError(null);
    try { await request("POST", "/site/v1/feedback", { kind, text }); setText(""); setMsg("Спасибо! Прочитаем и ответим на почту, если нужно."); } catch (x) { setError(x); }
  };
  return (
    <form id="feedback" onSubmit={send} className="panel grid gap-3 p-5">
      <h2 className="text-[15px] font-semibold tracking-normal">Написать команде Bright</h2>
      <div className="flex flex-wrap gap-1.5">{FEEDBACK.map(([k, t]) => <button key={k} type="button" onClick={() => setKind(k)} className={`chip !px-2.5 !py-1 !text-[13px] ${kind === k ? "!bg-ink !text-white" : ""}`}>{t}</button>)}</div>
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
    <form onSubmit={submit} className="panel grid gap-3 p-5">
      <h2 className="text-[15px] font-semibold tracking-normal">Отзыв о платформе</h2>
      <div className="flex gap-1" role="radiogroup" aria-label="Оценка">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onClick={() => setF({ ...f, rating: i })} aria-label={`${i} из 5`} aria-pressed={f.rating === i}>
            <Star size={22} className={i <= f.rating ? "fill-sun text-sun" : "text-line"} />
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
  return <Empty icon={BookOpen} title="Вы пока ни к кому не подключены" text="Откройте ссылку-приглашение от преподавателя или школы, и всё появится здесь." action={<a href="#/market" className="btn-light">Найти преподавателя</a>} />;
}
