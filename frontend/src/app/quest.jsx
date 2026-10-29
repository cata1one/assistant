import { Flame, Headphones, Snail, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ttsOf } from "../lib/langs.js";
import { ErrorBox } from "../ui/kit.jsx";
import Iskorka from "./Iskorka.jsx";
import { speak } from "./player.jsx";

/**
 * Занятие «как в Duolingo»: по одному заданию на экране, проверка сразу, ошибки возвращаются в конце.
 * onCheck(answers) – проверка без сохранения, onSubmit(answers) – итог (первые попытки) уходит преподавателю.
 */

// -- звуки без файлов: короткие тоны через Web Audio --------------------------------------------------
let ctx = null;
function tone(notes) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    for (const [f, d, type = "sine", v = 0.12] of notes) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + 0.02);
      t += d * 0.8;
    }
  } catch { /* без звука */ }
}
const SOUND = {
  ok: () => tone([[784, 0.12], [1175, 0.22]]),
  bad: () => tone([[220, 0.18, "triangle", 0.1], [185, 0.25, "triangle", 0.1]]),
  done: () => tone([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.35]]),
  tap: () => tone([[660, 0.05, "sine", 0.05]]),
};

const PRAISE = ["Отлично!", "Верно!", "Так держать!", "Супер!", "Блестяще!", "Именно так!", "Молодец!"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// -- разбор занятия на шаги ---------------------------------------------------------------------------
/** Текст с пропусками → предложения: в каждом шаге одно предложение и его пропуски. */
function gapLines(parts) {
  const lines = [];
  let cur = [];
  const push = () => { if (cur.some((x) => x.gap !== undefined)) lines.push(cur); else if (cur.length && lines.length) lines[lines.length - 1].push(...cur); cur = []; };
  parts.forEach((p, k) => {
    const bits = p.split(/(\n+|[.!?…]+\s+)/); // без lookbehind: старые iPhone его не знают
    bits.forEach((bit, j) => {
      if (j % 2 === 1) { const end = bit.trim(); if (end) cur.push({ text: end }); push(); return; }
      if (bit) cur.push({ text: bit });
    });
    if (k < parts.length - 1) cur.push({ gap: k });
  });
  push();
  return lines;
}

function buildSteps(unit) {
  const steps = [];
  unit.blocks.forEach((b, i) => {
    if (b.type === "words" && b.items?.length) steps.push({ kind: "words", i, b });
    else if (b.type === "text" && b.body) steps.push({ kind: "text", i, b });
    else if (b.type === "video" && b.embed) steps.push({ kind: "video", i, b });
    else if (b.type === "write") steps.push({ kind: "write", i, b });
    else if (b.type === "match" && b.left?.length) steps.push({ kind: "match", i, b });
    else if (b.type === "choice") b.questions.forEach((q, qi) => steps.push({ kind: "choice", i, qi, q, b }));
    else if (b.type === "gap" && b.parts) gapLines(b.parts).forEach((line) => steps.push({ kind: "gap", i, line, b }));
    else if (b.type === "listening") {
      if (b.parts) gapLines(b.parts).forEach((line) => steps.push({ kind: "gap", i, line, b, listen: true, nested: true }));
      (b.questions || []).forEach((q, qi) => steps.push({ kind: "choice", i, qi, q, b, listen: true, nested: true }));
    }
  });
  return steps.map((s, n) => ({ ...s, n, gaps: s.line ? s.line.filter((x) => x.gap !== undefined).map((x) => x.gap) : undefined }));
}

const TITLE = { words: "Новые слова", text: "Правило", video: "Посмотрите видео", write: "Напишите ответ", match: "Соедините пары", choice: "Выберите ответ", gap: "Вставьте пропущенное" };

// -- помощники ответов: обычный блок или аудирование (gaps/questions внутри) --------------------------
const getGaps = (answers, s) => (s.nested ? answers[s.i]?.gaps : answers[s.i]) || [];
const getQs = (answers, s) => (s.nested ? answers[s.i]?.questions : answers[s.i]) || [];
function withGaps(answers, s, gaps) { return { ...answers, [s.i]: s.nested ? { ...(answers[s.i] || {}), gaps } : gaps }; }
function withQs(answers, s, qs) { return { ...answers, [s.i]: s.nested ? { ...(answers[s.i] || {}), questions: qs } : qs }; }

function ListenButtons({ b }) {
  if (b.audio) return <audio controls src={b.audio} className="mb-5 w-full" />;
  return (
    <div className="mb-5 flex items-center gap-3">
      <button type="button" onClick={() => speak(b.speak, b.lang, 0.9)} className="grid h-16 w-16 place-items-center rounded-2xl bg-study text-white shadow-[0_4px_0_#1E44C0] transition active:translate-y-1 active:shadow-none" aria-label="Прослушать"><Headphones size={28} /></button>
      <button type="button" onClick={() => speak(b.speak, b.lang, 0.6)} className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-line bg-white text-ink-soft shadow-[0_3px_0_#E7E5DF] active:translate-y-0.5 active:shadow-none" aria-label="Медленно"><Snail size={20} /></button>
    </div>
  );
}

/** Объёмная плитка-кнопка, как в Duolingo. */
function Tile({ children, state, onClick, disabled, className = "" }) {
  const look = {
    idle: "border-line bg-white shadow-[0_3px_0_#E7E5DF] hover:bg-cream",
    picked: "border-study bg-study-tint text-study-deep shadow-[0_3px_0_#2B59E8]",
    ok: "border-mint bg-mint-soft text-[#146b4c] shadow-[0_3px_0_#1F9D63]",
    bad: "border-teach bg-teach-tint text-teach-deep shadow-[0_3px_0_#E4572E] animate-[isk-shake_.4s]",
    gone: "border-line bg-cream text-transparent shadow-none",
  }[state || "idle"];
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`rounded-2xl border-2 px-4 py-3 text-[16px] font-semibold transition active:translate-y-0.5 active:shadow-none disabled:cursor-default ${look} ${className}`}>{children}</button>
  );
}

// -- пары: тапнуть слово слева и значение справа ------------------------------------------------------
function MatchGame({ s, answers, setAnswers, check, onDone, onMiss }) {
  const right = useMemo(() => [...new Set(s.b.right)], [s.b.right]);
  const [left, setLeft] = useState(null);
  const [done, setDone] = useState({}); // индекс слева → значение справа
  const [bad, setBad] = useState(null);
  const tryPair = async (j, value) => {
    const next = [...(answers[s.i] || [])]; next[j] = value;
    const res = await check({ ...answers, [s.i]: next });
    if (res?.blocks?.[s.i]?.pairs?.[j]) {
      SOUND.ok(); setAnswers((a) => ({ ...a, [s.i]: next }));
      const d = { ...done, [j]: value }; setDone(d); setLeft(null);
      if (Object.keys(d).length === s.b.left.length) setTimeout(() => onDone(next), 350);
    } else {
      SOUND.bad(); onMiss(); setBad([j, value]); setTimeout(() => { setBad(null); setLeft(null); }, 500);
    }
  };
  const used = new Set(Object.values(done));
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="grid content-start gap-2.5">
        {s.b.left.map((l, j) => (
          <Tile key={j} state={done[j] !== undefined ? "ok" : bad?.[0] === j ? "bad" : left === j ? "picked" : "idle"} disabled={done[j] !== undefined}
            onClick={() => { SOUND.tap(); setLeft(j); }}>{l}</Tile>
        ))}
      </div>
      <div className="grid content-start gap-2.5">
        {right.map((r) => (
          <Tile key={r} state={used.has(r) ? "ok" : bad?.[1] === r ? "bad" : "idle"} disabled={used.has(r) || left === null}
            onClick={() => tryPair(left, r)}>{r}</Tile>
        ))}
      </div>
    </div>
  );
}

export default function Quest({ unit, onCheck, onSubmit, onExit, title }) {
  const steps = useMemo(() => buildSteps(unit), [unit]);
  const [queue, setQueue] = useState(() => steps.map((s) => s.n));
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState({});
  const first = useRef({}); // первые попытки – их видит преподаватель
  const firstSeen = useRef(new Set());
  const [feedback, setFeedback] = useState(null); // { ok, text, answer }
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [xp, setXp] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [graded, setGraded] = useState({ ok: 0, all: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [final, setFinal] = useState(null);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem("bright-quiet") === "1"; } catch { return false; } });
  const started = useRef(Date.now());
  const s = steps[queue[pos]];
  const play = (k) => { if (!muted) SOUND[k](); };
  const lang = ttsOf(unit.language);

  useEffect(() => { try { localStorage.setItem("bright-quiet", muted ? "1" : "0"); } catch { /* нет хранилища */ } }, [muted]);
  useEffect(() => { if (s?.listen && !s.b.audio) setTimeout(() => speak(s.b.speak, s.b.lang, 0.9), 300); }, [pos]); // eslint-disable-line react-hooks/exhaustive-deps

  const remember = (step, value) => { // первая попытка задания
    if (firstSeen.current.has(step.n)) return;
    firstSeen.current.add(step.n);
    first.current = value(first.current);
  };

  const check = async (ans) => { try { return await onCheck(ans); } catch (x) { setError(x); return null; } };

  const ready = !s ? false : s.kind === "gap" ? s.gaps.every((g) => (getGaps(answers, s)[g] || "").trim())
    : s.kind === "choice" ? getQs(answers, s)[s.qi] !== undefined && getQs(answers, s)[s.qi] !== null
      : s.kind === "write" ? (answers[s.i] || "").trim().length > 0 : true;

  const graded1 = (ok, isFirst) => {
    if (isFirst) setGraded((g) => ({ ok: g.ok + (ok ? 1 : 0), all: g.all + 1 }));
    if (ok) { const st = streak + 1; setStreak(st); setBest((b) => Math.max(b, st)); setXp((x) => x + (isFirst ? 10 : 5) + (st >= 3 ? 2 : 0)); play("ok"); }
    else { setStreak(0); setMistakes((m) => m + 1); play("bad"); setQueue((q) => (q.filter((n) => n === s.n).length < 3 ? [...q, s.n] : q)); }
  };

  const doCheck = async () => {
    if (!s || busy) return;
    if (["words", "text", "video", "write"].includes(s.kind)) {
      if (s.kind === "write") remember(s, (f) => ({ ...f, [s.i]: answers[s.i] }));
      next(); return;
    }
    const isFirst = !firstSeen.current.has(s.n);
    setBusy(true); setError(null);
    const res = await check(answers);
    setBusy(false);
    if (!res) return;
    const r = res.blocks?.[String(s.i)] || {};
    if (s.kind === "gap") {
      const ok = s.gaps.every((g) => r.gaps?.[g]);
      const answer = s.line.map((x) => (x.gap !== undefined ? r.gap_answers?.[x.gap] : x.text)).join("").trim();
      remember(s, (f) => withGaps(f, s, (() => { const a = [...getGaps(f, s)]; s.gaps.forEach((g) => { a[g] = getGaps(answers, s)[g]; }); return a; })()));
      graded1(ok, isFirst);
      setFeedback({ ok, text: ok ? pick(PRAISE) : "Правильный ответ:", answer: ok ? null : answer });
    } else if (s.kind === "choice") {
      const ok = !!r.questions?.[s.qi];
      remember(s, (f) => withQs(f, s, (() => { const a = [...getQs(f, s)]; a[s.qi] = getQs(answers, s)[s.qi]; return a; })()));
      graded1(ok, isFirst);
      setFeedback({ ok, text: ok ? pick(PRAISE) : "Правильный ответ:", answer: ok ? null : s.q.options[r.question_answers?.[s.qi]] });
    }
  };

  const next = async () => {
    setFeedback(null);
    if (s?.kind === "gap" || s?.kind === "choice") { // при повторе поле снова пустое
      setAnswers((a) => (s.kind === "gap" ? withGaps(a, s, getGaps(a, s).map((v, g) => (s.gaps.includes(g) ? "" : v)))
        : withQs(a, s, getQs(a, s).map((v, q) => (q === s.qi ? undefined : v)))));
    }
    if (pos + 1 < queue.length) { setPos(pos + 1); return; }
    setBusy(true);
    const merged = { ...answers, ...first.current };
    try { const res = await onSubmit(merged); setFinal(res || {}); play("done"); } catch (x) { setError(x); }
    setBusy(false);
  };

  useEffect(() => {
    const key = (e) => {
      if (e.key !== "Enter" || e.target.tagName === "TEXTAREA") return;
      e.preventDefault();
      if (feedback) next(); else if (ready) doCheck();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const progress = final ? 1 : queue.length ? pos / queue.length : 1;

  // -- финиш ---------------------------------------------------------------------------------------------
  if (final) {
    const acc = graded.all ? Math.round((graded.ok / graded.all) * 100) : 100;
    const min = Math.max(1, Math.round((Date.now() - started.current) / 60000));
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-paper px-4">
      <div className="relative mx-auto max-w-lg overflow-hidden py-10 text-center">
        <Confetti />
        <Iskorka size={150} mood="joy" />
        <h2 className="mt-4 text-3xl">{acc >= 90 ? "Великолепно!" : acc >= 60 ? "Занятие пройдено!" : "Хорошее начало!"}</h2>
        <p className="mt-2 text-ink-soft">{final.total ? `С первой попытки: ${graded.ok} из ${graded.all}. ` : ""}{onSubmit && title ? "Результат уже у преподавателя." : ""}</p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[["Опыт", `+${xp}`, "bg-sun-soft border-sun"], ["Точность", `${acc}%`, "bg-mint-soft border-mint"], ["Серия", `${best}`, "bg-teach-tint border-teach/60"]].map(([t, v, c]) => (
            <div key={t} className={`rounded-2xl border-2 px-2 py-3 ${c}`}><p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{t}</p><p className="num mt-1 text-2xl font-bold">{v}</p></div>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-mute">Время: {min} мин{mistakes ? ` · ошибок по ходу: ${mistakes}` : " · без единой ошибки"}</p>
        <button type="button" onClick={onExit} className="mt-7 w-full rounded-2xl bg-ink py-3.5 text-[17px] font-bold text-white shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none">Готово</button>
      </div>
      </div>
    );
  }

  if (!s) return null;
  const gapVals = s.kind === "gap" ? getGaps(answers, s) : [];
  const usedBank = new Set(s.kind === "gap" ? s.gaps.map((g) => gapVals[g]).filter(Boolean) : []);
  const fillNext = (w) => { const g = s.gaps.find((x) => !gapVals[x]); if (g === undefined) return; play("tap"); const a = [...gapVals]; a[g] = w; setAnswers(withGaps(answers, s, a)); };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-paper px-4 pt-[max(1rem,env(safe-area-inset-top))]">
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      {/* верх: выход, прогресс, серия */}
      <div className="flex items-center gap-3 pb-5">
        <button type="button" onClick={onExit} className="grid h-9 w-9 place-items-center rounded-xl text-ink-mute hover:bg-cream" aria-label="Выйти"><X size={22} /></button>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-cream">
          <div className="relative h-full rounded-full bg-mint transition-all duration-500" style={{ width: `${Math.max(4, progress * 100)}%` }}>
            <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/35" />
          </div>
        </div>
        {streak >= 2 && <span className="flex items-center gap-0.5 text-sm font-bold text-[#E4572E]"><Flame size={18} className="fill-current" />{streak}</span>}
        <button type="button" onClick={() => setMuted(!muted)} className="grid h-9 w-9 place-items-center rounded-xl text-ink-mute hover:bg-cream" aria-label={muted ? "Включить звук" : "Выключить звук"}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      </div>

      {/* задание */}
      <div className="flex-1" key={`${pos}-${s.n}`}>
        <div className="mb-5 flex items-end gap-3">
          <Iskorka size={56} mood={feedback ? (feedback.ok ? "joy" : "oops") : busy ? "think" : "happy"} />
          <div className="relative rounded-2xl border-2 border-line bg-white px-4 py-2.5 text-[17px] font-semibold before:absolute before:-left-[7px] before:bottom-4 before:h-3 before:w-3 before:rotate-45 before:border-b-2 before:border-l-2 before:border-line before:bg-white">
            {s.b.title && s.kind !== "words" ? s.b.title : TITLE[s.kind]}
          </div>
        </div>

        {s.listen && <ListenButtons b={s.b} />}

        {s.kind === "words" && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {s.b.items.map((w) => (
              <button key={w.word} type="button" onClick={() => speak(w.word.replace(/\s*\(.*\)$/, ""), lang)}
                className="flex items-center gap-3 rounded-2xl border-2 border-line bg-white px-4 py-3 text-left shadow-[0_3px_0_#E7E5DF] transition active:translate-y-0.5 active:shadow-none">
                <Volume2 size={18} className="shrink-0 text-study" />
                <span className="min-w-0"><span className="block text-[17px] font-bold">{w.word}</span>{w.translation && <span className="text-sm text-ink-mute">{w.translation}</span>}</span>
              </button>
            ))}
          </div>
        )}
        {s.kind === "text" && <div className="whitespace-pre-wrap rounded-2xl bg-cream p-5 text-[16px] leading-relaxed">{s.b.body}</div>}
        {s.kind === "video" && <iframe title={s.b.title || "Видео"} src={s.b.embed} className="aspect-video w-full rounded-2xl" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />}
        {s.kind === "write" && (
          <>
            {s.b.prompt && <p className="mb-3 whitespace-pre-wrap text-ink-soft">{s.b.prompt}</p>}
            <textarea className="field min-h-[160px] !text-[16px]" maxLength={3000} value={answers[s.i] || ""} onChange={(e) => setAnswers({ ...answers, [s.i]: e.target.value })} aria-label="Ваш ответ" />
            <p className="mt-2 text-sm text-ink-mute">Этот ответ проверит преподаватель.</p>
          </>
        )}
        {s.kind === "match" && (
          <MatchGame s={s} answers={answers} setAnswers={setAnswers} check={check} onMiss={() => { setStreak(0); setMistakes((m) => m + 1); }}
            onDone={(pairs) => { remember(s, (f) => ({ ...f, [s.i]: pairs })); setXp((x) => x + 15); setFeedback({ ok: true, text: "Все пары собраны!" }); play("done"); }} />
        )}
        {s.kind === "choice" && (
          <>
            <p className="mb-4 text-xl font-semibold leading-snug">{s.q.q}</p>
            <div className="grid gap-2.5">
              {s.q.options.map((o, j) => {
                const picked = getQs(answers, s)[s.qi] === j;
                return (
                  <Tile key={j} state={feedback ? (feedback.ok && picked ? "ok" : !feedback.ok && picked ? "bad" : "idle") : picked ? "picked" : "idle"} disabled={!!feedback}
                    className="flex items-center gap-3 text-left" onClick={() => { play("tap"); const a = [...getQs(answers, s)]; a[s.qi] = j; setAnswers(withQs(answers, s, a)); }}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 border-current/20 text-sm opacity-60">{j + 1}</span>{o}
                  </Tile>
                );
              })}
            </div>
          </>
        )}
        {s.kind === "gap" && (
          <>
            <p className="text-[20px] leading-[2.6]">
              {s.line.map((x, k) => (x.gap === undefined ? <span key={k}>{x.text}</span> : (
                s.b.bank ? (
                  <button key={k} type="button" disabled={!!feedback} onClick={() => { const a = [...gapVals]; a[x.gap] = ""; setAnswers(withGaps(answers, s, a)); }}
                    className={`mx-1 inline-block min-w-[4.5rem] rounded-xl border-b-[3px] px-2.5 align-baseline font-bold leading-[1.8] ${gapVals[x.gap] ? "border-study bg-study-tint text-study-deep" : "border-ink/25 bg-cream text-transparent"}`}>{gapVals[x.gap] || "…"}</button>
                ) : (
                  <input key={k} value={gapVals[x.gap] || ""} disabled={!!feedback} autoFocus={x.gap === s.gaps[0]} aria-label="Пропуск" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    onChange={(e) => { const a = [...gapVals]; a[x.gap] = e.target.value; setAnswers(withGaps(answers, s, a)); }}
                    style={{ width: `${Math.max(6, (gapVals[x.gap] || "").length + 2)}ch` }}
                    className="mx-1 rounded-xl border-b-[3px] border-ink/25 bg-cream px-2 py-0.5 text-center font-bold outline-none focus:border-study" />
                )
              )))}
            </p>
            {s.b.bank && (
              <div className="mt-6 flex flex-wrap gap-2.5">
                {s.b.bank.map((w, k) => <Tile key={k} state={usedBank.has(w) ? "gone" : "idle"} disabled={usedBank.has(w) || !!feedback} onClick={() => fillNext(w)}>{w}</Tile>)}
              </div>
            )}
          </>
        )}
        <ErrorBox error={error} />
      </div>

      {/* низ: проверить / обратная связь */}
      <div className={`sticky bottom-0 -mx-4 mt-6 border-t-2 px-4 md:mb-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 transition-colors md:mx-0 md:rounded-2xl md:border-2 ${feedback ? (feedback.ok ? "border-mint/40 bg-mint-soft" : "border-teach/40 bg-teach-tint") : "border-line bg-paper"}`}>
        {feedback && (
          <div className="mb-3">
            <p className={`text-xl font-bold ${feedback.ok ? "text-[#146b4c]" : "text-teach-deep"}`}>{feedback.text}</p>
            {feedback.answer && <p className="mt-0.5 text-[17px] text-teach-deep">{feedback.answer}</p>}
          </div>
        )}
        {feedback ? (
          <button type="button" onClick={next} disabled={busy} className={`w-full rounded-2xl py-3.5 text-[17px] font-bold text-white active:translate-y-1 active:shadow-none ${feedback.ok ? "bg-mint shadow-[0_4px_0_#146b4c]" : "bg-teach shadow-[0_4px_0_#C2421D]"}`}>Дальше</button>
        ) : (
          <button type="button" onClick={doCheck} disabled={!ready || busy || s.kind === "match"}
            className="w-full rounded-2xl bg-ink py-3.5 text-[17px] font-bold text-white shadow-[0_4px_0_#000] transition active:translate-y-1 active:shadow-none disabled:bg-line disabled:text-ink-mute disabled:shadow-none">
            {["words", "text", "video"].includes(s.kind) ? "Понятно, дальше" : s.kind === "match" ? "Соберите все пары" : s.kind === "write" ? "Готово" : busy ? "Проверяем…" : "Проверить"}
          </button>
        )}
      </div>
    </div>
    </div>
  );
}

/** Конфетти без библиотек: цветные полоски падают один раз. */
function Confetti() {
  const bits = useMemo(() => Array.from({ length: 36 }, (_, k) => ({
    left: Math.random() * 100, delay: Math.random() * 0.6, dur: 1.6 + Math.random() * 1.2, rot: Math.random() * 360,
    color: ["#FFD43B", "#1F9D63", "#2B59E8", "#E4572E", "#6E5BD8", "#FF7A8A"][k % 6],
  })), []);
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {bits.map((b, k) => <span key={k} className="absolute top-0 h-3 w-1.5 rounded-sm" style={{ left: `${b.left}%`, background: b.color, transform: `rotate(${b.rot}deg)`, animation: `confetti ${b.dur}s ${b.delay}s ease-in both` }} />)}
    </div>
  );
}
