import { ArrowLeft, BookOpen, Check, Copy, FileStack, MessageCircle, NotebookPen, Plus, Trash2, Wallet, X } from "lucide-react";
import { useState } from "react";
import { request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { Empty, ErrorBox, Loading, Notice, Tabs } from "../ui/kit.jsx";
import { Conversation, LessonList, Panel, startLesson, useApi } from "./common.jsx";
import { ProfileAvatar } from "./decor.jsx";
import { AssignForm, HomeworkItem } from "./homework.jsx";
import { LANGS } from "../lib/langs.js";
import { Vocab } from "./vocab.jsx";
import Schedule from "./Schedule.jsx";

function StartLesson({ student }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(null);
  if (student.active_lesson) return <a className="btn-brand" href={`#/room/${student.active_lesson}`}>Вернуться в урок</a>;
  return <div><button type="button" className="btn-brand" disabled={busy || !student.joined} onClick={async () => {
    setBusy(true); setError(null);
    try { await startLesson(student.chat_id); } catch (e) { setError(e); setBusy(false); }
  }}><BookOpen size={16} /> {busy ? "Открываем…" : "Начать урок"}</button><ErrorBox error={error} /></div>;
}

function StudentPayment({ student, compact = false, onOpen }) {
  const session = useSession();
  const { data, error, reload } = useApi("/site/v1/lesson-pay");
  const [problem, setProblem] = useState(null), [busy, setBusy] = useState(false);
  const item = data?.items?.find((row) => row.pair_id === student.pair_id);
  const act = async (path, body) => {
    setProblem(null); setBusy(true);
    try { await request("POST", path, body); await Promise.all([reload(), session.reload()]); }
    catch (err) { setProblem(err); }
    setBusy(false);
  };
  return <Panel title="Оплата занятий" icon={Wallet} actions={compact ? <button type="button" className="link text-sm" onClick={onOpen}>Открыть</button> : <a href="#/app/students?view=pay" className="link text-sm">Общие настройки</a>}>
    <ErrorBox error={error || problem} />
    {!data && !error ? <Loading /> : !item && !error ? <p className="text-sm text-ink-soft">Оплата занятий не включена. <a href="#/app/students?view=pay" className="link">Настроить оплату</a></p> : item && <div className="grid gap-4">
      <div className="rounded-2xl bg-brand-tint p-4"><p className="text-sm text-ink-soft">Баланс занятий</p><p className="mt-1 text-2xl font-bold">{item.balance}</p><p className="mt-1 text-sm text-ink-soft">Цена одного занятия: {Number(item.price).toLocaleString("ru-RU")} ₽</p></div>
      {compact ? item.pending.length > 0 && <p className="text-sm text-ink-soft">Ожидают подтверждения: {item.pending.length}</p> : <>
        {item.pending.map((p) => <div key={p.id} className="rounded-xl border border-line p-3"><p className="text-sm"><b>Ожидает подтверждения:</b> {p.count} занятий · {Number(p.amount).toLocaleString("ru-RU")} ₽</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} className="btn-brand btn-sm" onClick={() => act("/site/v1/lesson-pay/decide", { id: p.id, action: "confirm" })}><Check size={14} /> Деньги пришли</button><button type="button" disabled={busy} className="btn-light btn-sm" onClick={() => act("/site/v1/lesson-pay/decide", { id: p.id, action: "reject", note: "Перевод не найден" })}><X size={14} /> Не пришли</button></div></div>)}
        <div><p className="text-sm font-semibold">Изменить баланс вручную</p><div className="mt-2 flex flex-wrap gap-2">{[-1, 1, 4].map((delta) => <button type="button" key={delta} disabled={busy} className="btn-light btn-sm" onClick={() => act("/site/v1/lesson-pay/adjust", { pair_id: student.pair_id, delta })}>{delta > 0 ? `+${delta}` : delta}</button>)}</div></div>
        <p className="text-xs text-ink-mute">Перевод проходит напрямую; подтвердите поступление денег перед зачислением занятий.</p>
      </>}
    </div>}
  </Panel>;
}

function InvitationField({ label, value }) {
  const [result, setResult] = useState("");
  if (!value) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setResult("Скопировано"); }
    catch { setResult("Выделите и скопируйте вручную."); }
  };
  return <label className="label">{label}<span className="flex flex-wrap gap-2"><input className="field min-w-0 flex-1" readOnly value={value} onFocus={(e) => e.target.select()} /><button type="button" className="btn-light" onClick={copy}><Copy size={15} /> Копировать</button></span>{result && <span role="status" className="font-normal">{result}</span>}</label>;
}

function StudentSettings({ student, onUpdated }) {
  const [problem, setProblem] = useState(null), [busy, setBusy] = useState(false);
  const changeLanguage = async (event) => {
    setBusy(true); setProblem(null);
    try { await request("POST", `/site/v1/students/${student.pair_id}/language`, { language: event.target.value }); await onUpdated(); }
    catch (error) { setProblem(error); }
    setBusy(false);
  };
  const remove = async () => {
    if (!window.confirm(`Удалить ученика «${student.name}»? Уроки и конспекты сохранятся в архиве.`)) return;
    setBusy(true); setProblem(null);
    try { await request("POST", `/site/v1/students/${student.pair_id}/remove`, {}); window.location.hash = "#/app/students"; }
    catch (error) { setProblem(error); setBusy(false); }
  };
  return <div className="grid gap-4"><Panel title="Настройки ученика"><div className="grid gap-4">
    <label className="label">Изучаемый язык<select className="field" disabled={busy} value={student.language} onChange={changeLanguage}>{LANGS.map((language) => <option key={language.id} value={language.id}>{language.flag} {language.title}</option>)}</select></label>
    {!student.joined && <><InvitationField label="Код ученика" value={student.invite?.code} /><InvitationField label="Ссылка для ученика" value={student.invite?.url} /></>}
    <InvitationField label="Ссылка для родителя" value={student.parent_invite?.url} />
    <ErrorBox error={problem} /><button type="button" disabled={busy} className="btn-ghost w-fit text-teach-deep" onClick={remove}><Trash2 size={16} /> Удалить ученика</button>
  </div></Panel></div>;
}

export default function StudentWorkspace({ student, route, onUpdated }) {
  const { me } = useSession();
  const [tab, setTab] = useState(() => ["overview", "chat", "schedule", "homework", "lessons", "words", "payment", "settings"].includes(route?.params?.get("tab")) ? route.params.get("tab") : "overview");
  const homework = useApi(student.joined ? "/site/v1/homework" : null);
  const tasks = (homework.data?.homework || []).filter((h) => h.chat_id === student.chat_id);
  const lessons = (me?.lessons || []).filter((lesson) => lesson.chat_id === student.chat_id).map((lesson) => ({ ...lesson, with: student.name }));
  const lang = LANGS.find((language) => language.id === student.language);
  return <>
    <a href="#/app/students" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-brand"><ArrowLeft size={16} /> Все ученики</a>
    <section className="rounded-3xl border border-[#d4e2f6] bg-[#edf4ff] p-5 md:p-7">
      <div className="flex flex-wrap items-center gap-4"><ProfileAvatar photo={student.photo} name={student.name} size={64} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-brand">КАРТОЧКА УЧЕНИКА</p><h1 className="mt-1 break-words text-3xl">{student.name}</h1><p className="mt-2 text-sm text-ink-soft">{lang ? `${lang.flag} ${lang.title} · ` : ""}{student.joined ? "подключён к Bright" : "ожидает подключения"}</p></div><div className="w-full sm:w-auto"><StartLesson student={student} /></div></div>
      {student.english_placement && <p className="mt-3 text-sm text-ink-soft">Английский: предварительно <strong>{student.english_placement.level}</strong> · грамматика и словарь</p>}
      {student.duolingo_result && <p className="mt-2 text-sm text-ink-soft">Duolingo English Test: <strong>{student.duolingo_result.score_min}{student.duolingo_result.score_min !== student.duolingo_result.score_max ? `–${student.duolingo_result.score_max}` : ""}</strong> · {student.duolingo_result.kind === "practice" ? "тренировочный" : "официальный"}, введён учеником, не проверен</p>}
      {student.joined ? <div className="mt-5 flex flex-wrap gap-2"><button type="button" className="btn-light" onClick={() => setTab("chat")}><MessageCircle size={16} /> Написать</button><button type="button" className="btn-light" onClick={() => setTab("homework")}><Plus size={16} /> Выдать задание</button></div>
        : <div className="mt-5 rounded-xl bg-white p-4"><p className="text-sm text-ink-soft">Передайте ученику код: он сможет подключиться на сайте или в приложении.</p><button type="button" className="btn-light btn-sm mt-3" onClick={() => setTab("settings")}>Открыть приглашение</button></div>}
    </section>
    <div className="my-5 overflow-x-auto pb-1"><Tabs label="Карточка ученика" value={tab} onChange={setTab} items={[{ id:"overview", title:"Обзор" }, { id:"chat", title:"Чат" }, { id:"schedule", title:"Расписание" }, { id:"homework", title:"Домашние задания" }, { id:"lessons", title:"Уроки" }, { id:"words", title:"Слова" }, { id:"payment", title:"Оплата" }, { id:"settings", title:"Настройки" }]} /></div>
    {tab === "overview" && <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Домашние задания" icon={NotebookPen} actions={<button type="button" className="link text-sm" onClick={() => setTab("homework")}>Все задания</button>}>
        <ErrorBox error={homework.error} />{homework.error ? null : student.joined && !homework.data ? <Loading /> : tasks.length ? <ul className="grid gap-2">{tasks.slice(0, 3).map((h) => <li key={h.id} className="rounded-xl bg-cream p-3 text-sm"><p className="line-clamp-2 font-semibold">{h.text}</p><p className="mt-1 text-ink-mute">{{open:"Задано",done:"Нужно проверить",checked:"Проверено"}[h.status] || h.status}</p></li>)}</ul> : <p className="text-sm text-ink-soft">Заданий пока нет.</p>}
      </Panel>
      <Panel title="Последние уроки" icon={BookOpen} actions={<button type="button" className="link text-sm" onClick={() => setTab("lessons")}>Все уроки</button>}><LessonList lessons={lessons} limit={3} empty="Проведённые уроки появятся здесь." /></Panel>
      <StudentPayment student={student} compact onOpen={() => setTab("payment")} />
      <Panel title="Материалы и слова" icon={FileStack}><p className="text-sm text-ink-soft">Откройте словарь ученика или выберите готовое занятие и материалы для задания.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn-light btn-sm" disabled={!student.joined} onClick={() => setTab("words")}>Словарь ученика</button><button type="button" className="btn-light btn-sm" onClick={() => setTab("homework")}>Выдать материалы</button><a href="#/app/materials" className="btn-light btn-sm">Все материалы</a></div></Panel>
    </div>}
    {tab === "homework" && <div className="grid items-start gap-4 lg:grid-cols-[1fr_1.2fr]"><AssignForm key={student.pair_id} student={student} onDone={homework.reload} /><div className="grid gap-3"><ErrorBox error={homework.error} />{homework.error ? null : student.joined && !homework.data ? <Loading /> : tasks.length ? tasks.map((h) => <HomeworkItem key={h.id} h={h} reload={homework.reload} />) : <Empty icon={NotebookPen} title="Заданий пока нет" text="Выданные задания и ответы ученика появятся здесь." />}</div></div>}
    {tab === "chat" && (student.joined ? <Conversation key={student.chat_id} chatId={student.chat_id} title={student.name} onBack={() => setTab("overview")} /> : <Notice>Чат появится после подключения ученика.</Notice>)}
    {tab === "schedule" && <Schedule student={student} />}
    {tab === "lessons" && <Panel title="Уроки ученика" icon={BookOpen}><LessonList lessons={lessons} empty="Проведённые уроки появятся здесь." /></Panel>}
    {tab === "words" && (student.joined ? <Vocab chatId={student.chat_id} tutorView /> : <Notice>Словарь станет доступен после подключения ученика.</Notice>)}
    {tab === "payment" && <StudentPayment student={student} />}
    {tab === "settings" && <StudentSettings student={student} onUpdated={onUpdated} />}
  </>;
}
