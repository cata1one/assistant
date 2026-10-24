import { CheckCircle2, Headphones, Pause, Volume2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ttsOf } from "../lib/langs.js";
import { ErrorBox } from "../ui/kit.jsx";

/** Озвучка браузером (бесплатно, без сервера). Голос зависит от устройства. */
export function speak(text, lang = "en-US", rate = 0.9) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.replace("_", "-").startsWith(lang.slice(0, 2)));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

const Mark = ({ ok }) => (ok ? <CheckCircle2 size={16} className="inline text-mint" /> : <XCircle size={16} className="inline text-teach" />);

function Gaps({ parts, bank, value = [], onChange, result, answers }) {
  const [focus, setFocus] = useState(0);
  const set = (i, v) => { const next = [...value]; next[i] = v; onChange(next); };
  const used = new Set(value.filter(Boolean));
  return (
    <>
      {bank?.length > 0 && !result && (
        <div className="mb-3 flex flex-wrap gap-2">
          {bank.map((w, i) => (
            <button key={i} type="button" disabled={used.has(w)} onClick={() => { set(focus, w); setFocus(Math.min(parts.length - 2, focus + 1)); }}
              className={`chip !text-sm ${used.has(w) ? "opacity-40" : "hover:border-brand"}`}>{w}</button>
          ))}
        </div>
      )}
      <p className="whitespace-pre-wrap leading-[2.4]">
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < parts.length - 1 && (
              <span className="inline-flex items-center gap-1 align-baseline">
                <input value={value[i] || ""} onChange={(e) => set(i, e.target.value)} onFocus={() => setFocus(i)} disabled={!!result}
                  aria-label={`Пропуск ${i + 1}`} style={{ width: `${Math.max(5, (value[i] || "").length + 2)}ch` }}
                  className={`mx-0.5 rounded-lg border-b-2 bg-cream px-2 py-0.5 text-center font-semibold outline-none focus:border-brand ${result ? (result[i] ? "border-mint bg-mint-soft" : "border-teach bg-teach-tint") : "border-line"}`} />
                {result && !result[i] && <span className="text-sm font-bold text-[#146b4c]">{answers[i]}</span>}
              </span>
            )}
          </span>
        ))}
      </p>
    </>
  );
}

function Questions({ questions, value = [], onChange, result, answers }) {
  return (
    <div className="grid gap-3">
      {questions.map((q, i) => (
        <div key={i}>
          <p className="font-semibold">{i + 1}. {q.q} {result && <Mark ok={result[i]} />}</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {q.options.map((o, j) => {
              const picked = value[i] === j;
              const right = result && answers[i] === j;
              return (
                <label key={j} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${right ? "border-mint bg-mint-soft" : picked ? (result ? "border-teach bg-teach-tint" : "border-brand bg-brand-tint") : "border-line bg-white hover:border-ink/20"}`}>
                  <input type="radio" name={`${q.q}-${i}`} checked={picked} disabled={!!result} onChange={() => { const n = [...value]; n[i] = j; onChange(n); }} />{o}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Listen({ b }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => { try { window.speechSynthesis.cancel(); } catch { /* нет озвучки */ } }, []);
  if (b.audio) return <audio controls src={b.audio} className="mb-4 w-full" />;
  const play = (rate) => {
    if (playing) { window.speechSynthesis.cancel(); setPlaying(false); return; }
    if (speak(b.speak, b.lang, rate)) {
      setPlaying(true);
      const t = setInterval(() => { if (!window.speechSynthesis.speaking) { setPlaying(false); clearInterval(t); } }, 300);
    }
  };
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <button type="button" className="btn-brand" onClick={() => play(0.9)}>{playing ? <Pause size={16} /> : <Headphones size={16} />} {playing ? "Стоп" : "Прослушать"}</button>
      <button type="button" className="btn-light" onClick={() => play(0.65)}>Медленнее</button>
    </div>
  );
}

/** Занятие глазами ученика. onSubmit(answers) → результат проверки с сервера. */
export default function UnitPlayer({ unit, result: initial, onSubmit, readOnly, submitLabel = "Проверить" }) {
  const [answers, setAnswers] = useState(initial?.answers || {});
  const [result, setResult] = useState(initial || null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (i, v) => setAnswers((a) => ({ ...a, [i]: v }));
  const check = async () => {
    setBusy(true); setError(null);
    try { setResult(await onSubmit(answers)); window.scrollTo({ top: 0, behavior: "smooth" }); } catch (x) { setError(x); }
    setBusy(false);
  };
  const r = (i) => result?.blocks?.[String(i)];
  return (
    <div className="grid gap-4">
      {result && result.total > 0 && (
        <div className={`card flex items-center gap-4 ${result.score === result.total ? "!bg-mint-soft" : "!bg-brand-tint"}`}>
          <span className="num font-display text-4xl font-extrabold">{result.score}/{result.total}</span>
          <span>{result.score === result.total ? "Всё верно – отлично!" : "Правильные ответы показаны зелёным."}</span>
        </div>
      )}
      {unit.blocks.map((b, i) => (
        <section key={i} className="card">
          {b.title && <h2 className="mb-3 text-lg">{b.title}</h2>}
          {b.type === "text" && <p className="whitespace-pre-wrap text-ink-soft">{b.body}</p>}
          {b.type === "words" && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {b.items.map((w) => (
                <li key={w.word} className="flex items-center gap-2 rounded-2xl bg-cream px-3 py-2">
                  <button type="button" onClick={() => speak(w.word.replace(/\s*\(.*\)$/, ""), ttsOf(unit.language))} aria-label={`Произнести ${w.word}`} className="text-brand"><Volume2 size={16} /></button>
                  <b>{w.word}</b>{w.translation && <span className="text-ink-mute">– {w.translation}</span>}
                </li>
              ))}
            </ul>
          )}
          {b.type === "gap" && <Gaps parts={b.parts} bank={b.bank} value={answers[i]} onChange={(v) => set(i, v)} result={r(i)?.gaps} answers={r(i)?.gap_answers} />}
          {b.type === "match" && (
            <div className="grid gap-2">
              {b.left.map((l, j) => {
                const ok = r(i)?.pairs?.[j];
                return (
                  <div key={j} className="grid items-center gap-2 sm:grid-cols-[1fr_1.3fr]">
                    <span className="font-semibold">{l} {r(i) && <Mark ok={ok} />}</span>
                    <select className={`field !py-2 ${r(i) ? (ok ? "!border-mint" : "!border-teach") : ""}`} disabled={!!result} value={(answers[i] || [])[j] || ""}
                      onChange={(e) => { const n = [...(answers[i] || [])]; n[j] = e.target.value; set(i, n); }} aria-label={`Пара для ${l}`}>
                      <option value="">– выберите –</option>
                      {b.right.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                    {r(i) && !ok && <span className="text-sm font-semibold text-[#146b4c] sm:col-start-2">{r(i).pair_answers[j]}</span>}
                  </div>
                );
              })}
            </div>
          )}
          {b.type === "choice" && <Questions questions={b.questions} value={answers[i]} onChange={(v) => set(i, v)} result={r(i)?.questions} answers={r(i)?.question_answers} />}
          {b.type === "listening" && (
            <>
              <Listen b={b} />
              {b.parts && <div className="mb-4"><Gaps parts={b.parts} bank={b.bank} value={answers[i]?.gaps} onChange={(v) => set(i, { ...(answers[i] || {}), gaps: v })} result={r(i)?.gaps} answers={r(i)?.gap_answers} /></div>}
              {b.questions?.length > 0 && <Questions questions={b.questions} value={answers[i]?.questions} onChange={(v) => set(i, { ...(answers[i] || {}), questions: v })} result={r(i)?.questions} answers={r(i)?.question_answers} />}
              {r(i)?.script && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Текст записи</summary><p className="mt-2 whitespace-pre-wrap text-ink-soft">{r(i).script}</p></details>}
            </>
          )}
          {b.type === "write" && (
            <>
              <p className="mb-3 whitespace-pre-wrap text-ink-soft">{b.prompt}</p>
              <textarea className="field min-h-[120px]" maxLength={3000} disabled={!!result && readOnly} value={answers[i] || ""} onChange={(e) => set(i, e.target.value)} aria-label="Ваш ответ" />
              <p className="mt-1 text-xs text-ink-mute">Этот ответ проверит преподаватель.</p>
            </>
          )}
          {b.type === "video" && <iframe title={b.title || "Видео"} src={b.embed} className="aspect-video w-full rounded-2xl" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />}
        </section>
      ))}
      <ErrorBox error={error} />
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {!result ? <button type="button" className="btn-brand btn-lg" disabled={busy} onClick={check}>{busy ? "Проверяем…" : submitLabel}</button>
            : <button type="button" className="btn-light" onClick={() => { setResult(null); }}>Ответить ещё раз</button>}
        </div>
      )}
    </div>
  );
}
