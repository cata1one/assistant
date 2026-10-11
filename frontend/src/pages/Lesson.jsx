import { ArrowLeft, BookOpen, CheckCircle2, Lightbulb, MessageSquareQuote, NotebookPen, Ruler, Sparkles, TriangleAlert, Trophy, Repeat, Wrench, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Bullets, ErrorBox, Loading, Notice, PageHead, Panel } from "../components/ui.jsx";
import { fmtDate, getToken, request } from "../lib/api.js";
import { CabinetLogin, Flashcard } from "./Cabinet.jsx";

function Test({ test, lessonId }) {
  const [answers, setAnswers] = useState(() => test.map(() => ""));
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (i, v) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)));
  const check = async () => {
    setBusy(true); setError(null);
    try { setResult(await request("POST", `/site/v1/lessons/${encodeURIComponent(lessonId)}/test`, { answers })); }
    catch (err) { setError(err); }
    setBusy(false);
  };
  const verdict = (i) => result?.results.find((r) => r.index === i);
  return (
    <Panel title="Тест для самопроверки" icon={CheckCircle2}>
      <div className="grid gap-3">
        {test.map((q, i) => {
          const v = verdict(i);
          return (
            <div key={i} className={`rounded-2xl border p-5 transition-colors duration-300 ${v ? (v.correct ? "border-emerald/50 bg-emerald/5" : "border-rose-500/50 bg-rose-500/5") : "border-white/10 bg-white/[.03]"}`}>
              <p className="text-white"><span className="font-semibold">{i + 1}.</span> {q.question}</p>
              {q.options?.length ? (
                <div role="radiogroup" className="mt-3 grid gap-2 sm:grid-cols-2">
                  {q.options.map((o) => (
                    <label key={o} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all duration-300 ${answers[i] === o ? "border-violet/60 bg-violet/15 text-white" : "border-white/10 hover:border-white/25"}`}>
                      <input type="radio" name={`q${i}`} value={o} checked={answers[i] === o} onChange={() => set(i, o)} className="accent-violet" />{o}
                    </label>
                  ))}
                </div>
              ) : (
                <input className="field mt-3" aria-label={`Ответ на вопрос ${i + 1}`} value={answers[i]} onChange={(e) => set(i, e.target.value)} />
              )}
              {v && (
                <p className={`mt-3 flex items-center gap-2 text-sm ${v.correct ? "text-emerald-soft" : "text-rose-200"}`}>
                  {v.correct ? <><CheckCircle2 size={15} /> Верно</> : <><XCircle size={15} /> Правильный ответ: {v.answer}</>}
                  {v.explanation && <span className="text-zinc-400">— {v.explanation}</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4" aria-live="polite">
        <button type="button" className="btn-primary" disabled={busy} onClick={check}>{result ? "Проверить ещё раз" : "Проверить"}</button>
        {result && <span className={`font-display text-2xl ${result.score === result.total ? "text-aurora" : "text-white"}`}>{result.score} из {result.total}</span>}
      </div>
      {error && <div className="mt-4"><ErrorBox error={error} /></div>}
    </Panel>
  );
}

function Student({ res, id }) {
  const r = res.report;
  const hw = [...r.homework_teacher, ...r.homework_generated].map((t) => `${t.source === "teacher" ? "От преподавателя: " : "Дополнительно: "}${t.text}`);
  return (
    <>
      <PageHead eyebrow={<a href="#/cabinet" className="inline-flex items-center gap-2 hover:text-white"><ArrowLeft size={14} /> Личный кабинет</a>}
        title={r.topic || res.title || "Конспект урока"} text={`${fmtDate(res.started_at)} · ${res.with}`} />
      <div className="grid gap-4">
        <Panel title="Главное" icon={BookOpen}>{r.summary && <p className="mb-4 text-zinc-200">{r.summary}</p>}<Bullets items={r.key_points} /></Panel>
        {r.rules.length > 0 && (
          <Panel title="Правила" icon={Ruler}>
            <div className="grid gap-5">{r.rules.map((rule) => (
              <div key={rule.title}><p className="font-semibold text-white">{rule.title}</p><p className="mb-2 mt-1">{rule.explanation}</p><Bullets items={rule.examples} /></div>
            ))}</div>
          </Panel>
        )}
        {r.corrections.length > 0 && (
          <Panel title="Работа над ошибками" icon={Wrench}>
            <ul className="grid gap-2">{r.corrections.map((c, i) => (
              <li key={i}><s className="text-rose-300/80">{c.wrong}</s> <span className="text-zinc-500">→</span> <b className="text-emerald-soft">{c.correct}</b>{c.note ? <span className="text-zinc-400"> — {c.note}</span> : null}</li>
            ))}</ul>
          </Panel>
        )}
        {r.review_items.length > 0 && <Panel title="Что повторить" icon={Repeat}><Bullets items={r.review_items} /></Panel>}
        {r.vocabulary.length > 0 && (
          <Panel title="Новые слова" icon={Sparkles}>
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
      <PageHead eyebrow={<a href="#/cabinet" className="inline-flex items-center gap-2 hover:text-white"><ArrowLeft size={14} /> Личный кабинет</a>}
        title="Отчёт об уроке" text={[fmtDate(res.started_at), p.student_name, r.topic].filter(Boolean).join(" · ")} />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Как прошёл урок" icon={BookOpen} className="md:col-span-2">
          {p.summary && <p className="text-zinc-200">{p.summary}</p>}
          {p.activity && <p className="mt-2 text-sm text-zinc-500">Активность на уроке: {p.activity}</p>}
        </Panel>
        {p.achievements.length > 0 && <Panel title="Успехи" icon={Trophy}><Bullets items={p.achievements} /></Panel>}
        {p.attention.length > 0 && <Panel title="На что обратить внимание" icon={TriangleAlert}><Bullets items={p.attention} /></Panel>}
        {p.teacher_remarks.length > 0 && <Panel title="Замечания преподавателя" icon={MessageSquareQuote}><Bullets items={p.teacher_remarks} /></Panel>}
        <Panel title="Домашнее задание" icon={NotebookPen}><p className="mb-3">Прошлое ДЗ: <span className="text-white">{r.homework_status_ru}</span></p><Bullets items={r.homework} /></Panel>
        {r.words.length > 0 && (
          <Panel title="Новые слова" icon={Sparkles}><div className="flex flex-wrap gap-2">{r.words.map((w) => <span key={w} className="chip">{w}</span>)}</div></Panel>
        )}
        {p.recommendations.length > 0 && <Panel title="Как помочь дома" icon={Lightbulb}><Bullets items={p.recommendations} /></Panel>}
      </div>
    </>
  );
}

export default function Lesson({ id }) {
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { if (getToken()) request("GET", `/site/v1/lessons/${encodeURIComponent(id)}`).then(setRes).catch(setError); }, [id]);
  if (!getToken()) return <CabinetLogin />;
  if (error) return <><PageHead title="Урок" /><ErrorBox error={error} /></>;
  if (!res) return <><PageHead title="Урок" /><Loading /></>;
  if (!res.report) return <PageHead title={res.title || "Урок"}><div className="mt-6"><Notice>Материалы появятся после урока.</Notice></div></PageHead>;
  if (res.role === "student") return <Student res={res} id={id} />;
  if (res.role === "parent") return <Parent res={res} />;
  return (
    <>
      <PageHead eyebrow={<a href="#/cabinet" className="inline-flex items-center gap-2 hover:text-white"><ArrowLeft size={14} /> Личный кабинет</a>}
        title={res.report.topic || res.title || "Урок"} text={`${fmtDate(res.started_at)} · ${res.with}`} />
      <pre className="card whitespace-pre-wrap font-mono text-sm leading-relaxed text-zinc-300">{res.text}</pre>
    </>
  );
}
