import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { ErrorBox, Loading, Modal, Notice } from "../ui/kit.jsx";
import { startLesson, useApi } from "./common.jsx";

const pad = (n) => String(n).padStart(2, "0");
const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
const monday = (date) => addDays(date, -((date.getDay() + 6) % 7));
const shortDate = (d) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
const time = (value) => new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

function AppointmentForm({ draft, students, groups, onClose, onSaved }) {
  const [form, setForm] = useState(draft);
  const [error, setError] = useState(null), [busy, setBusy] = useState(false);
  const options = students.map((s) => ({ id: `student:${s.pair_id}`, name: s.name }))
    .concat(groups.map((g) => ({ id: `group:${g.id}`, name: `Класс: ${g.title}` })));
  const available = options.some((option) => option.id === form.target);
  const save = async (event) => {
    event.preventDefault(); setError(null);
    const start = new Date(form.start), minutes = Number(form.minutes);
    if (!form.start || Number.isNaN(start.getTime()) || localInput(start) !== form.start) {
      setError(new Error("Проверьте дату и время: такое местное время может не существовать при переводе часов.")); return;
    }
    if (!available) { setError(new Error("Выберите доступного ученика или класс.")); return; }
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 480) { setError(new Error("Продолжительность — от 5 до 480 минут.")); return; }
    const [kind, id] = form.target.split(":");
    const body = { title: form.title, note: form.note, pair_id: kind === "student" ? id : null,
      group_id: kind === "group" ? id : null, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + minutes * 60000).toISOString() };
    setBusy(true);
    try { await request("POST", draft.id ? `/site/v1/schedule/${draft.id}` : "/site/v1/schedule", body); onSaved(start); }
    catch (err) { setError(err); setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm("Удалить запись из расписания?")) return;
    setError(null); setBusy(true);
    try { await request("POST", `/site/v1/schedule/${draft.id}/delete`, {}); onSaved(null); }
    catch (err) { setError(err); setBusy(false); }
  };
  return <Modal open onClose={() => !busy && onClose()} title={draft.id ? "Изменить занятие" : "Добавить занятие"}>
    <form className="grid gap-4" onSubmit={save}>
      <label className="label">Ученик или класс<select className="field" value={form.target} required onChange={(e) => setForm({ ...form, target: e.target.value })}>
        <option value="">Выберите ученика или класс</option>
        {form.target && !available && <option value={form.target} disabled>Ученик или класс недоступен — выберите другой</option>}
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select></label>
      <label className="label">Название<input className="field" required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="label">Дата и время<input className="field" type="datetime-local" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
        <label className="label">Продолжительность, минут<input className="field" type="number" min="5" max="480" step="1" required value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} /></label></div>
      <label className="label">Заметка для себя<textarea className="field" rows={3} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Тема, план или напоминание" /></label>
      <p className="text-xs text-ink-mute">Время указано по часовому поясу вашего устройства. Запись видна только вам.</p>
      <ErrorBox error={error} /><div className="flex flex-wrap gap-2"><button type="submit" className="btn-brand" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить"}</button>{draft.id && <button type="button" className="btn-ghost text-teach-deep" disabled={busy} onClick={remove}>Удалить запись</button>}</div>
    </form>
  </Modal>;
}

function ScheduledStart({ event, lessons }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const active = lessons.find((lesson) => lesson.chat_id === event.chat_id && lesson.status === "active");
  if (!event.chat_id) return null;
  if (active) return <a className="btn-light btn-sm" href={`#/room/${active.id}`}>Вернуться в урок</a>;
  return <div><button type="button" className="btn-light btn-sm" disabled={busy} onClick={async () => {
    setBusy(true); setError(null);
    try { await startLesson(event.chat_id, event.title); } catch (err) { setError(err); setBusy(false); }
  }}><Video size={14} /> Начать урок</button><ErrorBox error={error} /></div>;
}

export default function Schedule({ students = [], student = null }) {
  const { me } = useSession();
  const groupsRequest = useApi(student ? null : "/site/v1/groups");
  const groups = groupsRequest.data?.groups || [];
  const choices = student ? [student] : students;
  const [week, setWeek] = useState(() => monday(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => addDays(new Date(), 0));
  const [version, setVersion] = useState(0), [data, setData] = useState(null), [error, setError] = useState(null);
  const [draft, setDraft] = useState(null);
  const query = new URLSearchParams({ from: week.toISOString(), to: addDays(week, 7).toISOString() }).toString();
  useEffect(() => {
    const controller = new AbortController(); let live = true;
    setData(null); setError(null);
    request("GET", `/site/v1/schedule?${query}`, undefined, {}, { signal: controller.signal })
      .then((result) => { if (live) setData(result); }).catch((err) => { if (live && err.name !== "AbortError") setError(err); });
    return () => { live = false; controller.abort(); };
  }, [query, version]);
  const items = (data?.items || []).filter((item) => !student || item.pair_id === student.pair_id);
  const openNew = (day = new Date()) => {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0);
    setDraft({ title: "Занятие", note: "", start: localInput(start), minutes: 60,
      target: student ? `student:${student.pair_id}` : "" });
  };
  const edit = (item) => setDraft({ id: item.id, title: item.title, note: item.note,
    start: localInput(new Date(item.starts_at)), minutes: Math.round((new Date(item.ends_at) - new Date(item.starts_at)) / 60000),
    target: item.pair_id ? `student:${item.pair_id}` : `group:${item.group_id}` });
  const saved = (start) => { setDraft(null); if (start) { setWeek(monday(start)); setSelectedDay(addDays(start, 0)); } setVersion((n) => n + 1); };
  const selectWeek = (nextWeek) => { const today = addDays(new Date(), 0); setWeek(nextWeek); setSelectedDay(today >= nextWeek && today < addDays(nextWeek, 7) ? today : nextWeek); };
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const selectedEnd = addDays(selectedDay, 1);
  const selectedEvents = items.filter((item) => new Date(item.starts_at) < selectedEnd && new Date(item.ends_at) > selectedDay);
  return <section className="mb-5 rounded-3xl border border-line bg-white p-4 md:p-6" aria-label="Расписание занятий">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl"><CalendarDays size={20} className="text-brand" /> Расписание</h2><p className="mt-1 text-sm text-ink-soft">{student ? `Занятия с ${student.name}` : "Запланированные занятия и классы"} · {timezone || "местное время"}</p></div><button type="button" className="btn-brand" onClick={() => openNew(selectedDay)}><Plus size={16} /> Добавить</button></div>
    <div className="mt-5 flex flex-wrap items-center gap-2"><button type="button" className="btn-light !w-10 !px-0" aria-label="Предыдущая неделя" onClick={() => selectWeek(addDays(week, -7))}><ChevronLeft size={18} /></button><p className="min-w-[9rem] text-center text-sm font-semibold">{shortDate(week)} — {shortDate(addDays(week, 6))}</p><button type="button" className="btn-light !w-10 !px-0" aria-label="Следующая неделя" onClick={() => selectWeek(addDays(week, 7))}><ChevronRight size={18} /></button><button type="button" className="btn-ghost btn-sm" onClick={() => selectWeek(monday(new Date()))}>Эта неделя</button></div>
    <ErrorBox error={error || groupsRequest.error} />
    {!data && !error ? <div className="py-5"><Loading /></div> : error ? <button type="button" className="btn-light mt-3" onClick={() => setVersion((n) => n + 1)}>Попробовать снова</button> : <>
      <div className="mt-4 grid grid-cols-7 gap-1 sm:gap-2" aria-label="Дни недели">
      {Array.from({ length: 7 }, (_, index) => {
        const day = addDays(week, index), next = addDays(day, 1), today = new Date().toDateString() === day.toDateString();
        const hasEvents = items.some((item) => new Date(item.starts_at) < next && new Date(item.ends_at) > day);
        return <button key={day.toISOString()} type="button" aria-pressed={day.toDateString() === selectedDay.toDateString()} aria-label={day.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })} onClick={() => setSelectedDay(day)} className={`grid min-w-0 place-items-center gap-1 rounded-xl border px-1 py-2 text-sm ${day.toDateString() === selectedDay.toDateString() ? "border-brand bg-brand-tint text-brand-deep" : "border-line hover:bg-cream"}`}>
          <span className="text-xs capitalize text-ink-mute">{day.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "")}</span><span className="font-semibold">{day.getDate()}</span><span className={`h-1.5 w-1.5 rounded-full ${hasEvents ? "bg-brand" : today ? "bg-[#9eb9df]" : "bg-transparent"}`} />
        </button>;
      })}
      </div>
      <div className="mt-4"><p className="text-sm font-semibold capitalize">{selectedDay.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}{new Date().toDateString() === selectedDay.toDateString() && <span className="ml-2 text-xs text-brand">Сегодня</span>}</p>
        {!selectedEvents.length ? <p className="mt-3 rounded-xl bg-cream p-4 text-sm text-ink-soft">На этот день занятий нет.</p> : <div className="mt-3 grid gap-2">{selectedEvents.map((item) => <div key={item.id} className="rounded-xl border border-line bg-white p-3">
          <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-brand">{new Date(item.starts_at) < selectedDay ? `${shortDate(new Date(item.starts_at))} ` : ""}{time(item.starts_at)}–{time(item.ends_at)}</p><p className="mt-1 break-words font-semibold">{item.title}</p><p className="mt-1 text-sm text-ink-soft">{item.group_id ? "Класс: " : ""}{item.name}</p>{item.note && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{item.note}</p>}</div><button type="button" className="btn-ghost !h-8 !w-8 !p-0" aria-label={`Изменить ${item.title}: ${item.name}`} onClick={() => edit(item)}><Pencil size={15} /></button></div>
          <div className="mt-3 flex flex-wrap gap-2"><ScheduledStart event={item} lessons={me?.lessons || []} />{item.pair_id && item.chat_id && <a className="btn-ghost btn-sm" href={`#/app/students/${item.pair_id}`}>Карточка ученика</a>}</div>
        </div>)}</div>}
      </div>
    </>}
    {data?.truncated && <Notice tone="warn" className="mt-3">Показаны первые 500 записей за неделю.</Notice>}
    <p className="mt-4 text-xs leading-relaxed text-ink-mute">Расписание видно только вам. Запись не запускает урок и не отправляет уведомление ученику автоматически.</p>
    {draft && <AppointmentForm draft={draft} students={choices} groups={groups} onClose={() => setDraft(null)} onSaved={saved} />}
  </section>;
}
