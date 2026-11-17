import { useState } from "react";
import { request } from "../lib/api.js";
import { ErrorBox, Loading, PageTitle } from "../ui/kit.jsx";
import { useApi } from "./common.jsx";

export default function Placement() {
  const { data, error } = useApi("/site/v1/placement/english");
  const duolingo = useApi("/site/v1/placement/duolingo");
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [externalKind, setExternalKind] = useState("practice");
  const [externalError, setExternalError] = useState(null);
  const [externalBusy, setExternalBusy] = useState(false);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const last = result || data.result;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setSubmitError(null);
    try {
      setResult(await request("POST", "/site/v1/placement/english", { answers: data.questions.map((_, i) => answers[i]) }));
      setStarted(false); window.scrollTo(0, 0);
    } catch (err) { setSubmitError(err); } finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-3xl">
    <PageTitle title="Уровень английского" text="Небольшой необязательный тест по грамматике и словарю." />
    <section className="panel mb-5 p-5 sm:p-7">
      <h2 className="text-xl font-semibold">Duolingo English Test</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">Пройдите бесплатный тренировочный тест на сайте Duolingo и сохраните полученный диапазон баллов. Официальный сертификационный тест оплачивается отдельно. Результат увидит ваш преподаватель.</p>
      <a className="btn-light mt-4" href="https://englishtest.duolingo.com/applicants" target="_blank" rel="noopener noreferrer">Открыть тест Duolingo ↗</a>
      {duolingo.data?.result && <p className="mt-4 text-sm">Ваш результат: <strong>{duolingo.data.result.score_min}{duolingo.data.result.score_min !== duolingo.data.result.score_max ? `–${duolingo.data.result.score_max}` : ""}</strong> · введён вами, не проверен автоматически</p>}
      <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={async (e) => {
        e.preventDefault(); const form = new FormData(e.currentTarget); setExternalBusy(true); setExternalError(null);
        const low = Number(form.get("low")); const high = externalKind === "certified" ? low : Number(form.get("high"));
        try { await request("POST", "/site/v1/placement/duolingo", { score_min: low, score_max: high, kind: externalKind }); await duolingo.reload(); }
        catch (err) { setExternalError(err); } finally { setExternalBusy(false); }
      }}>
        <label className="label">Тип результата<select className="field" value={externalKind} onChange={(e) => setExternalKind(e.target.value)}><option value="practice">Тренировочный</option><option value="certified">Сертификационный</option></select></label>
        <label className="label">{externalKind === "practice" ? "От" : "Баллы"}<input className="field" name="low" type="number" min="10" max="160" required /></label>
        {externalKind === "practice" && <label className="label">До<input className="field" name="high" type="number" min="10" max="160" required /></label>}
        <div className="sm:col-span-3"><ErrorBox error={externalError || duolingo.error} /><button className="btn-brand" disabled={externalBusy}>{externalBusy ? "Сохраняем…" : "Сохранить и показать преподавателю"}</button><p className="mt-2 text-xs text-ink-mute">Результат вводится вручную: Bright не получает его автоматически и не проверяет сертификат.</p></div>
      </form>
    </section>
    <div className="panel p-5 sm:p-7">
      <p className="text-sm leading-relaxed text-ink-soft">Результат приблизительный: тест не оценивает разговорную речь, аудирование и письмо. Преподаватель увидит его в вашей карточке. Вы можете пройти тест повторно.</p>
      {last && <p className="mt-4 text-lg font-semibold">Предварительный уровень: {last.level} <span className="text-sm font-normal text-ink-mute">· {last.score} из {data.questions.length}</span></p>}
      {!started ? <button type="button" className="btn-brand mt-5" onClick={() => { setAnswers({}); setStarted(true); }}>{last ? "Пройти ещё раз" : "Начать тест"}</button> :
        <form onSubmit={submit} className="mt-6 grid gap-6">
          {data.questions.map((q, i) => <fieldset key={i} className="rounded-2xl border border-line bg-cream/40 p-4 sm:p-5">
            <legend className="px-1 font-semibold">{i + 1}. {q.prompt}</legend>
            <div className="grid gap-2">{q.options.map((option, j) => <label key={j} className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-3 text-sm"><input required type="radio" name={`placement-${i}`} checked={answers[i] === j} onChange={() => setAnswers((a) => ({ ...a, [i]: j }))} />{option}</label>)}</div>
          </fieldset>)}
          <ErrorBox error={submitError} />
          <div className="flex flex-wrap gap-2"><button className="btn-brand" disabled={busy}>{busy ? "Проверяем…" : "Узнать результат"}</button><button type="button" className="btn-light" onClick={() => setStarted(false)}>Отменить</button></div>
        </form>}
    </div>
  </div>;
}
