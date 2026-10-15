import { ArrowUpRight, BookOpen, CheckCircle2, NotebookPen, Send, Sparkles, Star, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Stars } from "../components/Reviews.jsx";
import { Bullets, ErrorBox, Loading, Notice } from "../components/ui.jsx";
import { fmtDate, request } from "../lib/api.js";
import { useCatalog } from "../lib/catalog.js";

// == Сообщения: переписка пары вне урока (та же история, что и в Telegram-боте) ==========
export function Messages() {
  const [chats, setChats] = useState(null);
  const [active, setActive] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    request("GET", "/site/v1/chats").then((d) => { setChats(d.chats); if (d.chats[0]) setActive(d.chats[0].chat_id); }).catch(setError);
  }, []);
  if (error) return <ErrorBox error={error} />;
  if (!chats) return <Loading />;
  if (!chats.length) return <p>Переписка появится, когда вас подключат к преподавателю или ученику.</p>;
  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <ul className="card grid min-w-0 content-start gap-1 !p-2">
        {chats.map((c) => (
          <li key={c.chat_id} className="min-w-0">
            <button type="button" onClick={() => setActive(c.chat_id)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-300 ${active === c.chat_id ? "bg-white/10" : "hover:bg-white/5"}`}>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-white">{c.title}</span>
                <span className="block truncate text-xs text-zinc-500">{c.last ? c.last.text : "нет сообщений"}</span>
              </span>
              {c.unread > 0 && <span className="num-badge h-6 min-w-6 px-1.5 text-xs">{c.unread}</span>}
            </button>
          </li>
        ))}
      </ul>
      {active && <Conversation key={active} chatId={active} />}
    </div>
  );
}

function Conversation({ chatId }) {
  const [data, setData] = useState({ messages: [] });
  const [text, setText] = useState("");
  const [warn, setWarn] = useState(null);
  const box = useRef(null);
  const last = useRef(0);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const d = await request("GET", `/site/v1/chats/${encodeURIComponent(chatId)}/messages?since=${last.current}`);
        if (stop) return;
        if (d.messages.length) last.current = d.messages[d.messages.length - 1].id;
        setData((old) => ({ ...d, messages: [...old.messages, ...d.messages.filter((m) => !old.messages.some((o) => o.id === m.id))] }));
      } catch { /* повторим */ }
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => { stop = true; clearInterval(t); };
  }, [chatId]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [data.messages.length]);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const r = await request("POST", `/site/v1/chats/${encodeURIComponent(chatId)}/messages`, { text });
      setWarn(r.moderation.action === "block" ? `Сообщение не доставлено: ${r.moderation.summary}. Нарушение передано администратору.`
        : r.moderation.warning || null);
      setText("");
      const d = await request("GET", `/site/v1/chats/${encodeURIComponent(chatId)}/messages?since=${last.current}`);
      if (d.messages.length) last.current = d.messages[d.messages.length - 1].id;
      setData((old) => ({ ...old, messages: [...old.messages, ...d.messages.filter((m) => !old.messages.some((o) => o.id === m.id))] }));
    } catch (err) { setWarn(err.message); }
  };
  return (
    <div className="card flex min-h-[480px] flex-col !p-4 md:!p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xl">{data.with || "Переписка"}</h3>
        <span className="text-xs text-zinc-500">Сообщения дублируются в Telegram</span>
      </div>
      <div ref={box} data-lenis-prevent className="flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 460 }}>
        {!data.messages.length && <p className="text-sm text-zinc-500">Напишите первое сообщение — оно придёт собеседнику и в Telegram.</p>}
        {data.messages.map((m) => {
          const mine = m.role === data.role;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-violet/80 text-white" : "bg-white/[.07] text-zinc-100"} ${m.blocked ? "opacity-60" : ""}`}>
                {!mine && <span className="mb-0.5 block text-xs font-semibold text-emerald-soft">{m.author}</span>}
                {m.text}
                <span className="mt-1 block text-right text-[10px] text-white/50">{new Date(m.created_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{m.source === "telegram" ? " · Telegram" : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
      {warn && <div className="mt-3"><Notice tone="warn">{warn}</Notice></div>}
      <form onSubmit={send} className="mt-3 flex gap-2">
        <input className="field" maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Сообщение…" aria-label="Сообщение" />
        <button type="submit" className="btn-primary !px-4" aria-label="Отправить"><Send size={16} /></button>
      </form>
      <p className="mt-2 text-[11px] text-zinc-600">Обмен личными контактами запрещён и автоматически блокируется.</p>
    </div>
  );
}

// == Кабинет родителя ======================================================================
export function ParentOverview() {
  const [data, setData] = useState(null);
  useEffect(() => { request("GET", "/site/v1/parent").then(setData).catch(() => setData({ children: [] })); }, []);
  if (!data?.children.length) return null;
  return (
    <div className="grid gap-4">
      {data.children.map((c) => (
        <div key={c.chat_id} className="card relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald/20 blur-3xl" />
          <div className="relative">
            <p className="eyebrow">Кабинет родителя</p>
            <h2 className="mt-2 text-4xl">{c.name}</h2>
            <div className="mt-6 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[.03]">
              {[[c.lessons, "уроков"], [c.words, "слов в словаре"], [c.last ? new Date(c.last.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—", "последний урок"]].map(([n, t]) => (
                <div key={t} className="flex flex-col items-center justify-center px-2 py-5 text-center">
                  <span className="stat-num text-2xl md:text-3xl">{n}</span><span className="mt-2 text-xs text-zinc-500">{t}</span>
                </div>
              ))}
            </div>
            {c.last ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-lg"><BookOpen size={16} /> {c.last.topic || "Последний урок"}</h3>
                  <p className="text-sm text-zinc-300">{c.last.summary}</p>
                  {c.last.achievements.length > 0 && <div className="mt-3"><h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-emerald-soft"><Sparkles size={14} /> Успехи</h4><Bullets items={c.last.achievements} /></div>}
                </div>
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-lg"><NotebookPen size={16} /> Домашнее задание</h3>
                  {c.last.homework.length ? <Bullets items={c.last.homework} /> : <p className="text-sm">Не задано.</p>}
                  {c.last.attention.length > 0 && <div className="mt-3"><h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-200"><TriangleAlert size={14} /> Обратить внимание</h4><Bullets items={c.last.attention} /></div>}
                </div>
                <a className="btn-primary btn-sm w-fit" href={`#/lesson/${c.last.lesson_id}`}>Полный отчёт <ArrowUpRight size={14} /></a>
              </div>
            ) : <p className="mt-6">Отчёты появятся после первого урока — и придут вам в Telegram.</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// == Отзыв о школе ======================================================================
export function ReviewForm() {
  const catalog = useCatalog();
  const [f, setF] = useState({ rating: 5, text: "", author_name: "", course_id: "", audience: "adult" });
  const [mine, setMine] = useState([]);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const load = () => request("GET", "/site/v1/reviews/mine").then((d) => setMine(d.reviews)).catch(() => {});
  useEffect(() => { load(); }, []);
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await request("POST", "/site/v1/reviews", { ...f, course_id: f.course_id || null });
      setMsg("Спасибо! Отзыв появится на сайте после проверки администратором.");
      setF({ ...f, text: "" }); load();
    } catch (err) { setError(err); }
  };
  const STATUS = { pending: "на проверке", approved: "опубликован", rejected: "отклонён" };
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <form onSubmit={submit} className="card grid gap-4">
        <h3 className="text-2xl">Оставить отзыв о школе</h3>
        {msg && <Notice tone="ok">{msg}</Notice>}
        {error && <ErrorBox error={error} />}
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Оценка">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setF({ ...f, rating: i })} aria-label={`${i} из 5`} aria-pressed={f.rating === i}
              className="transition-transform duration-200 hover:scale-110">
              <Star size={28} className={i <= f.rating ? "fill-amber-300 text-amber-300" : "text-zinc-600"} />
            </button>
          ))}
        </div>
        <label className="label">Как подписать отзыв<input className="field" required maxLength={60} value={f.author_name} onChange={(e) => setF({ ...f, author_name: e.target.value })} placeholder="Например: Ольга, мама Миши, 10 лет" /></label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="label">Направление
            <select className="field" value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })}>
              <option value="">Не указывать</option>
              {catalog.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <label className="label">Кто учится
            <select className="field" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
              <option value="adult">Взрослый</option><option value="kid">Ребёнок или подросток</option>
            </select>
          </label>
        </div>
        <label className="label">Отзыв<textarea className="field min-h-[140px]" required maxLength={1500} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Что было до занятий, что изменилось, что понравилось" /></label>
        <button type="submit" className="btn-primary w-fit">Отправить отзыв</button>
      </form>
      <div className="card">
        <h3 className="text-xl">Мои отзывы</h3>
        {!mine.length ? <p className="mt-3 text-sm">Вы ещё не оставляли отзывов.</p> : (
          <ul className="mt-4 grid gap-3">
            {mine.map((r) => (
              <li key={r.id} className="rounded-2xl border border-white/5 bg-white/[.03] p-4">
                <div className="flex items-center justify-between"><Stars value={r.rating} size={13} /><span className="chip">{STATUS[r.status]}</span></div>
                <p className="mt-2 line-clamp-3 text-sm">{r.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// == Анкета преподавателя ===============================================================
export function TeacherProfile() {
  const [data, setData] = useState(null);
  const [f, setF] = useState({ name: "", bio: "", languages: "", specialties: "", rate: "" });
  const [mine, setMine] = useState([]);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    request("GET", "/site/v1/teacher").then((d) => {
      setData(d);
      if (d.profile) setF({ name: d.profile.name || "", bio: d.profile.bio || "", languages: d.profile.languages || "", specialties: d.profile.specialties || "", rate: d.profile.rate || "" });
    }).catch(setError);
    request("GET", "/site/v1/market-mine").then((d) => setMine(d.proposals)).catch(() => {});
  }, []);
  const save = async (e) => {
    e.preventDefault(); setError(null);
    try {
      const d = await request("POST", "/site/v1/teacher", { ...f, rate: f.rate ? Number(f.rate) : null });
      setData(d); setMsg(d.status === "approved" ? "Анкета сохранена." : "Анкета отправлена на проверку — школа сообщит в Telegram.");
    } catch (err) { setError(err); }
  };
  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  const STATUS = { approved: "проверен школой", pending: "на проверке", rejected: "отклонён" };
  const P = { sent: "отправлен", accepted: "вас выбрали 🎉", declined: "выбран другой" };
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <form onSubmit={save} className="card grid gap-4">
        <div className="flex items-center justify-between gap-3"><h3 className="text-2xl">Анкета для биржи</h3>{data.status && <span className="chip chip-accent">{STATUS[data.status]}</span>}</div>
        {msg && <Notice tone="ok">{msg}</Notice>}
        {error && <ErrorBox error={error} />}
        <label className="label">Имя для учеников<input className="field" required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="label">О себе<textarea className="field min-h-[110px]" maxLength={1200} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Образование, опыт, сертификаты — без контактов" /></label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="label">Языки<input className="field" maxLength={100} value={f.languages} onChange={(e) => setF({ ...f, languages: e.target.value })} placeholder="английский, китайский" /></label>
          <label className="label">Ставка, ₽ за урок<input className="field num" type="number" min={300} max={20000} value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></label>
        </div>
        <label className="label">Специализация<input className="field" maxLength={300} value={f.specialties} onChange={(e) => setF({ ...f, specialties: e.target.value })} placeholder="IELTS, IT English, дети 7–12 лет" /></label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary">Сохранить</button>
          <a href="#/market" className="link text-sm">Открыть биржу →</a>
        </div>
        <p className="text-xs text-zinc-500">Комиссия школы — {data.fee_percent}% с оплаченных уроков учеников с биржи.</p>
      </form>
      <div className="card">
        <h3 className="text-xl">Мои отклики</h3>
        {!mine.length ? <p className="mt-3 text-sm">Откликов пока нет.</p> : (
          <ul className="mt-4 grid gap-3">
            {mine.map((p) => (
              <li key={p.id} className="rounded-2xl border border-white/5 bg-white/[.03] p-4">
                <div className="flex items-center justify-between gap-2"><span className="font-semibold text-white">{p.name}</span><span className="chip">{P[p.status] || p.status}</span></div>
                <p className="mt-1 line-clamp-2 text-sm">{p.goals}</p>
                <p className="mt-1 text-xs text-zinc-500"><span className="num">{p.price}</span> ₽ · {fmtDate(p.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// == Администратор: модерация ==============================================================
export function AdminReviews() {
  const [data, setData] = useState(null);
  const load = () => request("GET", "/site/v1/admin/reviews").then(setData).catch(() => setData({ reviews: [] }));
  useEffect(() => { load(); }, []);
  if (!data) return <Loading />;
  if (!data.reviews.length) return <p>Отзывов пока нет.</p>;
  const set = (id, status) => request("POST", `/site/v1/admin/reviews/${id}`, { status }).then(load);
  return (
    <div className="grid gap-3">
      {data.reviews.map((r) => (
        <div key={r.id} className="card !p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-3"><span className="font-semibold text-white">{r.author_name}</span><Stars value={r.rating} size={13} /></span>
            <span className="chip">{{ pending: "ждёт", approved: "опубликован", rejected: "отклонён" }[r.status]}</span>
          </div>
          <p className="mt-2 text-sm text-zinc-300">{r.text}</p>
          <div className="mt-3 flex gap-2">
            {r.status !== "approved" && <button type="button" className="btn-primary btn-sm" onClick={() => set(r.id, "approved")}><CheckCircle2 size={14} /> Опубликовать</button>}
            {r.status !== "rejected" && <button type="button" className="btn-ghost btn-sm" onClick={() => set(r.id, "rejected")}>Отклонить</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminTeachers() {
  const [data, setData] = useState(null);
  const load = () => request("GET", "/site/v1/admin/teachers").then(setData).catch(() => setData({ teachers: [] }));
  useEffect(() => { load(); }, []);
  if (!data) return <Loading />;
  if (!data.teachers.length) return <p>Анкет пока нет. Преподаватель создаёт анкету командой /teacher в боте.</p>;
  const set = (uid, status) => request("POST", `/site/v1/admin/teachers/${uid}`, { status }).then(load);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.teachers.map((t) => (
        <div key={t.user_id} className="card !p-5">
          <div className="flex items-center justify-between gap-2"><span className="font-semibold text-white">{t.name}</span><span className="chip">{t.status}</span></div>
          <p className="mt-2 text-sm">{t.specialties || "—"} {t.rate ? <>· <span className="num">{t.rate}</span> ₽</> : null}</p>
          {t.bio && <p className="mt-1 line-clamp-3 text-sm text-zinc-500">{t.bio}</p>}
          <div className="mt-3 flex gap-2">
            {t.status !== "approved" && <button type="button" className="btn-primary btn-sm" onClick={() => set(t.user_id, "approved")}>Одобрить</button>}
            {t.status !== "rejected" && <button type="button" className="btn-ghost btn-sm" onClick={() => set(t.user_id, "rejected")}>Отклонить</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminMarket() {
  const [data, setData] = useState(null);
  useEffect(() => { request("GET", "/site/v1/admin/market").then(setData).catch(() => setData({ requests: [] })); }, []);
  if (!data) return <Loading />;
  if (!data.requests.length) return <p>Заявок на бирже пока нет.</p>;
  const S = { open: "открыта", matched: "преподаватель выбран", closed: "снята" };
  return (
    <div className="card overflow-x-auto !p-0">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="text-xs uppercase tracking-[.15em] text-zinc-500">
          <tr>{["Дата", "Ученик", "Язык / уровень", "Бюджет", "Связь", "Откликов", "Статус"].map((h) => <th key={h} className="px-5 pb-3 pt-5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {data.requests.map((r) => (
            <tr key={r.id} className="border-t border-white/5 align-top">
              <td className="px-5 py-4">{fmtDate(r.created_at)}</td>
              <td className="px-5 py-4 text-white">{r.name}{r.age ? `, ${r.age}` : ""}<span className="block text-xs text-zinc-500">{r.goals}</span></td>
              <td className="px-5 py-4">{r.language_ru}, {r.level_ru}</td>
              <td className="px-5 py-4">{r.budget_ru}</td>
              <td className="px-5 py-4 text-zinc-200">{r.contact}</td>
              <td className="num px-5 py-4 text-center">{r.proposals}</td>
              <td className="px-5 py-4">{S[r.status]}{r.pair_id ? <span className="block text-xs text-zinc-500">пара {r.pair_id}</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

