import {
  ArrowLeft, BookOpen, CheckCircle2, Lightbulb, MessageSquareQuote, NotebookPen, Repeat, Ruler, Sparkles, TriangleAlert, Trophy,
  Wrench, XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fmtDate, request } from "../lib/api.js";
import { Bullets, ErrorBox, Loading, Notice, PageTitle } from "../ui/kit.jsx";
import { Flashcard, Panel, useApi } from "./common.jsx";

function Test({ test, lessonId }) {
  const [answers, setAnswers] = useState(() => test.map(() => ""));
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const set = (i, v) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)));
  const check = async () => {
    setError(null);
    try { setResult(await request("POST", `/site/v1/lessons/${encodeURIComponent(lessonId)}/test`, { answers })); } catch (x) { setError(x); }
  };
  const verdict = (i) => result?.results.find((r) => r.index === i);
  return (
    <Panel title="Тест для самопроверки" icon={CheckCircle2}>
      <div className="grid gap-3">
        {test.map((q, i) => {
          const v = verdict(i);
          return (
            <div key={i} className={`rounded-2xl border p-4 ${v ? (v.correct ? "border-mint bg-mint-soft/50" : "border-teach/40 bg-teach-tint") : "border-line"}`}>
              <p><b>{i + 1}.</b> {q.question}</p>
              {q.options?.length ? (
                <div role="radiogroup" className="mt-3 grid gap-2 sm:grid-cols-2">
                  {q.options.map((o) => (
                    <label key={o} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${answers[i] === o ? "border-brand bg-brand-tint" : "border-line bg-white hover:border-ink/20"}`}>
                      <input type="radio" name={`q${i}`} value={o} checked={answers[i] === o} onChange={() => set(i, o)} />{o}
                    </label>
                  ))}
                </div>
              ) : <input className="field mt-3" aria-label={`Ответ на вопрос ${i + 1}`} value={answers[i]} onChange={(e) => set(i, e.target.value)} />}
              {v && (
                <p className={`mt-3 flex flex-wrap items-center gap-2 text-sm ${v.correct ? "text-[#146b4c]" : "text-teach-deep"}`}>
                  {v.correct ? <><CheckCircle2 size={15} /> Верно</> : <><XCircle size={15} /> Правильно: {v.answer}</>}
                  {v.explanation && <span className="text-ink-mute">— {v.explanation}</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4" aria-live="polite">
        <button type="button" className="btn-brand" onClick={check}>{result ? "Проверить ещё раз" : "Проверить"}</button>
        {result && <span className="font-display text-2xl font-extrabold">{result.score} из {result.total}</span>}
      </div>
      <ErrorBox error={error} />
    </Panel>
  );
}

const Back = () => <a href="#/app/lessons" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-ink-mute hover:text-ink"><ArrowLeft size={14} /> Все уроки</a>;

function Student({ res, id }) {
  const r = res.report;
  const hw = [...r.homework_teacher, ...r.homework_generated].map((t) => `${t.source === "teacher" ? "От преподавателя: " : "Дополнительно: "}${t.text}`);
  return (
    <>
      <Back />
      <PageTitle title={r.topic || res.title || "Конспект урока"} text={`${fmtDate(res.started_at)} · ${res.with}`} />
      <div className="grid gap-4">
        <Panel title="Главное" icon={BookOpen}>{r.summary && <p className="mb-3 text-ink-soft">{r.summary}</p>}<Bullets items={r.key_points} /></Panel>
        {r.rules.length > 0 && (
          <Panel title="Правила" icon={Ruler}>
            <div className="grid gap-5">{r.rules.map((rule) => <div key={rule.title}><p className="font-bold">{rule.title}</p><p className="mb-2 mt-1 text-ink-soft">{rule.explanation}</p><Bullets items={rule.examples} /></div>)}</div>
          </Panel>
        )}
        {r.corrections.length > 0 && (
          <Panel title="Работа над ошибками" icon={Wrench}>
            <ul className="grid gap-2">{r.corrections.map((c, i) => <li key={i}><s className="text-teach-deep/70">{c.wrong}</s> → <b className="text-[#146b4c]">{c.correct}</b>{c.note ? <span className="text-ink-mute"> — {c.note}</span> : null}</li>)}</ul>
          </Panel>
        )}
        {r.review_items.length > 0 && <Panel title="Что повторить" icon={Repeat}><Bullets items={r.review_items} /></Panel>}
        {r.vocabulary.length > 0 && (
          <Panel title="Новые слова" icon={Sparkles} actions={<a href="#/app/cards" className="btn-brand btn-sm">Учить карточками</a>}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{r.vocabulary.map((w) => <Flashcard key={w.word} w={w} />)}</div>
          </Panel>
        )}
        {r.test.length > 0 && <Test test={r.test} lessonId={id} />}
        {hw.length > 0 && <Panel title="Домашнее задание" icon={NotebookPen}><Bullets items={hw} /></Panel>}
      </div>
    </>
  );
}

function Parent({ res }) {
  const r = res.report;
  const p = r.parent;
  return (
    <>
      <Back />
      <PageTitle title="Отчёт об уроке" text={[fmtDate(res.started_at), p.student_name, r.topic].filter(Boolean).join(" · ")} />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Как прошёл урок" icon={BookOpen} className="md:col-span-2">
          {p.summary && <p className="text-ink-soft">{p.summary}</p>}
          {p.activity && <p className="mt-2 text-sm text-ink-mute">Активность: {p.activity}</p>}
        </Panel>
        {p.achievements.length > 0 && <Panel title="Успехи" icon={Trophy}><Bullets items={p.achievements} /></Panel>}
        {p.attention.length > 0 && <Panel title="На что обратить внимание" icon={TriangleAlert}><Bullets items={p.attention} /></Panel>}
        {p.teacher_remarks.length > 0 && <Panel title="Замечания преподавателя" icon={MessageSquareQuote}><Bullets items={p.teacher_remarks} /></Panel>}
        <Panel title="Домашнее задание" icon={NotebookPen}><p className="mb-3 text-sm">Прошлое ДЗ: <b>{r.homework_status_ru}</b></p><Bullets items={r.homework} /></Panel>
        {r.words.length > 0 && <Panel title="Новые слова" icon={Sparkles}><div className="flex flex-wrap gap-2">{r.words.map((w) => <span key={w} className="chip">{w}</span>)}</div></Panel>}
        {p.recommendations.length > 0 && <Panel title="Как помочь дома" icon={Lightbulb}><Bullets items={p.recommendations} /></Panel>}
      </div>
    </>
  );
}

/** ИИ ещё готовит конспект по расшифровке: показываем черновик и обновляем страницу сами. */
function AiPending({ reload }) {
  useEffect(() => { const t = setInterval(reload, 15000); return () => clearInterval(t); }, [reload]);
  return <Notice className="mb-4">ИИ готовит подробный конспект по записи урока — обычно это занимает несколько минут. Пока показан черновик; страница обновится сама.</Notice>;
}

const joinLines = (a) => (a || []).join("\n");

/** Преподаватель правит отчёт: то, что увидят ученик и родители. */
function EditReport({ res, onSaved }) {
  const r = res.report;
  const [f, setF] = useState({
    topic: r.topic || "", summary: r.summary || "", key_points: joinLines(r.key_points),
    vocabulary: (r.vocabulary || []).map((w) => (w.translation ? `${w.word} — ${w.translation}` : w.word)).join("\n"),
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
          {area("vocabulary", "Новые слова", "«слово — перевод», по слову в строке. Изменения сразу попадут в карточки ученика.", 5)}
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

export default function Lesson({ id }) {
  const { data: res, error, reload } = useApi(`/site/v1/lessons/${encodeURIComponent(id)}`, [id]);
  const [editing, setEditing] = useState(false);
  if (error) return <><Back /><ErrorBox error={error} /></>;
  if (!res) return <Loading />;
  if (!res.report) return <><Back /><PageTitle title={res.title || "Урок"} /><Notice>Материалы появятся после урока.</Notice></>;
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
      <PageTitle title={res.report.topic || res.title || "Урок"} text={`${fmtDate(res.started_at)} · ${res.with}`}
        actions={res.role === "tutor" && <button type="button" className="btn-brand" onClick={() => setEditing(true)}>Редактировать отчёт</button>} />
      <pre className="card whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-soft">{res.text}</pre>
    </>
  );
}
