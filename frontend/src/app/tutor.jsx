import {
  Check, CheckCircle2, ChevronRight, Clapperboard, Copy, File, FileStack, Gift, Link2, NotebookPen, PenTool, Plus, Search, Upload,
  UserPlus, Users, Video,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getToken, request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { PricingCards } from "../site/parts.jsx";
import { PERIOD_TITLE, perDay, rub } from "../lib/pricing.js";
import { useConfig } from "../lib/config.js";
import { ProfileAvatar } from "./decor.jsx";
import { HolidayBanner, MoodChip } from "./extras.jsx";
import { SparkMark } from "./spark.jsx";
import { Avatar, copy, Empty, ErrorBox, Loading, Modal, Notice, PageTitle, Stat } from "../ui/kit.jsx";
import { LessonList, LiveBanner, Panel, shortDate, startLesson, useApi } from "./common.jsx";
import { LANGS } from "../lib/langs.js";
import StudentWorkspace from "./StudentWorkspace.jsx";
import { HomeworkPage } from "./homework.jsx";
import { LessonPayPage } from "./lessonpay.jsx";

function CopyLink({ label, url }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!url) return null;
  return (
    <button type="button" className="btn-light btn-sm" onClick={async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
        await navigator.clipboard.writeText(url); setFailed(false); setDone(true); setTimeout(() => setDone(false), 1600);
      } catch { setFailed(true); }
    }}>
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Скопировано" : failed ? "Выделите и скопируйте вручную" : label}
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

// == Сегодня ==================================================================================
function Checklist({ students, lessons }) {
  const steps = [
    ["Добавьте первого ученика", students.length > 0, "#/app/students", "Добавить"],
    ["Отправьте ему ссылку-приглашение", students.some((s) => s.joined), "#/app/students", "Скопировать"],
    ["Проведите пробный урок", lessons.some((l) => l.status === "finished"), "#/app/students", "Начать урок"],
  ];
  if (steps.every((x) => x[1])) return null;
  const next = steps.findIndex((x) => !x[1]);
  return (
    <Panel title="Три шага до первого урока" className="mb-4">
      <ol className="grid gap-1.5">
        {steps.map(([t, done, href, cta], i) => (
          <li key={t} className={`flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2.5 ${i === next ? "bg-sun-soft" : ""}`}>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${done ? "bg-mint text-white" : i === next ? "bg-ink text-white" : "bg-cream text-ink-mute"}`}>{done ? <Check size={14} /> : i + 1}</span>
            <span className={`min-w-0 flex-1 text-[15px] ${done ? "text-ink-mute line-through" : "font-medium"}`}>{t}</span>
            {i === next && <a href={href} className="btn-brand btn-sm">{cta}</a>}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function TutorHome() {
  const { account, me } = useSession();
  const { data, error } = useApi("/site/v1/students");
  const pay = useApi("/site/v1/lesson-pay").data;
  const hw = useApi("/site/v1/homework").data?.homework || [];
  const students = data?.students || [];
  const titles = Object.fromEntries((me?.chats || []).map((c) => [c.chat_id, c.title]));
  const lessons = (me?.lessons || []).map((l) => ({ ...l, with: titles[l.chat_id] }));
  const toCheck = hw.filter((h) => h.status === "done");
  const review = lessons.filter((l) => l.on_review);
  const todo = [
    ...review.map((l) => ({ key: `r${l.id}`, text: `Проверить и отправить конспект: ${l.with || l.title}`, href: `#/lesson/${l.id}`, cta: "Открыть" })),
    ...(toCheck.length ? [{ key: "hw", text: `Проверить домашку: ${toCheck.length}`, href: "#/app/students?view=homework", cta: "Проверить" }] : []),
    ...(pay?.pending_total ? [{ key: "pay", text: `Подтвердить оплату: ${pay.pending_total}`, href: "#/app/students?view=pay", cta: "Посмотреть" }] : []),
    ...(me?.unread ? [{ key: "msg", text: `Новые сообщения: ${me.unread}`, href: "#/app/messages", cta: "Ответить" }] : []),
  ];
  const today = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  return (
    <>
      <PageTitle title={`Здравствуйте, ${(account?.name || "").split(" ")[0] || "коллега"}`} text={today.charAt(0).toUpperCase() + today.slice(1)}
        actions={<a href="#/app/students" className="btn-brand"><UserPlus size={16} /> Ученик</a>} />
      <HolidayBanner />
      <LiveBanner lessons={lessons} />
      {data && <Checklist students={students} lessons={lessons} />}
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="grid content-start gap-4">
          <Panel title="Начать урок" icon={Video} actions={<a href="#/app/students" className="text-[13px] font-medium text-ink-mute hover:text-ink">Все ученики</a>}>
            {error ? <p className="text-sm text-ink-mute">Вы вошли через Telegram-бота. <a className="link" href="#/register?role=tutor">Зарегистрируйтесь на сайте</a>, чтобы приглашать учеников по ссылке.</p> : !data ? <Loading /> : !students.length ? (
              <p className="py-1 text-sm text-ink-mute">Добавьте ученика: он получит ссылку и зайдёт на урок с телефона или компьютера.</p>
            ) : (
              <ul className="-mx-2 grid">
                {students.slice(0, 8).map((s) => (
                  <li key={s.pair_id} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-cream">
                    <ProfileAvatar photo={s.photo} name={s.name} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold"><a className="truncate hover:text-brand" href={`#/app/students/${s.pair_id}`}>{s.name}</a> <MoodChip mood={s.mood} /></span>
                      <span className="block truncate text-[13px] text-ink-mute">{s.joined ? (LANGS.find((l) => l.id === s.language)?.title || "") : "ждём по ссылке"}{s.balance ? ` · оплачено: ${s.balance}` : ""}</span>
                    </span>
                    {s.joined && <StartButton chatId={s.chat_id} active={s.active_lesson} small />}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Последние уроки" icon={NotebookPen}><LessonList lessons={lessons} limit={5} empty="Проведите первый урок, и конспект появится здесь." /></Panel>
        </div>
        <div className="grid content-start gap-4">
          <Panel title="Нужно сделать" icon={CheckCircle2}>
            {todo.length ? (
              <ul className="-mx-2 grid">{todo.map((t) => (
                <li key={t.key}><a href={t.href} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-cream">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-teach" /><span className="min-w-0 flex-1 text-[15px]">{t.text}</span><span className="text-[13px] font-medium text-ink-mute">{t.cta}</span>
                </a></li>))}
              </ul>
            ) : <p className="py-1 text-sm text-ink-mute">{students.length ? "Пока нет заданий на проверку или новых сообщений." : "Здесь появятся задания и сообщения, когда ученик подключится."}</p>}
          </Panel>
          <div className="grid grid-cols-2 gap-3">
            <Stat value={students.length} label="учеников" href="#/app/students" />
            <Stat value={lessons.filter((l) => l.status === "finished").length} label="уроков проведено" href="#/app/lessons" />
          </div>
          <a href="#/app/spark" className="panel flex items-center gap-3 !border-sun/60 !bg-sun-soft/60 p-4 transition hover:!border-sun">
            <SparkMark size={58} still={false} />
            <span className="min-w-0"><span className="block font-semibold">Искорка</span><span className="text-[13px] text-ink-mute">План урока, упражнения, письмо родителям. Можно голосом</span></span>
          </a>
          <a href="#/market?tab=students" className="panel flex items-center gap-3 p-4 transition hover:border-ink/25">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cream"><Search size={18} /></span>
            <span className="min-w-0"><span className="block font-semibold">Заявки учеников</span><span className="text-[13px] text-ink-mute">Ученики ищут преподавателя: откликнитесь со своей ценой</span></span>
          </a>
        </div>
      </div>
    </>
  );
}

function StudyGroups({ students }) {
  const { data, error, reload } = useApi("/site/v1/groups");
  const [draft, setDraft] = useState(null);
  const [problem, setProblem] = useState(null);
  const save = async (event) => {
    event.preventDefault();
    try {
      setProblem(null);
      await request("POST", "/site/v1/groups", draft);
      setDraft(null);
      reload();
    } catch (e) { setProblem(e); }
  };
  const remove = async (group) => {
    if (!window.confirm(`Удалить класс «${group.title}»? Ученики и их задания сохранятся.`)) return;
    try { await request("POST", `/site/v1/groups/${group.id}/delete`, {}); reload(); }
    catch (e) { setProblem(e); }
  };
  return <section className="mb-5 rounded-2xl border border-line bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">Классы</h2>
      <button type="button" className="btn-light btn-sm" onClick={() => setDraft({ title: "", members: [] })}><Plus size={14} /> Создать класс</button>
    </div>
    <p className="mt-1 text-sm text-ink-mute">Объединяйте своих учеников, чтобы выдавать им занятия.</p>
    <ErrorBox error={error || problem} />
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {(data?.groups || []).map((g) => <div key={g.id} className="rounded-xl border border-line p-3">
        <p className="font-semibold">{g.title}</p>
        <p className="text-sm text-ink-mute">{g.members.map((id) => students.find((s) => s.pair_id === id)?.name).filter(Boolean).join(", ") || "Пока нет учеников"}</p>
        {g.members.length > 0 && <details className="mt-3 border-t border-line pt-3"><summary className="cursor-pointer text-sm font-semibold">Ученики класса</summary>
          <div className="mt-2 grid gap-2">{g.members.map((id) => students.find((student) => student.pair_id === id)).filter(Boolean).map((student) => <div key={student.pair_id} className="flex flex-wrap items-center gap-3 rounded-xl bg-cream p-2">
            <ProfileAvatar photo={student.photo} name={student.name} size={32} /><a href={`#/app/students/${student.pair_id}`} className="min-w-0 flex-1 text-sm font-medium hover:text-brand">{student.name}</a>
            {student.joined ? <StartButton chatId={student.chat_id} active={student.active_lesson} small /> : <CopyLink label="Приглашение" url={student.invite?.url} />}
          </div>)}</div></details>}
        <div className="mt-3 flex flex-wrap gap-2"><a href="#/app/units/new" className="btn-light btn-sm">Создать урок</a><a href="#/app/materials?tab=units" className="btn-light btn-sm">Мои занятия</a></div>
        <div className="mt-2 flex gap-2"><button type="button" className="btn-light btn-sm" onClick={() => setDraft(g)}>Изменить</button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => remove(g)}>Удалить</button></div>
      </div>)}
    </div>
    <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Изменить класс" : "Новый класс"}>
      {draft && <form className="grid gap-3" onSubmit={save}>
        <label className="label">Название<input className="field" required maxLength={100} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <p className="text-sm font-semibold">Ученики</p>
        <div className="grid max-h-60 gap-2 overflow-y-auto">{students.map((student) => <label key={student.pair_id} className="flex gap-2 text-sm">
          <input type="checkbox" checked={draft.members.includes(student.pair_id)} onChange={(e) => setDraft({ ...draft, members: e.target.checked ? [...draft.members, student.pair_id] : draft.members.filter((id) => id !== student.pair_id) })} />{student.name}
        </label>)}</div>
        <ErrorBox error={problem} /><button type="submit" className="btn-brand">Сохранить класс</button>
      </form>}
    </Modal>
  </section>;
}

// == Ученики ==================================================================================
export function StudentsPage({ route }) {
  const { data, error, reload } = useApi("/site/v1/students");
  const [name, setName] = useState("");
  const [added, setAdded] = useState(null);
  const [lang, setLang] = useState("en");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState(null);
  const add = async (e) => {
    e.preventDefault(); setErr(null);
    try { setAdded({ name, ...(await request("POST", "/site/v1/students", { name, language: lang })) }); setName(""); setAdding(false); reload(); } catch (x) { setErr(x); }
  };
  const list = data?.students || [];
  const studentId = route?.parts?.[2];
  if (studentId) {
    if (error) return <ErrorBox error={error} />;
    if (!data) return <Loading />;
    const selected = list.find((student) => student.pair_id === studentId);
    return selected ? <StudentWorkspace key={studentId} student={selected} route={route} onUpdated={reload} /> : <Empty icon={Users} title="Ученик не найден" text="Карточка недоступна или ученик удалён." action={<a href="#/app/students" className="btn-light">Все ученики</a>} />;
  }
  const requestedView = route?.params?.get("view");
  const view = ["classes", "homework", "pay"].includes(requestedView) ? requestedView : "students";
  const sections = [["students", "Ученики", "#/app/students"], ["classes", "Классы", "#/app/students?view=classes"], ["homework", "Домашние задания", "#/app/students?view=homework"], ["pay", "Оплата занятий", "#/app/students?view=pay"], ["find", "Заявки", "#/market?tab=students"]];
  const tabs = <nav aria-label="Работа с учениками" className="mb-6 flex flex-wrap gap-1.5 border-b border-line pb-3">{sections.map(([id, label, href]) => <a key={id} href={href} aria-current={view === id ? "page" : undefined} className={`rounded-xl px-3 py-2 text-sm font-semibold ${view === id ? "bg-brand-tint text-brand-deep" : "text-ink-soft hover:bg-cream"}`}>{label}</a>)}</nav>;
  if (view === "homework") return <>{tabs}<HomeworkPage /></>;
  if (view === "pay") return <>{tabs}<LessonPayPage /></>;
  if (view === "classes") return <><PageTitle title="Классы" text="Объединяйте учеников для занятий и заданий." />{tabs}<ErrorBox error={error} />{data ? <StudyGroups students={list} /> : !error && <Loading />}</>;
  return (
    <>
      <PageTitle title="Ученики" text="Ученик и родитель подключаются по ссылкам и видят только ваше имя."
        actions={<button type="button" className="btn-brand" onClick={() => setAdding(true)}><UserPlus size={16} /> Добавить ученика</button>} />
      {tabs}
      <ErrorBox error={error || err} />
      {!data && !error ? <Loading /> : !data ? null : !list.length ? (
        <Empty icon={Users} title="Учеников пока нет" text="Добавьте ученика и отправьте ему ссылку в любом мессенджере. Регистрация у него займёт минуту."
          action={<button type="button" className="btn-brand" onClick={() => setAdding(true)}><UserPlus size={16} /> Добавить ученика</button>} />
      ) : (
        <div className="panel divide-y divide-line">
          {list.map((s) => (
            <a key={s.pair_id} href={`#/app/students/${s.pair_id}`} className="flex items-center gap-3 p-4 transition hover:bg-brand-tint/50">
              <ProfileAvatar photo={s.photo} name={s.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">{s.name} <MoodChip mood={s.mood} /></p>
                <p className="text-[13px] text-ink-mute">{s.joined ? "подключён" : "ещё не подключился"} · родителей: {s.parents}{s.balance ? ` · оплачено занятий: ${s.balance}` : ""}</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-ink-mute" />
            </a>
          ))}
        </div>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title="Новый ученик">
        <form onSubmit={add} className="grid gap-3">
          <label className="label">Имя ученика<input className="field" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Миша" autoFocus /></label>
          <label className="label">Какой язык изучает
            <select className="field" value={lang} onChange={(e) => setLang(e.target.value)}>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.flag} {l.title}</option>)}</select>
          </label>
          <button type="submit" className="btn-brand"><UserPlus size={16} /> Добавить и получить код</button>
        </form>
      </Modal>
      <Modal open={!!added} onClose={() => setAdded(null)} title={`${added?.name || "Ученик"} добавлен`}>
        <p className="text-ink-soft">Отправьте ученику код: он сможет ввести его в своём кабинете на сайте или в приложении. Можно также отправить ссылку.</p>
        <div className="mt-4 rounded-xl bg-brand-tint p-4"><p className="text-sm font-semibold">Код ученика</p><p className="mt-1 break-all text-lg font-bold">{added?.invite?.code}</p><div className="mt-2"><CopyLink label="Скопировать код" url={added?.invite?.code} /></div><p className="mt-2 text-xs text-ink-mute">Код личный, для одного ученика. Сохраните его в тайне.</p></div>
        <div className="mt-4 grid gap-3">
          {[["Ученику", added?.invite?.url], ["Родителю (отчёты и переписка)", added?.parent_invite?.url]].map(([t, url]) => (
            <div key={t}><p className="mb-1 text-sm font-semibold">{t}</p><div className="flex gap-2"><input readOnly className="field text-sm" value={url || ""} onFocus={(e) => e.target.select()} aria-label={t} /><CopyLink label="Копировать" url={url} /></div></div>
          ))}
        </div>
      </Modal>
    </>
  );
}

// == Тариф ======================================================================================
const fmtUntil = (iso) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export function BillingStatus({ billing, compact }) {
  if (!billing || billing.state === "free") return null;
  if (billing.lifetime) return compact ? null : <Notice tone="ok">Постоянный бесплатный доступ ко всем функциям{billing.by_school ? " по тарифу школы" : ""}.</Notice>;
  if (billing.state === "active") return compact ? null : <Notice tone="ok">Тариф оплачен до {fmtUntil(billing.until)}{billing.by_school ? ", оплачивает школа" : ""}.</Notice>;
  if (billing.state === "trial") {
    const left = billing.days_left >= 1 ? `${billing.days_left + 1} дн.` : `${Math.max(1, billing.hours_left)} ч.`;
    return <Notice className={compact ? "mb-4" : ""}>Пробный период: осталось {left} Все функции открыты. {compact && !billing.by_school && <a href="#/app/plan" className="link">Оплатить со скидкой</a>}</Notice>;
  }
  return (
    <Notice tone="bad" className={compact ? "mb-4" : ""}>
      {billing.by_school ? "Срок тарифа школы закончился: попросите школу продлить доступ." : "Пробный период закончился. Ученики и материалы сохранены, оформите тариф, чтобы проводить новые уроки."}
      {compact && !billing.by_school && <> <a href="#/app/plan" className="link">Оформить</a></>}
    </Notice>
  );
}

function PayPanel({ account }) {
  const cfg = useConfig();
  const { data, error, reload } = useApi("/site/v1/billing");
  const session = useSession();
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [note, setNote] = useState(null);
  const [asked, setAsked] = useState(false);

  // Вернулись со страницы оплаты (?paid=...): уточняем у сервера, дошли ли деньги
  useEffect(() => {
    const id = new URLSearchParams(window.location.hash.split("?")[1] || "").get("paid");
    if (!id) return undefined;
    let tries = 0;
    const tick = async () => {
      try {
        const res = await request("POST", "/site/v1/billing/check", { id });
        if (res.status === "succeeded") { setNote({ tone: "ok", text: "Оплата получена, тариф продлён. Спасибо!" }); session.reload(); reload(); return; }
        if (res.status === "canceled") { setNote({ tone: "bad", text: "Оплата не прошла. Деньги не списаны, можно попробовать ещё раз." }); return; }
      } catch (x) { setNote({ tone: "bad", text: x.message }); return; }
      if (++tries < 10) timer = setTimeout(tick, 3000); else setNote({ tone: "warn", text: "Платёж ещё обрабатывается. Как только он дойдёт, тариф продлится сам. Если этого не случилось, напишите нам через «?»." });
    };
    let timer = setTimeout(tick, 500);
    setNote({ tone: "info", text: "Проверяем оплату…" });
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  if (!data.can_pay) return <Notice>За вас платит школа. Если доступ закончился, напишите владельцу школы.</Notice>;
  const q = data.quotes.find((x) => x.months === months) || data.quotes[0];
  const pay = async (method) => {
    setBusy(true); setErr(null);
    try { window.location.href = (await request("POST", "/site/v1/billing/pay", { months, method })).url; } catch (x) { setErr(x); setBusy(false); }
  };
  const ask = async () => {
    await request("POST", "/site/v1/support", { kind: "payment", text: `Хочу оплатить тариф на ${months} мес. (${rub(q.total)}). Почта: ${account?.email}` }).catch(() => {});
    setAsked(true);
  };
  const perMonth = Math.round(q.total / q.months);
  return (
    <div className="card mt-5">
      {note && <Notice tone={note.tone} className="mb-4">{note.text}</Notice>}
      <div role="tablist" aria-label="Срок" className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-white p-1">
        {data.quotes.map((x) => (
          <button key={x.months} type="button" role="tab" aria-selected={months === x.months} onClick={() => setMonths(x.months)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${months === x.months ? "bg-ink text-white" : "text-ink-soft hover:bg-cream"}`}>{PERIOD_TITLE[x.months]}</button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-1">
        {q.percent > 0 && <span className="num text-2xl text-ink-mute line-through">{rub(q.base)}</span>}
        <span className="num font-display text-5xl font-extrabold">{rub(q.total)}</span>
        <span className="pb-1 text-sm text-ink-mute">{q.months > 1 ? `${rub(perMonth)} в месяц, ${perDay(perMonth)} ₽ в день` : `${perDay(q.total)} ₽ в день`}</span>
      </div>
      {q.reason === "first" && <p className="mt-2 text-sm font-semibold text-mint">Скидка {q.percent}% на первый месяц применена.</p>}
      {q.reason === "referral" && <p className="mt-2 text-sm font-semibold text-mint">Применена скидка {q.percent}% за приглашённого коллегу.</p>}
      {data.teachers > 1 && <p className="mt-1 text-sm text-ink-mute">Преподавателей в школе: {data.teachers}</p>}
      {data.state.state === "trial" && <p className="mt-1 text-sm text-ink-mute">Оставшиеся пробные дни не сгорят: срок отсчитывается после них.</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        {data.online ? (
          <>
            <button type="button" className="btn-brand btn-lg" disabled={busy} onClick={() => pay("sbp")}>{busy ? "Переходим…" : "Оплатить через СБП"}</button>
            <button type="button" className="btn-light btn-lg" disabled={busy} onClick={() => pay("card")}>Картой</button>
          </>
        ) : (
          <button type="button" className="btn-brand btn-lg" disabled={asked} onClick={ask}>{asked ? "Заявка отправлена" : "Оформить"}</button>
        )}
      </div>
      {!data.online && <p className="mt-3 text-sm text-ink-mute">Онлайн-оплата скоро заработает. Пока нажмите кнопку: мы напишем на {account?.email} и продлим доступ вручную. Вопросы: {cfg.support_email}.</p>}
      {data.online && <p className="mt-3 text-xs text-ink-mute">Платёж принимает ЮKassa. Автоматических списаний нет, продлевать нужно самому.</p>}
      <ErrorBox error={err} />
      {data.history.some((h) => h.status === "succeeded") && (
        <details className="mt-5 text-sm"><summary className="cursor-pointer font-semibold text-ink-soft">История оплат</summary>
          <ul className="mt-2 grid gap-1 text-ink-soft">{data.history.filter((h) => h.status === "succeeded").map((h) => <li key={h.id}>{new Date(h.created_at).toLocaleDateString("ru-RU")}: {rub(h.amount)} за {h.months} мес.</li>)}</ul></details>
      )}
    </div>
  );
}

export function PlanPage() {
  const session = useSession();
  const { account } = session;
  const [copied, setCopied] = useState(false);
  const ref = account?.referral;
  const byOrg = account?.org && account.role === "tutor";
  return (
    <>
      <PageTitle title="Тариф" text={byOrg ? `Вы преподаёте в школе «${account.org.name}», доступ оплачивает школа.` : "Один тариф, все функции платформы."} />
      <BillingStatus billing={account?.billing} />
      {!byOrg && !account?.billing?.lifetime && <PayPanel account={account} />}
      {!byOrg && <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-ink-soft">Что входит в тариф</summary><div className="mt-3"><PricingCards inApp /></div></details>}
      {ref && (
        <div className="card mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-xl"><Gift size={20} className="text-brand" /> Скидка 50% за коллегу</h2>
            <p className="mt-2 text-sm text-ink-soft">Отправьте ссылку коллеге. Когда он оформит тариф, ваше следующее продление будет за полцены. Скидки за разных коллег копятся.</p>
            <div className="mt-3 flex gap-2"><input readOnly className="field text-sm" value={ref.link} onFocus={(e) => e.target.select()} aria-label="Ваша ссылка" />
              <button type="button" className="btn-light" onClick={() => { copy(ref.link); setCopied(true); }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat value={ref.invited} label="пришли" />
            <Stat value={ref.paid} label="оплатили" tone="mint" />
            <Stat value={ref.discounts} label="скидок −50%" tone="sun" />
          </div>
        </div>
      )}
    </>
  );
}

