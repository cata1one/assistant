import { ArrowUpRight, LogOut, MessagesSquare, Search, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal.jsx";
import { ErrorBox, Loading, Notice, PageHead, Segmented } from "../components/ui.jsx";
import { fmtDate, getToken, request, setToken } from "../lib/api.js";
import { botUrl, courseById, useCatalog } from "../lib/catalog.js";
import { replaceHash } from "../lib/router.js";
import { BoardList } from "./Board.jsx";
import { AdminMarket, AdminReviews, AdminTeachers, Messages, ParentOverview, ReviewForm, TeacherProfile } from "./CabinetExtra.jsx";

export function CabinetLogin({ message }) {
  const bot = botUrl(useCatalog());
  return (
    <>
      <PageHead eyebrow="Вход без пароля" title="Личный кабинет" />
      <Reveal className="card max-w-2xl">
        {message && <div className="mb-5"><Notice tone="warn">{message}</Notice></div>}
        <p className="text-zinc-200">Вход — по личной ссылке от бота школы.</p>
        <ol className="mt-5 grid gap-3">
          {["Откройте бота школы в Telegram", "Отправьте команду /cabinet", "Нажмите на ссылку — кабинет откроется здесь"].map((s, i) => (
            <li key={s} className="flex items-center gap-4">
              <span className="num-badge h-8 w-8 text-sm">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        {bot && <a className="btn-primary mt-7" href={bot} target="_blank" rel="noopener">Открыть бота <ArrowUpRight size={16} /></a>}
        <p className="mt-6 text-sm text-zinc-500">В кабинете: конспекты уроков, словарь с карточками, тесты, домашние задания, отчёты для родителей и общая доска с преподавателем.</p>
      </Reveal>
    </>
  );
}

export function Flashcard({ w }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button type="button" onClick={() => setFlipped(!flipped)} aria-label={`${w.word} — ${flipped ? "показать слово" : "показать перевод"}`}
      className={`card card-hover flex min-h-[112px] flex-col items-center justify-center text-center !p-5 hover:shadow-glow-violet ${flipped ? "!bg-violet/20" : ""}`}>
      <span className="font-display text-xl font-semibold text-white">{flipped ? w.translation || "—" : w.word}</span>
      {!flipped && w.transcription && <span className="mt-1 text-sm text-zinc-500">{w.transcription}</span>}
      {flipped && w.example && <span className="mt-1 text-xs text-zinc-400">{w.example}</span>}
    </button>
  );
}

function Lessons({ me }) {
  if (!me.lessons.length) return <p>Уроков пока нет. Материалы появятся после первого занятия.</p>;
  return (
    <Stagger className="grid gap-3" gap={0.04}>
      {me.lessons.map((l) => (
        <StaggerItem key={l.id}>
          <div className="card card-hover flex flex-wrap items-center justify-between gap-4 !p-5">
            <div>
              <p className="font-semibold text-white">{l.title}</p>
              <p className="text-sm text-zinc-500">{fmtDate(l.started_at)}{l.words ? ` · новых слов: ${l.words}` : ""}</p>
            </div>
            {l.has_report
              ? <a className="btn-primary btn-sm" href={`#/lesson/${l.id}`}>{l.role === "parent" ? "Отчёт" : "Конспект"} <ArrowUpRight size={14} /></a>
              : <span className="chip">{l.status === "active" ? "идёт урок" : "готовится"}</span>}
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function Words() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { request("GET", "/site/v1/words").then(setData).catch(setError); }, []);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  if (!data.words.length) return <p>Слов пока нет.</p>;
  const needle = q.trim().toLowerCase();
  const list = data.words.filter((w) => !needle || `${w.word} ${w.translation || ""}`.toLowerCase().includes(needle));
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <label className="relative w-full max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input className="field !pl-11" placeholder="Поиск по словарю" aria-label="Поиск по словарю" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className="text-sm text-zinc-500">Всего слов: {data.count}. Нажмите на карточку, чтобы увидеть перевод.</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{list.map((w) => <Flashcard key={w.word} w={w} />)}</div>
    </>
  );
}

function Boards() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { request("GET", "/site/v1/boards").then(setData).catch(setError); }, []);
  if (error) return <ErrorBox error={error} />;
  return data ? <BoardList data={data} /> : <Loading />;
}

const APP_STATUS = { new: "новая", in_progress: "в работе", done: "обработана", rejected: "отклонена" };

function Applications() {
  const catalog = useCatalog();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { request("GET", "/site/v1/admin/applications").then(setData).catch(setError); }, []);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  if (!data.applications.length) return <p>Заявок пока нет.</p>;
  const change = (a, status) => request("POST", `/site/v1/admin/applications/${a.id}`, { status }).catch((err) => setError(err));
  return (
    <div className="card overflow-x-auto !p-0">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="text-xs uppercase tracking-[.15em] text-zinc-500">
          <tr>{["№", "Дата", "Имя", "Связь", "Направление", "Цель", "Статус"].map((h) => <th key={h} className="px-5 pb-3 pt-5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {data.applications.map((a) => (
            <tr key={a.id} className="border-t border-white/5 align-top">
              <td className="px-5 py-4">{a.id}</td>
              <td className="px-5 py-4">{fmtDate(a.created_at)}</td>
              <td className="px-5 py-4 text-white">{a.name}</td>
              <td className="px-5 py-4 text-zinc-200">{a.contact}</td>
              <td className="px-5 py-4">{courseById(catalog, a.course_id)?.title || "—"}</td>
              <td className="px-5 py-4">{[a.level, a.goal, a.comment].filter(Boolean).join(" · ") || "—"}</td>
              <td className="px-5 py-4">
                <select className="field !py-2" aria-label={`Статус заявки ${a.id}`} defaultValue={a.status} onChange={(e) => change(a, e.target.value)}>
                  {Object.entries(APP_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PairRow({ c }) {
  const [url, setUrl] = useState(c.classroom_url || "");
  const [msg, setMsg] = useState("");
  const save = () => request("POST", "/site/v1/admin/classroom", { chat_id: c.chat_id, url: url.trim() || null })
    .then(() => setMsg("✅ Сохранено")).catch((err) => setMsg(`⛔ ${err.message}`));
  return (
    <div className="card !p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-white">{c.title}</span><span className="chip">пара {c.pair_id}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input className="field max-w-md flex-1" type="url" placeholder="https://…progressme.ru/…" aria-label={`Ссылка на класс для пары ${c.pair_id}`}
          value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="button" className="btn-primary btn-sm" onClick={save}>Сохранить</button>
        <span className="text-sm" aria-live="polite">{msg}</span>
      </div>
    </div>
  );
}

function Pairs({ me }) {
  const pairs = me.chats.filter((c) => c.pair_id);
  if (!pairs.length) return <p>Пар пока нет. Создайте пару в боте: /new_pair Преподаватель | Ученик</p>;
  return (
    <div className="grid gap-3">
      <p className="text-sm text-zinc-500">Ссылка на класс ProgressMe видна преподавателю и ученику в кабинете и приходит в Telegram в начале урока. Допускаются только ссылки на платформу уроков школы.</p>
      {pairs.map((c) => <PairRow key={c.chat_id} c={c} />)}
    </div>
  );
}

function StartLesson({ chat }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true); setError(null);
    try {
      const r = await request("POST", "/site/v1/rooms", { chat_id: chat.chat_id, title: title || null });
      window.location.hash = `#/room/${r.lesson_id}`;
    } catch (e) { setError(e); setBusy(false); }
  };
  return (
    <div className="relative mt-5 grid gap-2">
      <div className="flex flex-wrap gap-2">
        <input className="field max-w-xs flex-1 !py-2 text-sm" placeholder="Тема урока (необязательно)" maxLength={120}
          aria-label="Тема урока" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={start}><Video size={14} /> Начать урок в онлайн-классе</button>
      </div>
      {error && <ErrorBox error={error} />}
    </div>
  );
}

function Chats({ me }) {
  const mine = me.chats.filter((c) => c.role !== "admin");
  if (!mine.length) {
    return me.admin ? null : <Notice tone="info">Вы пока не подключены к преподавателю или ученику. Откройте ссылку-приглашение от школы в Telegram.</Notice>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {mine.map((c) => (
        <div key={c.chat_id} className="card relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet/25 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-2xl">{c.title}</h3><span className="chip">вы — {c.role_ru}</span>
          </div>
          {(() => {
            const live = me.lessons.find((l) => l.chat_id === c.chat_id && l.status === "active");
            if (live) {
              return (
                <a className="btn relative mt-5 bg-rose-500 text-white hover:shadow-[0_10px_40px_-10px_rgba(244,63,94,.8)]" href={`#/room/${live.id}`}>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Идёт урок — войти в онлайн-класс
                </a>
              );
            }
            return c.role === "tutor" ? <StartLesson chat={c} /> : null;
          })()}
          <div className="relative mt-5 flex flex-wrap gap-2">
            {c.classroom_url
              ? <a className="btn-primary btn-sm" href={c.classroom_url} target="_blank" rel="noopener"><Video size={14} /> Войти в класс ProgressMe</a>
              : c.role === "parent" ? <a className="btn-ghost btn-sm" href="#/cabinet?tab=lessons">Отчёты по урокам</a> : null}
            {c.chat_url && <a className="btn-ghost btn-sm" href={c.chat_url} target="_blank" rel="noopener"><MessagesSquare size={14} /> Чат в Telegram</a>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Cabinet({ params }) {
  const [, force] = useState(0);
  const urlToken = params.get("t");
  if (urlToken) {
    setToken(urlToken);
    replaceHash("#/cabinet"); // токен не остаётся в адресной строке и истории
  }
  const token = getToken();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(params.get("tab") || "lessons");

  useEffect(() => {
    if (!token) return;
    request("GET", "/site/v1/me").then(setMe).catch((err) => {
      if (err.status === 401) { setToken(null); setError(err); force((n) => n + 1); } else setError(err);
    });
  }, [token]);

  if (!getToken()) return <CabinetLogin message={error?.message} />;
  if (error) return <><PageHead title="Личный кабинет" /><ErrorBox error={error} /></>;
  if (!me) return <><PageHead title="Личный кабинет" /><Loading /></>;

  const inPair = me.chats.some((c) => c.role === "tutor" || c.role === "student");
  const tabs = [{ id: "lessons", title: me.is_parent && !inPair ? "Отчёты" : "Уроки" }];
  if (inPair) tabs.push({ id: "messages", title: me.unread ? `Сообщения · ${me.unread}` : "Сообщения" },
    { id: "words", title: "Словарь" }, { id: "boards", title: "Доски" });
  if (me.teacher_status) tabs.push({ id: "teacher", title: "Анкета и биржа" });
  tabs.push({ id: "review", title: "Отзыв о школе" });
  if (me.admin) tabs.push({ id: "applications", title: "Заявки" }, { id: "pairs", title: "Пары и классы" },
    { id: "reviews-admin", title: "Отзывы" }, { id: "teachers-admin", title: "Преподаватели" }, { id: "market-admin", title: "Биржа" });
  const current = tabs.some((t) => t.id === tab) ? tab : "lessons";
  const pick = (id) => { setTab(id); replaceHash(`#/cabinet?tab=${id}`); };
  const logout = async () => {
    await request("POST", "/site/v1/logout", {}).catch(() => {});
    setToken(null); setMe(null); force((n) => n + 1);
  };

  return (
    <>
      <PageHead eyebrow={me.admin ? "Администратор" : me.is_parent && !inPair ? "Для родителей" : "Добро пожаловать"} title="Личный кабинет">
        <button type="button" onClick={logout} className="btn-ghost btn-sm mt-6"><LogOut size={14} /> Выйти на всех устройствах</button>
      </PageHead>
      <div className="grid gap-8">
        {me.is_parent && <ParentOverview />}
        <Chats me={me} />
        <div><Segmented label="Разделы кабинета" items={tabs} value={current} onChange={pick} /></div>
        <div>
          {current === "lessons" && <Lessons me={me} />}
          {current === "words" && <Words />}
          {current === "boards" && <Boards />}
          {current === "applications" && <Applications />}
          {current === "pairs" && <Pairs me={me} />}
          {current === "messages" && <Messages />}
          {current === "teacher" && <TeacherProfile />}
          {current === "review" && <ReviewForm />}
          {current === "reviews-admin" && <AdminReviews />}
          {current === "teachers-admin" && <AdminTeachers />}
          {current === "market-admin" && <AdminMarket />}
        </div>
      </div>
    </>
  );
}

