import {
  Check, CheckCircle2, Clapperboard, Copy, File, FileStack, Link2, NotebookPen, PenTool, Plus, Search, Trash2, Upload,
  UserPlus, Users, Video,
} from "lucide-react";
import { useRef, useState } from "react";
import { getToken, request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { PLANS } from "../site/parts.jsx";
import { Avatar, copy, Empty, ErrorBox, Loading, Modal, Notice, PageTitle, Stat } from "../ui/kit.jsx";
import { LessonList, LiveBanner, Panel, shortDate, startLesson, useApi } from "./common.jsx";

function CopyLink({ label, url }) {
  const [done, setDone] = useState(false);
  if (!url) return null;
  return (
    <button type="button" className="btn-light btn-sm" onClick={() => { copy(url); setDone(true); setTimeout(() => setDone(false), 1600); }}>
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Скопировано" : label}
    </button>
  );
}

function StartButton({ chatId, active, small }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (active) return <a className={`btn-brand ${small ? "btn-sm" : ""}`} href={`#/room/${active}`}><span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Вернуться в урок</a>;
  return (
    <>
      <button type="button" className={`btn-brand ${small ? "btn-sm" : ""}`} disabled={busy}
        onClick={() => { setBusy(true); startLesson(chatId).catch((e) => { setError(e); setBusy(false); }); }}>
        <Video size={14} /> {busy ? "Открываем…" : "Начать урок"}
      </button>
      {error && <ErrorBox error={error} />}
    </>
  );
}

// == Главная ==================================================================================
export function TutorHome() {
  const { account, me } = useSession();
  const { data, error } = useApi("/site/v1/students");
  const students = data?.students || [];
  const titles = Object.fromEntries((me?.chats || []).map((c) => [c.chat_id, c.title]));
  const lessons = (me?.lessons || []).map((l) => ({ ...l, with: titles[l.chat_id] }));
  return (
    <>
      <PageTitle title={`Здравствуйте, ${(account?.name || "").split(" ")[0] || "коллега"}!`}
        text={account?.org ? `Вы преподаёте в школе «${account.org.name}»` : "Частный репетитор — ваша переписка с учениками не фильтруется"} />
      <LiveBanner lessons={lessons} />
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat value={students.length} label="учеников" />
        <Stat value={lessons.filter((l) => l.status === "finished").length} label="уроков проведено" tone="mint" />
        <Stat value={me?.unread || 0} label="новых сообщений" tone="sun" />
        <Stat value={data?.limit ?? "∞"} label="лимит тарифа" tone="lilac" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel title="Ученики" icon={Users} actions={<a href="#/app/students" className="link text-sm">Все</a>}>
          {error ? <p className="text-sm text-ink-mute">Вы вошли через Telegram-бота. <a className="link" href="#/register?role=tutor">Зарегистрируйтесь на сайте</a>, чтобы приглашать учеников по ссылке.</p> : !data ? <Loading /> : !students.length ? (
            <div className="text-center"><p className="text-sm text-ink-mute">Добавьте первого ученика — он получит ссылку-приглашение.</p><a href="#/app/students" className="btn-brand mt-4"><UserPlus size={16} /> Добавить ученика</a></div>
          ) : (
            <ul className="grid gap-2">
              {students.slice(0, 6).map((s) => (
                <li key={s.pair_id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line px-3 py-2.5">
                  <Avatar name={s.name} size={36} />
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{s.name}</span><span className="text-xs text-ink-mute">{s.joined ? "подключён" : "ждём по ссылке"}{s.parents ? ` · родителей: ${s.parents}` : ""}</span></span>
                  {s.joined && <StartButton chatId={s.chat_id} active={s.active_lesson} small />}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Последние уроки" icon={NotebookPen}><LessonList lessons={lessons} limit={5} empty="Проведите первый урок — конспект и отчёты появятся здесь." /></Panel>
      </div>
    </>
  );
}

// == Ученики ==================================================================================
export function StudentsPage() {
  const { data, error, reload } = useApi("/site/v1/students");
  const [name, setName] = useState("");
  const [added, setAdded] = useState(null);
  const [err, setErr] = useState(null);
  const add = async (e) => {
    e.preventDefault(); setErr(null);
    try { setAdded({ name, ...(await request("POST", "/site/v1/students", { name })) }); setName(""); reload(); } catch (x) { setErr(x); }
  };
  const remove = async (s) => {
    if (!window.confirm(`Удалить ученика «${s.name}»? Уроки и конспекты сохранятся в архиве.`)) return;
    await request("POST", `/site/v1/students/${s.pair_id}/remove`, {}).catch(setErr);
    reload();
  };
  const list = data?.students || [];
  return (
    <>
      <PageTitle title="Ученики" text="Ученик и родитель подключаются по ссылкам. Они видят только ваше имя." />
      <form onSubmit={add} className="card mb-4 flex flex-wrap items-end gap-3">
        <label className="label min-w-[220px] flex-1">Имя ученика<input className="field" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Миша" /></label>
        <button type="submit" className="btn-brand"><UserPlus size={16} /> Добавить</button>
        {data?.limit != null && <span className="w-full text-xs text-ink-mute">Учеников: {list.length} из {data.limit} на вашем тарифе. <a href="#/app/plan" className="link">Тарифы</a></span>}
        {err && <div className="w-full"><ErrorBox error={err} /></div>}
      </form>
      <ErrorBox error={error} />
      {!data ? <Loading /> : !list.length ? <Empty icon={Users} title="Учеников пока нет" text="Добавьте ученика — и отправьте ему ссылку-приглашение в любом мессенджере." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((s) => (
            <div key={s.pair_id} className="card !p-5">
              <div className="flex items-center gap-3">
                <Avatar name={s.name} />
                <div className="min-w-0 flex-1"><p className="font-bold">{s.name}</p><p className="text-xs text-ink-mute">{s.joined ? "подключён" : "ещё не подключился"} · родителей: {s.parents}</p></div>
                <button type="button" className="btn-ghost !p-2" onClick={() => remove(s)} aria-label={`Удалить ${s.name}`}><Trash2 size={16} /></button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {s.joined ? <StartButton chatId={s.chat_id} active={s.active_lesson} small /> : <CopyLink label="Ссылка для ученика" url={s.invite?.url} />}
                <CopyLink label="Ссылка для родителя" url={s.parent_invite?.url} />
                {s.joined && <a href="#/app/messages" className="btn-ghost btn-sm">Написать</a>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!added} onClose={() => setAdded(null)} title={`${added?.name || "Ученик"} добавлен`}>
        <p className="text-ink-soft">Отправьте ссылки ученику и родителю — в WhatsApp, Telegram, почтой. По ссылке они зарегистрируются и попадут к вам.</p>
        <div className="mt-4 grid gap-3">
          {[["Ученику", added?.invite?.url], ["Родителю (отчёты и переписка)", added?.parent_invite?.url]].map(([t, url]) => (
            <div key={t}><p className="mb-1 text-sm font-semibold">{t}</p><div className="flex gap-2"><input readOnly className="field text-sm" value={url || ""} onFocus={(e) => e.target.select()} aria-label={t} /><CopyLink label="Копировать" url={url} /></div></div>
          ))}
        </div>
      </Modal>
    </>
  );
}

// == Материалы ===================================================================================
const KIND_ICON = { file: File, video: Clapperboard, link: Link2 };
const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`);

export async function uploadFile(file, { shared } = {}) {
  const headers = { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), Accept: "application/json" };
  const token = getToken();
  if (token) headers["X-Access-Token"] = token;
  if (shared) headers["X-Shared"] = "1";
  const r = await fetch("/site/v1/materials/upload", { method: "POST", headers, body: file, credentials: "same-origin" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(`${file.name}: ${data.error || r.status}`); e.status = r.status; throw e; }
  return data;
}

export function MaterialsPage() {
  const { account, role } = useSession();
  const { data, error, reload } = useApi("/site/v1/materials");
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(null);
  const [errors, setErrors] = useState([]);
  const [link, setLink] = useState({ url: "", title: "" });
  const [preview, setPreview] = useState(null);
  const input = useRef(null);
  const inSchool = !!account?.org && role === "tutor";
  const [shared, setShared] = useState(false);

  const upload = async (files) => {
    const list = [...files];
    const errs = [];
    for (let i = 0; i < list.length; i += 1) {
      setProgress(`Загружаем ${i + 1} из ${list.length}: ${list[i].name}`);
      try { await uploadFile(list[i], { shared }); } catch (e) { errs.push(e.message); }
    }
    setProgress(null); setErrors(errs); reload();
  };
  const addLink = async (e) => {
    e.preventDefault();
    try { await request("POST", "/site/v1/materials", { ...link, shared }); setLink({ url: "", title: "" }); reload(); } catch (x) { setErrors([x.message]); }
  };
  const remove = async (m) => {
    if (!window.confirm(`Удалить «${m.title}»?`)) return;
    await request("POST", `/site/v1/materials/${m.id}/delete`, {}).catch((x) => setErrors([x.message]));
    reload();
  };
  const needle = q.trim().toLowerCase();
  const list = (data?.materials || []).filter((m) => !needle || m.title.toLowerCase().includes(needle));
  return (
    <>
      <PageTitle title="Материалы" text={role === "school" ? "Общая база школы — её видят все ваши преподаватели." : "Ваша база: файлы, ссылки и видео. Всё это можно вывести на доску во время урока."} />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
          className={`card grid place-items-center border-2 border-dashed !py-10 text-center transition ${drag ? "border-brand bg-brand-tint" : "border-line"}`}>
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand"><Upload size={24} /></span>
          <p className="mt-3 font-bold">Перетащите файлы сюда — можно сразу пачкой</p>
          <p className="mt-1 max-w-md text-sm text-ink-mute">PDF, картинки, презентации, документы, аудио и видео до 25 МБ. Переезжаете с ProgressMe? Скачайте свои материалы файлами и перетащите их все разом.</p>
          <input ref={input} type="file" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
          <button type="button" className="btn-brand mt-4" onClick={() => input.current?.click()}>Выбрать файлы</button>
          {progress && <p className="mt-3 text-sm text-brand">{progress}</p>}
        </div>
        <form onSubmit={addLink} className="card grid content-start gap-3">
          <h2 className="text-lg">Ссылка или видео</h2>
          <p className="-mt-1 text-sm text-ink-mute">VK Видео, YouTube и Rutube откроются прямо на доске — без демонстрации экрана.</p>
          <input className="field" type="url" required placeholder="https://vk.com/video…" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} aria-label="Ссылка" />
          <input className="field" maxLength={120} placeholder="Название (необязательно)" value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} aria-label="Название" />
          {inSchool && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Добавлять в общую базу школы</label>}
          <button type="submit" className="btn-light w-fit"><Plus size={16} /> Добавить</button>
        </form>
      </div>
      {errors.length > 0 && <Notice tone="bad" className="mt-4">{errors.map((x) => <div key={x}>{x}</div>)}</Notice>}
      <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">Все материалы {data && <span className="num text-ink-mute">{data.materials.length}</span>}</h2>
        <label className="relative w-full max-w-xs"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute" /><input className="field !pl-11" placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск материалов" /></label>
      </div>
      <ErrorBox error={error} />
      {!data ? <Loading /> : !list.length ? <Empty icon={FileStack} title={needle ? "Ничего не нашлось" : "Материалов пока нет"} text="Загрузите файлы или добавьте ссылку на видео." /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => {
            const I = KIND_ICON[m.kind] || File;
            const img = m.kind === "file" && m.mime?.startsWith("image/");
            return (
              <div key={m.id} className="card flex flex-col !p-4">
                <button type="button" onClick={() => setPreview(m)} className="mb-3 grid h-28 place-items-center overflow-hidden rounded-2xl bg-cream">
                  {img ? <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <I size={30} className="text-brand" />}
                </button>
                <p className="line-clamp-2 font-semibold">{m.title}</p>
                <p className="mt-0.5 text-xs text-ink-mute">{m.kind === "video" ? "видео" : m.kind === "link" ? "ссылка" : fmtSize(m.size)}{m.shared ? " · база школы" : ""} · {shortDate(m.created_at)}</p>
                <div className="mt-auto flex gap-1 pt-3">
                  <a className="btn-ghost btn-sm" href={m.url} target="_blank" rel="noopener">Открыть</a>
                  {(m.mine || role === "school") && <button type="button" className="btn-ghost btn-sm ml-auto !px-2" onClick={() => remove(m)} aria-label={`Удалить ${m.title}`}><Trash2 size={14} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title || ""} wide>
        {preview?.embed ? <iframe title={preview.title} src={preview.embed} className="aspect-video w-full rounded-2xl" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
          : preview?.mime?.startsWith("image/") ? <img src={preview.url} alt={preview.title} className="max-h-[70vh] w-full rounded-2xl object-contain" />
            : preview?.mime === "application/pdf" ? <iframe title={preview.title} src={preview.url} className="h-[70vh] w-full rounded-2xl border border-line" />
              : preview && <a className="btn-brand" href={preview.url} target="_blank" rel="noopener">Открыть файл</a>}
      </Modal>
    </>
  );
}

// == Домашние задания (все роли) ================================================================
const HW_STATUS = { open: ["задано", "chip"], done: ["выполнено", "chip !bg-mint-soft !text-[#146b4c]"], checked: ["проверено", "chip chip-brand"] };

function HomeworkItem({ h, reload }) {
  const [answer, setAnswer] = useState(h.answer || "");
  const [error, setError] = useState(null);
  const set = async (status) => {
    try { await request("POST", `/site/v1/homework/${h.id}`, { status, answer }); reload(); } catch (x) { setError(x); }
  };
  const [label, cls] = HW_STATUS[h.status] || [h.status, "chip"];
  return (
    <div className="card !p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-mute">{h.role === "tutor" ? h.student : h.role === "parent" ? `${h.student} · ${h.tutor}` : h.tutor} · {shortDate(h.created_at)}{h.due ? ` · до ${h.due}` : ""}</span>
        <span className={cls}>{label}</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap">{h.text}</p>
      {h.materials.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">{h.materials.map((m) => <a key={m.id} href={m.url} target="_blank" rel="noopener" className="chip hover:border-brand"><File size={12} /> {m.title}</a>)}</div>
      )}
      {h.role === "student" && h.status !== "checked" && (
        <div className="mt-4 grid gap-2">
          <textarea className="field min-h-[70px]" maxLength={3000} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Ответ или комментарий для преподавателя" aria-label="Ответ" />
          <div className="flex gap-2">
            {h.status === "open" ? <button type="button" className="btn-brand btn-sm" onClick={() => set("done")}><CheckCircle2 size={14} /> Готово</button>
              : <button type="button" className="btn-light btn-sm" onClick={() => set("open")}>Вернуть в работу</button>}
          </div>
        </div>
      )}
      {h.role !== "student" && h.answer && <p className="mt-3 rounded-2xl bg-cream p-3 text-sm"><b>Ответ ученика:</b> {h.answer}</p>}
      {h.role === "tutor" && h.status === "done" && <button type="button" className="btn-brand btn-sm mt-3" onClick={() => set("checked")}><Check size={14} /> Проверено</button>}
      <ErrorBox error={error} />
    </div>
  );
}

function AssignForm({ onDone }) {
  const students = useApi("/site/v1/students").data?.students?.filter((s) => s.joined) || [];
  const materials = useApi("/site/v1/materials").data?.materials || [];
  const [f, setF] = useState({ chat_id: "", text: "", due: "", materials: [] });
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setError(null);
    try {
      await request("POST", "/site/v1/homework", { ...f, chat_id: f.chat_id || students[0]?.chat_id, due: f.due || null });
      setF({ ...f, text: "", materials: [] }); onDone();
    } catch (x) { setError(x); }
  };
  if (!students.length) return <Notice>Задание можно выдать, когда ученик подключится по ссылке.</Notice>;
  const toggle = (id) => setF({ ...f, materials: f.materials.includes(id) ? f.materials.filter((x) => x !== id) : [...f.materials, id].slice(0, 10) });
  return (
    <form onSubmit={submit} className="card grid gap-3">
      <h2 className="text-lg">Новое задание</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <select className="field" value={f.chat_id} onChange={(e) => setF({ ...f, chat_id: e.target.value })} aria-label="Ученик">
          {students.map((s) => <option key={s.chat_id} value={s.chat_id}>{s.name}</option>)}
        </select>
        <input className="field" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} aria-label="Срок" />
      </div>
      <textarea className="field min-h-[100px]" required maxLength={3000} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Что сделать: упражнения, слова, видео…" aria-label="Задание" />
      {materials.length > 0 && (
        <details className="rounded-2xl border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">Приложить материалы ({f.materials.length})</summary>
          <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
            {materials.map((m) => <button key={m.id} type="button" onClick={() => toggle(m.id)} aria-pressed={f.materials.includes(m.id)} className={`chip ${f.materials.includes(m.id) ? "chip-brand" : ""}`}>{m.title}</button>)}
          </div>
        </details>
      )}
      <ErrorBox error={error} />
      <button type="submit" className="btn-brand w-fit"><NotebookPen size={16} /> Выдать задание</button>
      <p className="text-xs text-ink-mute">Ученик и родители увидят задание на сайте и получат уведомление в Telegram, если он привязан.</p>
    </form>
  );
}

export function HomeworkPage() {
  const { role } = useSession();
  const { data, error, reload } = useApi("/site/v1/homework");
  const list = data?.homework || [];
  const open = list.filter((h) => h.status === "open");
  return (
    <>
      <PageTitle title="Домашние задания" text={role === "parent" ? "Что задано и что уже сделано." : role === "student" ? `Открытых заданий: ${open.length}` : "Выдавайте задания с материалами и отмечайте проверенные."} />
      <div className={role === "tutor" ? "grid items-start gap-4 lg:grid-cols-[1fr_1.2fr]" : ""}>
        {role === "tutor" && <AssignForm onDone={reload} />}
        <div className="grid gap-3">
          <ErrorBox error={error} />
          {!data ? <Loading /> : !list.length ? <Empty icon={NotebookPen} title="Заданий пока нет" text={role === "tutor" ? "Выдайте первое задание — слева." : "Когда преподаватель задаст ДЗ, оно появится здесь."} />
            : list.map((h) => <HomeworkItem key={h.id} h={h} reload={reload} />)}
        </div>
      </div>
    </>
  );
}

// == Тариф ======================================================================================
export function PlanPage() {
  const { account } = useSession();
  const current = account?.plan || "free";
  return (
    <>
      <PageTitle title="Тариф" text={account?.org ? `Вы в школе «${account.org.name}» — тариф оплачивает школа.` : `Сейчас: «${account?.plan_info?.title || "Старт"}».`} />
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.filter((p) => p.id !== "school").map((p) => (
          <div key={p.id} className={`card flex flex-col ${p.id === current ? "border-brand" : ""}`}>
            <div className="flex items-center justify-between"><h3 className="text-xl">{p.title}</h3>{p.id === current && <span className="chip chip-brand">ваш тариф</span>}</div>
            <p className="mt-1 text-sm text-ink-mute">{p.students}</p>
            <p className="mt-3 num font-display text-3xl font-extrabold">{p.price} ₽ <span className="text-sm font-medium text-ink-mute">{p.note}</span></p>
            <ul className="mt-4 grid flex-1 gap-1.5 text-sm">{p.features.map((x) => <li key={x} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-mint" />{x}</li>)}</ul>
          </div>
        ))}
      </div>
      <Notice className="mt-6">Онлайн-оплата ещё подключается. Чтобы перейти на «Про» или «Безлимит» сейчас, напишите в поддержку — тариф включат вручную.</Notice>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {[[PenTool, "Доска и стикеры", "на всех тарифах"], [Clapperboard, "Видео из VK", "на всех тарифах"], [NotebookPen, "Конспекты и отчёты", "на всех тарифах"]].map(([I, t, d]) => (
          <div key={t} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3"><I size={18} className="text-brand" /><span className="font-semibold">{t}</span><span className="ml-auto text-xs text-ink-mute">{d}</span></div>
        ))}
      </div>
    </>
  );
}
