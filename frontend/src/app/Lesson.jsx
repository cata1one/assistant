import {
  ArrowLeft, BookOpen, CheckCircle2, Copy, Repeat, Trophy, Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fluentSrc } from "../board/stickers.js";
import { fmtDate, plural, request } from "../lib/api.js";
import { ttsOf } from "../lib/langs.js";
import { Bullets, ErrorBox, Loading, Notice, PageTitle, Tabs } from "../ui/kit.jsx";
import { Flashcard, Panel, useApi } from "./common.jsx";
import Iskorka from "./Iskorka.jsx";
import { speak } from "./player.jsx";
import Quest from "./quest.jsx";

const Back = () => <a href="#/app/lessons" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-ink-mute hover:text-ink"><ArrowLeft size={14} /> Все уроки</a>;

function Student({ res, id }) {
  return (
    <>
      <Back />
      <PageTitle title={res.report.topic || res.title || "Конспект урока"} text={`${fmtDate(res.started_at)} · ${res.with}`} />
      <StudentBody r={res.report} id={id} />
    </>
  );
}

/** Тест урока в режиме Duolingo: вопросы с вариантами – плитки, без вариантов – поле ответа. */
function lessonQuest(r, id) {
  const choice = [], gaps = [];
  r.test.forEach((q, k) => (q.options?.length ? choice : gaps).push(k));
  const blocks = [];
  if (choice.length) blocks.push({ type: "choice", title: "Проверь себя", questions: choice.map((k) => ({ q: r.test[k].question, options: r.test[k].options })) });
  gaps.forEach((k) => blocks.push({ type: "gap", title: "Напишите ответ", parts: [`${r.test[k].question}\n`, ""], bank: false }));
  const unit = { id: `lesson-${id}`, title: r.topic || "Тест", language: r.target_language, blocks };
  const check = async (answers) => {
    const list = r.test.map(() => "");
    choice.forEach((k, j) => { const v = answers[0]?.[j]; if (v !== undefined && v !== null) list[k] = r.test[k].options[v]; });
    gaps.forEach((k, j) => { list[k] = answers[(choice.length ? 1 : 0) + j]?.[0] || ""; });
    const res = await request("POST", `/site/v1/lessons/${encodeURIComponent(id)}/test`, { answers: list });
    const by = Object.fromEntries(res.results.map((x) => [x.index, x]));
    const out = {};
    if (choice.length) out["0"] = { questions: choice.map((k) => !!by[k]?.correct), question_answers: choice.map((k) => r.test[k].options.indexOf(by[k]?.answer)) };
    gaps.forEach((k, j) => { out[String((choice.length ? 1 : 0) + j)] = { gaps: [!!by[k]?.correct], gap_answers: [by[k]?.answer] }; });
    return { blocks: out, score: res.score, total: res.total };
  };
  return { unit, check };
}

const Art = ({ e, size = 28 }) => { const src = fluentSrc(e); return src ? <img src={src} alt="" width={size} height={size} className="shrink-0" style={{ width: size, height: size }} /> : <span style={{ fontSize: size * 0.8 }}>{e}</span>; };

function Section({ art, title, children, actions, className = "" }) {
  return (
    <section className={`panel p-5 md:p-6 ${className}`}>
      <div className="mb-4 flex items-center gap-3"><Art e={art} size={34} /><h2 className="flex-1 text-lg">{title}</h2>{actions}</div>
      {children}
    </section>
  );
}

function StudentBody({ r, id }) {
  const [quest, setQuest] = useState(null);
  const hw = [...r.homework_teacher, ...r.homework_generated];
  const lang = ttsOf(r.target_language);
  const stats = [["🔤", r.vocabulary.length, "новых слов"], ["📝", r.rules.length, "правил"], ["✅", r.corrections.length, "исправлений"], ["🎒", hw.length, "заданий"]].filter((x) => x[1]);
  if (quest) return <Quest unit={quest.unit} onCheck={quest.check} onSubmit={quest.check} onExit={() => setQuest(null)} />;
  return (
    <div className="grid gap-4">
      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stats.map(([e, n, t]) => <div key={t} className="panel flex items-center gap-3 p-3.5"><Art e={e} size={36} /><span><span className="num block text-xl font-bold leading-none">{n}</span><span className="text-[13px] text-ink-mute">{t}</span></span></div>)}
        </div>
      )}
      {(r.summary || r.key_points.length > 0) && (
        <Section art="💡" title="Главное">
          {r.summary && <p className="text-[16px] leading-relaxed text-ink-soft">{r.summary}</p>}
          {r.key_points.length > 0 && <ul className="mt-3 grid gap-2">{r.key_points.map((k) => <li key={k} className="flex gap-2.5"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-mint" />{k}</li>)}</ul>}
        </Section>
      )}
      {r.vocabulary.length > 0 && (
        <Section art="🔤" title="Новые слова" actions={<a href="#/app/words" className="btn-brand btn-sm"><Repeat size={14} /> Учить карточками</a>}>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">{r.vocabulary.map((w) => <Flashcard key={w.word} w={w} />)}</div>
          <p className="mt-3 text-[13px] text-ink-mute">Нажмите на карточку, чтобы увидеть перевод. Слова уже в разделе «Слова».</p>
        </Section>
      )}
      {r.rules.length > 0 && (
        <Section art="📝" title="Правила">
          <div className="grid gap-4">
            {r.rules.map((rule) => (
              <div key={rule.title} className="rounded-2xl border-l-4 border-sun bg-sun-soft/40 p-4">
                <p className="text-[16px] font-semibold">{rule.title}</p>
                {rule.explanation && rule.explanation !== rule.title && <p className="mt-1.5 text-ink-soft">{rule.explanation}</p>}
                {rule.examples?.length > 0 && (
                  <ul className="mt-3 grid gap-1.5">
                    {rule.examples.map((x) => (
                      <li key={x} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                        <button type="button" onClick={() => speak(x, lang)} className="text-study" aria-label={`Произнести: ${x}`}><Volume2 size={16} /></button>
                        <span className="italic">{x}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
      {r.corrections.length > 0 && (
        <Section art="✅" title="Работа над ошибками">
          <ul className="grid gap-2.5">
            {r.corrections.map((c, i) => (
              <li key={i} className="grid gap-1.5 rounded-2xl bg-cream p-3.5 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
                <span className="rounded-xl bg-teach-tint px-3 py-1.5 text-teach-deep line-through decoration-teach/60">{c.wrong}</span>
                <span className="hidden text-ink-mute sm:block">→</span>
                <span className="rounded-xl bg-mint-soft px-3 py-1.5 font-semibold text-[#146b4c]">{c.correct}</span>
                {c.note && <span className="text-[13px] text-ink-mute sm:col-span-3">{c.note}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {r.test.length > 0 && (
        <section className="panel flex flex-col items-center gap-4 !border-mint/40 !bg-mint-soft/50 p-5 text-center sm:flex-row sm:text-left md:p-6">
          <Iskorka size={70} mood="happy" />
          <div className="min-w-0 flex-1"><h2 className="text-lg">Проверь себя</h2><p className="text-ink-soft">{r.test.length} {plural(r.test.length, "вопрос", "вопроса", "вопросов")} по уроку. По одному, с проверкой сразу.</p></div>
          <button type="button" onClick={() => setQuest(lessonQuest(r, id))} className="w-full rounded-2xl bg-mint px-7 py-3 text-[16px] font-bold text-white shadow-[0_4px_0_#146b4c] active:translate-y-1 active:shadow-none sm:w-auto">Пройти тест</button>
        </section>
      )}
      {r.review_items.length > 0 && <Section art="🔁" title="Что повторить"><Bullets items={r.review_items} /></Section>}
      {hw.length > 0 && (
        <Section art="🎒" title="Домашнее задание" actions={<a href="#/app/homework" className="btn-light btn-sm">Открыть домашку</a>}>
          <ul className="grid gap-2">
            {hw.map((t, i) => (
              <li key={i} className="flex gap-3 rounded-2xl border border-line p-3.5">
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 border-line" />
                <span className="min-w-0 flex-1">{t.text}<span className="mt-0.5 block text-[12px] text-ink-mute">{t.source === "teacher" ? "от преподавателя" : "дополнительно"}</span></span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Parent({ res }) {
  const r = res.report;
  return (
    <>
      <Back />
      <PageTitle title="Отчёт об уроке" text={[fmtDate(res.started_at), r.parent.student_name, r.topic].filter(Boolean).join(" · ")} />
      <ParentBody r={r} />
    </>
  );
}

function ParentBody({ r }) {
  const p = r.parent;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section art="📖" title="Как прошёл урок" className="md:col-span-2">
        {p.summary && <p className="text-[16px] leading-relaxed text-ink-soft">{p.summary}</p>}
        {p.activity && <p className="mt-2 text-sm text-ink-mute">Активность: {p.activity}</p>}
      </Section>
      {p.achievements.length > 0 && <Section art="🏆" title="Успехи"><Bullets items={p.achievements} /></Section>}
      {p.attention.length > 0 && <Section art="⚠️" title="На что обратить внимание"><Bullets items={p.attention} /></Section>}
      {p.teacher_remarks.length > 0 && <Section art="💬" title="Замечания преподавателя"><Bullets items={p.teacher_remarks} /></Section>}
      <Section art="🎒" title="Домашнее задание"><p className="mb-3 text-sm">Прошлое ДЗ: <b>{r.homework_status_ru}</b></p><Bullets items={r.homework} /></Section>
      {r.words.length > 0 && <Section art="🔤" title="Новые слова"><div className="flex flex-wrap gap-2">{r.words.map((w) => <span key={w} className="rounded-xl bg-cream px-3 py-1.5 font-semibold">{w}</span>)}</div></Section>}
      {p.recommendations.length > 0 && <Section art="💡" title="Как помочь дома"><Bullets items={p.recommendations} /></Section>}
    </div>
  );
}

/** ИИ ещё готовит конспект по расшифровке: показываем черновик и обновляем страницу сами. */
function AiPending({ reload }) {
  useEffect(() => { const t = setInterval(reload, 15000); return () => clearInterval(t); }, [reload]);
  return <Notice className="mb-4">ИИ готовит подробный конспект по записи урока – обычно это занимает несколько минут. Пока показан черновик; страница обновится сама.</Notice>;
}

const joinLines = (a) => (a || []).join("\n");

/** Конспект ждёт проверки: ученик и родители его не видят, пока преподаватель не нажмёт «Отправить». */
function PublishBar({ id, onDone, pending }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const publish = async () => {
    setBusy(true); setError(null);
    try { await request("POST", `/site/v1/lessons/${encodeURIComponent(id)}/publish`, {}); onDone(); } catch (x) { setError(x); setBusy(false); }
  };
  return (
    <div className="card mb-4 flex flex-wrap items-center gap-4 !border-sun/50 !bg-sun-soft/60 !p-4">
      <p className="min-w-0 flex-1 text-sm"><b>Конспект ждёт вашей проверки.</b> Ученик и родители его пока не видят. Поправьте, что нужно, и отправьте.</p>
      <button type="button" className="btn-brand" disabled={busy || pending} onClick={publish}>{pending ? "ИИ ещё готовит…" : busy ? "Отправляем…" : "Отправить ученику"}</button>
      {error && <div className="w-full"><ErrorBox error={error} /></div>}
    </div>
  );
}

/** Упражнения по теме урока: слова и тема превращаются в занятие, которое можно сразу выдать как домашку. */
function Exercises({ id }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const make = async (assign) => {
    setBusy(true); setError(null);
    try {
      const res = await request("POST", `/site/v1/lessons/${encodeURIComponent(id)}/exercises`, { assign });
      if (assign) setDone(res); else window.location.hash = `#/app/units/${res.unit_id}`;
    } catch (x) { setError(x); }
    setBusy(false);
  };
  return (
    <div className="card mt-4 flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1"><h2 className="text-lg">Домашка по этому уроку</h2><p className="text-sm text-ink-mute">Соберём упражнения из слов и темы урока: пары, пропуски, тест. Перед выдачей их можно отредактировать.</p></div>
      <button type="button" className="btn-light" disabled={busy} onClick={() => make(false)}>Создать и открыть</button>
      <button type="button" className="btn-brand" disabled={busy} onClick={() => make(true)}>Создать и выдать ученику</button>
      {done && <div className="w-full"><Notice tone="ok">Выдано. <a className="link" href={`#/app/units/${done.unit_id}`}>Открыть занятие</a> или <a className="link" href="#/app/homework">посмотреть домашки</a>.</Notice></div>}
      {error && <div className="w-full"><ErrorBox error={error} /></div>}
    </div>
  );
}

/** Преподаватель правит отчёт: то, что увидят ученик и родители. */
function EditReport({ res, onSaved }) {
  const r = res.report;
  const [f, setF] = useState({
    topic: r.topic || "", summary: r.summary || "", key_points: joinLines(r.key_points),
    vocabulary: (r.vocabulary || []).map((w) => (w.translation ? `${w.word} – ${w.translation}` : w.word)).join("\n"),
    homework: joinLines([...(r.homework_teacher || []), ...(r.homework_generated || [])].map((h) => h.text)),
    review_items: joinLines(r.review_items),
    p_summary: r.parent?.summary || "", achievements: joinLines(r.parent?.achievements), attention: joinLines(r.parent?.attention),
    recommendations: joinLines(r.parent?.recommendations),
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      await request("POST", `/site/v1/lessons/${encodeURIComponent(res.id)}/report`, {
        topic: f.topic, summary: f.summary, key_points: f.key_points, vocabulary: f.vocabulary, homework: f.homework,
        review_items: f.review_items,
        parent: { summary: f.p_summary, achievements: f.achievements, attention: f.attention, recommendations: f.recommendations },
      });
      onSaved();
    } catch (x) { setError(x); }
    setBusy(false);
  };
  const area = (k, label, hint, rows = 3) => (
    <label className="label">{label}<textarea className="field font-normal" rows={rows} value={f[k]} onChange={set(k)} />{hint && <span className="text-xs font-normal text-ink-mute">{hint}</span>}</label>
  );
  return (
    <form onSubmit={save} className="grid gap-4">
      <Panel title="Для ученика" icon={BookOpen}>
        <div className="grid gap-3">
          <label className="label">Тема<input className="field" maxLength={200} value={f.topic} onChange={set("topic")} /></label>
          {area("summary", "Главное", null, 3)}
          {area("key_points", "Ключевые пункты", "по пункту в строке")}
          {area("vocabulary", "Новые слова", "«слово – перевод», по слову в строке. Изменения сразу попадут в карточки ученика.", 5)}
          {area("homework", "Домашнее задание", "по заданию в строке")}
          {area("review_items", "Что повторить", "по пункту в строке")}
        </div>
      </Panel>
      <Panel title="Для родителей" icon={Trophy}>
        <div className="grid gap-3">
          {area("p_summary", "Как прошёл урок")}
          {area("achievements", "Успехи", "по пункту в строке")}
          {area("attention", "На что обратить внимание", "по пункту в строке")}
          {area("recommendations", "Как помочь дома", "по пункту в строке")}
        </div>
      </Panel>
      <ErrorBox error={error} />
      <div className="flex gap-2"><button type="submit" className="btn-brand" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить отчёт"}</button><button type="button" className="btn-ghost" onClick={onSaved}>Отмена</button></div>
    </form>
  );
}

/** Преподаватель видит конспект глазами ученика и родителя, а текстом – чтобы скопировать в мессенджер. */
function TutorView({ res, id }) {
  const [tab, setTab] = useState("student");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(res.text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* буфер недоступен */ }
  };
  const tabs = [{ id: "student", title: "Ученик видит" }, res.parent_report && { id: "parent", title: "Родитель видит" }, { id: "text", title: "Текстом" }].filter(Boolean);
  return (
    <div className="mb-4">
      <Tabs items={tabs} value={tab} onChange={setTab} label="Вид конспекта" className="mb-4" />
      {tab === "student" && res.student_report && <StudentBody r={res.student_report} id={id} />}
      {tab === "parent" && res.parent_report && <ParentBody r={res.parent_report} />}
      {(tab === "text" || !res.student_report) && (
        <div className="card">
          <div className="mb-3 flex justify-end"><button type="button" className="btn-ghost btn-sm" onClick={copy}><Copy size={14} /> {copied ? "Скопировано" : "Копировать"}</button></div>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-soft">{res.text}</pre>
        </div>
      )}
    </div>
  );
}

export default function Lesson({ id }) {
  const { data: res, error, reload } = useApi(`/site/v1/lessons/${encodeURIComponent(id)}`, [id]);
  const [editing, setEditing] = useState(false);
  if (error) return <><Back /><ErrorBox error={error} /></>;
  if (!res) return <Loading />;
  if (!res.report) return <><Back /><PageTitle title={res.title || "Урок"} /><Notice>{res.on_review ? "Преподаватель проверяет конспект и скоро его отправит. Слова появятся в карточках сразу после этого." : "Материалы появятся после урока."}</Notice></>;
  const pending = res.generated_by === "pending" && <AiPending reload={reload} />;
  if (res.role === "student") return <>{pending}<Student res={res} id={id} /></>;
  if (res.role === "parent") return <>{pending}<Parent res={res} /></>;
  if (editing) {
    return (
      <>
        <Back />
        <PageTitle title="Редактирование отчёта" text="Ученик и родители увидят исправленную версию." />
        <EditReport res={res} onSaved={() => { setEditing(false); reload(); }} />
      </>
    );
  }
  return (
    <>
      <Back />
      {pending}
      {res.role === "tutor" && res.published === false && <PublishBar id={id} onDone={reload} pending={res.generated_by === "pending"} />}
      <PageTitle title={res.report.topic || res.title || "Урок"} text={`${fmtDate(res.started_at)} · ${res.with}`}
        actions={res.role === "tutor" && <button type="button" className="btn-brand" onClick={() => setEditing(true)}>Редактировать отчёт</button>} />
      <TutorView res={res} id={id} />
      {res.role === "tutor" && <Exercises id={id} />}
    </>
  );
}
