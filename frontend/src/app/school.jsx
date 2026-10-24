import { CheckCircle2, ShieldAlert, ShieldCheck, Star, Users } from "lucide-react";
import { useState } from "react";
import { fmtDate, request } from "../lib/api.js";
import { copy, Empty, ErrorBox, Loading, Notice, PageTitle, Stat } from "../ui/kit.jsx";
import { Panel, shortDate, useApi } from "./common.jsx";

function useSchool() {
  return useApi("/site/v1/school");
}

function InviteBox({ url }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <input readOnly className="field min-w-0 flex-1 text-sm" value={url || ""} onFocus={(e) => e.target.select()} aria-label="Ссылка для преподавателей" />
      <button type="button" className="btn-brand" onClick={() => { copy(url); setDone(true); }}>{done ? "Скопировано" : "Копировать"}</button>
    </div>
  );
}

export function SchoolHome() {
  const { data, error, reload } = useSchool();
  const [err, setErr] = useState(null);
  const toggle = async () => {
    try { await request("POST", "/site/v1/school", { filter_contacts: !data.org.filter_contacts }); reload(); } catch (x) { setErr(x); }
  };
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const week = Date.now() - 7 * 864e5;
  return (
    <>
      <PageTitle title={data.org.name} text="Кабинет школы: преподаватели, ученики, уроки и сигналы." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat value={data.tutors.length} label="преподавателей" />
        <Stat value={data.students_total} label="учеников" tone="mint" />
        <Stat value={data.lessons.filter((l) => new Date(l.started_at).getTime() > week).length} label="уроков за неделю" tone="lilac" />
        <Stat value={data.signals.filter((s) => new Date(s.created_at).getTime() > week).length} label="сигналов за неделю" tone="sun" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Пригласить преподавателя" icon={Users}>
          <p className="mb-3 text-sm text-ink-soft">Отправьте ссылку преподавателю: он зарегистрируется и попадёт в вашу школу. Его ученики, уроки и переписка будут видны вам.</p>
          <InviteBox url={data.tutor_invite.url} />
        </Panel>
        <Panel title="Защита учеников" icon={ShieldCheck}>
          <p className="text-sm text-ink-soft">Когда включено, телефоны, ники и ссылки в переписке, речи на уроке и на доске блокируются, а вам приходит сигнал.</p>
          <button type="button" onClick={toggle} role="switch" aria-checked={data.org.filter_contacts}
            className={`mt-4 flex items-center gap-3 rounded-full border px-4 py-2 font-semibold transition ${data.org.filter_contacts ? "border-mint bg-mint-soft text-[#146b4c]" : "border-line bg-white text-ink-soft"}`}>
            <span className={`relative h-6 w-11 rounded-full transition ${data.org.filter_contacts ? "bg-mint" : "bg-line"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${data.org.filter_contacts ? "left-[22px]" : "left-0.5"}`} /></span>
            {data.org.filter_contacts ? "Фильтр контактов включён" : "Фильтр выключен"}
          </button>
          <ErrorBox error={err} />
        </Panel>
        <Panel title="Последние сигналы" icon={ShieldAlert} actions={<a href="#/app/signals" className="link text-sm">Все</a>}>
          <Signals list={data.signals.slice(0, 4)} />
        </Panel>
        <Panel title="Последние уроки" icon={CheckCircle2}><SchoolLessonList list={data.lessons.slice(0, 6)} /></Panel>
      </div>
    </>
  );
}

function Signals({ list }) {
  if (!list.length) return <p className="text-sm text-ink-mute">Сигналов нет – никто не пытался обменяться контактами.</p>;
  return (
    <ul className="grid gap-2">
      {list.map((s) => (
        <li key={s.id} className="rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold">{s.who || "–"} <span className="font-normal text-ink-mute">({{ tutor: "преподаватель", student: "ученик", parent: "родитель" }[s.role] || s.role || "участник"})</span></span>
            <span className="text-xs text-ink-mute">{shortDate(s.created_at)}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-teach-deep">{s.summary}</p>
          {s.text && <p className="mt-1 line-clamp-3 text-sm text-ink-soft">«{s.text}»</p>}
        </li>
      ))}
    </ul>
  );
}

function SchoolLessonList({ list }) {
  if (!list.length) return <p className="text-sm text-ink-mute">Уроков пока не было.</p>;
  return (
    <ul className="grid gap-2">
      {list.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-white px-4 py-3">
          <span><span className="block font-semibold">{l.title || "Урок"}</span><span className="text-xs text-ink-mute">{fmtDate(l.started_at)} · {l.tutor} → {l.student}</span></span>
          {l.status === "finished" ? <a href={`#/lesson/${l.id}`} className="btn-light btn-sm">Отчёт</a> : <span className="chip">{l.status === "active" ? "идёт" : "готовится"}</span>}
        </li>
      ))}
    </ul>
  );
}

export function TutorsPage() {
  const { data, error } = useSchool();
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <PageTitle title="Преподаватели и ученики" text={`${data.tutors.length} преподавателей · ${data.students_total} учеников`} />
      <Panel className="mb-4"><p className="mb-3 text-sm text-ink-soft">Ссылка для новых преподавателей:</p><InviteBox url={data.tutor_invite.url} /></Panel>
      {!data.tutors.length ? <Empty icon={Users} title="Преподавателей пока нет" text="Отправьте ссылку-приглашение – преподаватель появится здесь после регистрации." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.tutors.map((t) => (
            <div key={t.id} className="card !p-5">
              <p className="font-bold">{t.name}</p><p className="text-xs text-ink-mute">{t.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {t.students.length ? t.students.map((s) => <span key={s.pair_id} className={`chip ${s.joined ? "" : "opacity-60"}`}>{s.name}{s.joined ? "" : " · ждёт"}</span>) : <span className="text-sm text-ink-mute">Учеников пока нет</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function SignalsPage() {
  const { data, error } = useSchool();
  return (
    <>
      <PageTitle title="Сигналы" text="Попытки обменяться контактами в переписке, речи на уроке и на доске." />
      <ErrorBox error={error} />
      {!data ? <Loading /> : <Signals list={data.signals} />}
    </>
  );
}

export function SchoolLessonsPage() {
  const { data, error } = useSchool();
  return (
    <>
      <PageTitle title="Уроки школы" />
      <ErrorBox error={error} />
      {!data ? <Loading /> : <SchoolLessonList list={data.lessons} />}
    </>
  );
}

// == Администратор платформы ======================================================================
function BillingAdmin() {
  const [f, setF] = useState({ email: "", months: 1, use_discount: false });
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setError(null); setRes(null);
    try { setRes(await request("POST", "/site/v1/admin/billing", { ...f, months: Number(f.months) })); } catch (x) { setError(x); }
  };
  return (
    <Panel title="Продлить тариф" icon={CheckCircle2} className="lg:col-span-2">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="label min-w-[220px] flex-1">Почта преподавателя или школы<input className="field" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="label">Срок<select className="field" value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })}><option value={1}>1 месяц</option><option value={3}>3 месяца</option><option value={12}>12 месяцев</option></select></label>
        <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" checked={f.use_discount} onChange={(e) => setF({ ...f, use_discount: e.target.checked })} /> Скидка 50% за коллегу</label>
        <button type="submit" className="btn-brand">Продлить</button>
      </form>
      {res && <Notice tone="ok" className="mt-3">Продлено до {fmtDate(res.paid_until)}. К оплате: {res.price.toLocaleString("ru-RU")} ₽{res.teachers > 1 ? ` (${res.teachers} преподавателей)` : ""}{res.discount_used ? ", скидка применена" : ""}.</Notice>}
      <ErrorBox error={error} />
    </Panel>
  );
}

const FB = { idea: "💡 Идея", bug: "🐞 Ошибка", praise: "❤️ Спасибо", other: "✉️ Другое" };

export function AdminPage() {
  const feedback = useApi("/site/v1/admin/feedback");
  const reviews = useApi("/site/v1/admin/reviews");
  const teachers = useApi("/site/v1/admin/teachers");
  const market = useApi("/site/v1/admin/market");
  const apps = useApi("/site/v1/admin/applications");
  const setReview = (id, status) => request("POST", `/site/v1/admin/reviews/${id}`, { status }).then(reviews.reload);
  const setTeacher = (uid, status) => request("POST", `/site/v1/admin/teachers/${uid}`, { status }).then(teachers.reload);
  return (
    <>
      <PageTitle title="Администрирование" text="Модерация отзывов, анкет, заявок и биржи." />
      <div className="grid gap-4 lg:grid-cols-2">
        <BillingAdmin />
        <Panel title="Обратная связь" icon={Users} className="lg:col-span-2">
          {!feedback.data ? <Loading /> : !feedback.data.feedback.length ? <p className="text-sm text-ink-mute">Сообщений пока нет.</p> : (
            <ul className="grid max-h-96 gap-2 overflow-y-auto">{feedback.data.feedback.map((x) => (
              <li key={x.id} className="rounded-2xl border border-line p-3 text-sm"><b>{FB[x.kind] || (x.kind || "").replace("help:", "🆘 ")}</b> · {x.name || "–"} ({x.role || "не вошёл"}){x.contact ? ` · ${x.contact}` : ""} · {fmtDate(x.created_at)}<p className="mt-1 whitespace-pre-wrap text-ink-soft">{x.text}</p></li>))}</ul>
          )}
        </Panel>
        <Panel title="Отзывы" icon={Star}>
          {!reviews.data ? <Loading /> : !reviews.data.reviews.length ? <p className="text-sm text-ink-mute">Отзывов нет.</p> : (
            <ul className="grid gap-2">{reviews.data.reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-line p-3 text-sm">
                <div className="flex justify-between gap-2"><b>{r.author_name} · {r.rating}★</b><span className="chip">{r.status}</span></div>
                <p className="mt-1 text-ink-soft">{r.text}</p>
                <div className="mt-2 flex gap-2">
                  {r.status !== "approved" && <button type="button" className="btn-brand btn-sm" onClick={() => setReview(r.id, "approved")}>Опубликовать</button>}
                  {r.status !== "rejected" && <button type="button" className="btn-ghost btn-sm" onClick={() => setReview(r.id, "rejected")}>Отклонить</button>}
                </div>
              </li>))}</ul>
          )}
        </Panel>
        <Panel title="Анкеты преподавателей" icon={Users}>
          {!teachers.data ? <Loading /> : !teachers.data.teachers.length ? <p className="text-sm text-ink-mute">Анкет нет.</p> : (
            <ul className="grid gap-2">{teachers.data.teachers.map((t) => (
              <li key={t.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line p-3 text-sm">
                <span><b>{t.name}</b> <span className="text-ink-mute">{t.specialties}</span></span>
                <span className="flex gap-2"><span className="chip">{t.status}</span>
                  {t.status !== "approved" && <button type="button" className="btn-brand btn-sm" onClick={() => setTeacher(t.user_id, "approved")}>Одобрить</button>}
                  {t.status !== "rejected" && <button type="button" className="btn-ghost btn-sm" onClick={() => setTeacher(t.user_id, "rejected")}>Отклонить</button>}</span>
              </li>))}</ul>
          )}
        </Panel>
        <Panel title="Заявки биржи" className="lg:col-span-2">
          {!market.data ? <Loading /> : !market.data.requests.length ? <p className="text-sm text-ink-mute">Заявок нет.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-ink-mute"><tr>{["Дата", "Ученик", "Язык", "Бюджет", "Связь", "Откликов", "Статус"].map((h) => <th key={h} className="pb-2">{h}</th>)}</tr></thead>
              <tbody>{market.data.requests.map((r) => (
                <tr key={r.id} className="border-t border-line align-top"><td className="py-2">{fmtDate(r.created_at)}</td><td className="py-2">{r.name}<span className="block text-xs text-ink-mute">{r.goals}</span></td>
                  <td className="py-2">{r.language_ru}, {r.level_ru}</td><td className="py-2">{r.budget_ru}</td><td className="py-2">{r.contact}</td><td className="py-2">{r.proposals}</td><td className="py-2">{r.status}</td></tr>))}</tbody>
            </table></div>
          )}
        </Panel>
        {apps.data?.applications?.length > 0 && (
          <Panel title="Заявки с сайта" className="lg:col-span-2">
            <ul className="grid gap-2">{apps.data.applications.map((a) => <li key={a.id} className="rounded-2xl border border-line p-3 text-sm"><b>{a.name}</b> · {a.contact} · {fmtDate(a.created_at)}<span className="block text-ink-mute">{[a.course_id, a.level, a.goal, a.comment].filter(Boolean).join(" · ")}</span></li>)}</ul>
          </Panel>
        )}
      </div>
      <Notice className="mt-6">Сигналы о нарушениях приходят администратору в Telegram.</Notice>
    </>
  );
}
