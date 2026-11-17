import Iskorka from "./Iskorka.jsx";
import { RotateCcw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { sendVoice } from "../lib/voice.js";
import { ErrorBox, Loading } from "../ui/kit.jsx";
import VoiceButton from "./VoiceButton.jsx";
import { FAST_LOCAL_MODEL, LOCAL_MODEL, localMessages, startLocalSpark, streamLocalAnswer } from "../lib/localSpark.js";
import { draftFromSpark } from "./units.jsx";

// Подсказки, с чего начать: самые частые просьбы для каждой роли
const IDEAS = {
  tutor: ["Составь план урока на тему Present Perfect для B1", "Придумай 10 предложений на перевод по теме «Еда»",
    "Напиши родителям, что Миша стал увереннее говорить", "Объясни разницу между much и many для ребёнка 10 лет"],
  school: ["Как удержать учеников после пробного урока?", "Напиши объявление о наборе в группу английского",
    "Чек-лист хорошего урока для преподавателя"],
  student: ["Проверь мои слова", "Объясни Present Perfect простыми словами", "Давай поговорим по-английски о хобби",
    "Как запомнить неправильные глаголы?"],
  parent: ["Как помочь ребёнку с английским дома?", "Что такое Present Simple?", "Как оплатить занятие?"],
};

/** Знак Искорки: жёлтый кружок с искрой, как в логотипе. */
/** Маленькая Искорка для карточек и списка сообщений. */
export function SparkMark({ size = 36, mood = "happy", still = true }) {
  return <Iskorka size={size} mood={mood} still={still} />;
}

export function SparkPage({ compact = false }) {
  const { role } = useSession();
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [localMode, setLocalMode] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localChat, setLocalChat] = useState([]);
  const [localModel, setLocalModel] = useState(LOCAL_MODEL);
  const localEngine = useRef(null);
  const localRequest = useRef(0);
  const loadController = useRef(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; loadController.current?.abort(); localEngine.current?.close(); }; }, []);
  const enableLocal = async () => {
    if (localLoading) return;
    setError(null); setLocalLoading(true); setProgress(0);
    const controller = new AbortController();
    loadController.current = controller;
    try {
      const instance = await startLocalSpark((n) => { if (mounted.current && !controller.signal.aborted) setProgress(Number.isFinite(n) ? n : 0); }, localModel, controller.signal);
      if (!mounted.current || controller.signal.aborted) { instance.close(); return; }
      localEngine.current?.close(); localEngine.current = instance; setLocalMode(true);
    } catch (x) {
      if (mounted.current && x.name !== "AbortError") setError(new Error(`Не удалось включить ИИ на устройстве. Проверьте свободное место и подключение к интернету. ${x.message || ""}`));
    } finally { if (loadController.current === controller) loadController.current = null; if (mounted.current) setLocalLoading(false); }
  };
  const box = useRef(null);
  const load = () => request("GET", "/site/v1/spark").then(setData).catch(setError);
  useEffect(() => { load(); }, []);
  const pending = !localMode && data?.messages.some((m) => m.status === "pending");
  const [cheer, setCheer] = useState(false);
  const count = data?.messages.filter((m) => m.role !== "user" && m.status === "done").length || 0;
  const seen = useRef(null);
  useEffect(() => { // новый ответ – Искорка радуется пару секунд
    if (seen.current !== null && count > seen.current) { setCheer(true); const t = setTimeout(() => setCheer(false), 1600); seen.current = count; return () => clearTimeout(t); }
    seen.current = count; return undefined;
  }, [count]);
  const mood = busy || pending ? "think" : cheer ? "joy" : "happy";
  useEffect(() => {
    if (!pending) return undefined;
    const t = setInterval(load, 2500); // ответ ИИ готовится в фоне
    return () => clearInterval(t);
  }, [pending]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [data?.messages.length, localChat.length, pending]);

  const ask = async (q) => {
    const value = (q ?? text).trim();
    if (!value || busy) return;
    setBusy(true); setError(null);
    if (localMode) {
      const before = localChat;
      const requestId = ++localRequest.current;
      const replyId = `a-${requestId}-${Date.now()}`;
      setLocalChat([...before, { id: `u-${replyId}`, role: "user", text: value, status: "done" }, { id: replyId, role: "spark", text: "", status: "pending" }]);
      setText("");
      try {
        const reply = await streamLocalAnswer(localEngine.current.engine, localMessages(role, before, value), (partial) => {
          if (mounted.current && localRequest.current === requestId) setLocalChat((prev) => prev.map((m) => m.id === replyId ? { ...m, text: partial } : m));
        });
        if (mounted.current && localRequest.current === requestId) setLocalChat((prev) => prev.map((m) => m.id === replyId ? { ...m, text: reply, status: "done" } : m));
      } catch (x) {
        if (mounted.current && localRequest.current === requestId) {
          localEngine.current?.close(); localEngine.current = null; setLocalMode(false); setText(value); setError(x);
        }
      }
      if (mounted.current && localRequest.current === requestId) setBusy(false);
      return;
    }
    try { setData(await request("POST", "/site/v1/spark", { text: value })); setText(""); } catch (x) { setError(x); }
    setBusy(false);
  };
  const voice = async (blob) => { setError(null); setData(await sendVoice("/site/v1/spark/voice", blob)); };
  const clear = async () => { if (window.confirm("Очистить переписку с Искоркой?")) { if (localMode) setLocalChat([]); else setData(await request("POST", "/site/v1/spark/clear", {})); } };

  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  const ideas = IDEAS[role] || IDEAS.student;
  const messages = localMode ? localChat : data.messages;
  return (
    <div className={compact ? "flex h-[min(32rem,60dvh)] min-h-[280px] flex-col" : "panel flex h-[calc(100dvh-9.5rem)] min-h-[460px] flex-col lg:h-[calc(100dvh-5rem)]"}>
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <Iskorka size={46} mood={mood} />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg leading-tight">Искорка</h1>
          <p className="truncate text-[13px] text-ink-mute">{busy || pending ? "думает…" : localMode ? "бесплатно на вашем устройстве" : data.ai ? "объясню, придумаю, проверю. Можно голосом" : "подскажу по платформе и проверю слова"}</p>
        </div>
        {messages.length > 0 && <button type="button" className="btn-ghost !h-9 !w-9 !p-0" onClick={clear} aria-label="Очистить"><RotateCcw size={16} /></button>}
      </div>
      <div className="border-b border-line px-4 py-2 text-sm">
        {localMode ? <div className="flex flex-wrap items-center justify-between gap-2"><span>Ответы создаются на устройстве. Проверяйте материалы перед уроком.</span><button type="button" disabled={busy} className="btn-ghost btn-sm" onClick={() => { localEngine.current?.close(); localEngine.current = null; setLocalChat([]); setLocalMode(false); }}>Выключить</button></div>
          : <div><div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="spark-model">Модель ИИ</label><select id="spark-model" className="field !h-9 !w-auto !py-0 text-xs" disabled={localLoading || busy || pending} value={localModel} onChange={(e) => setLocalModel(e.target.value)}><option value={LOCAL_MODEL}>Обычная — точнее</option><option value={FAST_LOCAL_MODEL}>Облегчённая — быстрее</option></select><button type="button" className="btn-light btn-sm" disabled={localLoading || busy || pending} onClick={enableLocal}>{localLoading ? `Этап загрузки ИИ: ${Math.round(progress * 100)}%` : "Включить бесплатный ИИ на устройстве"}</button>{localLoading && <button type="button" className="btn-ghost btn-sm" onClick={() => loadController.current?.abort()}>Отменить загрузку</button>}</div><p className="mt-1 text-xs text-ink-mute">Обычная модель: около 900 МБ; облегчённая меньше и может отвечать проще. При первом запуске нужен интернет. Локальная переписка не сохраняется после закрытия.</p></div>}
      </div>
      <div ref={box} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!messages.length && (
          <div className="mx-auto max-w-md py-4 text-center">
            <Iskorka size={compact ? 76 : 132} mood="happy" />
            <div className="relative mx-auto mt-3 w-fit rounded-2xl bg-sun-soft px-4 py-2.5 text-[15px] font-semibold before:absolute before:-top-1.5 before:left-1/2 before:h-3 before:w-3 before:-translate-x-1/2 before:rotate-45 before:bg-sun-soft">Привет! Я Искорка ✨</div>
            <p className="mt-3 text-sm text-ink-mute">Спросите текстом или запишите голосовое. Вот с чего можно начать:</p>
            <div className="mt-4 grid gap-2">
              {ideas.map((q) => <button key={q} type="button" onClick={() => ask(q)} className="rounded-2xl border border-line bg-white px-4 py-2.5 text-left text-sm transition hover:border-ink/30">{q}</button>)}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role !== "user" && <Iskorka size={34} still mood={m.status === "pending" ? "think" : m.status === "error" ? "oops" : "happy"} className="mt-0.5" />}
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${m.role === "user" ? "rounded-br-md bg-ink text-white" : m.status === "error" ? "bg-teach-tint text-teach-deep" : "rounded-tl-md bg-cream"}`}>
              {m.status === "pending" && !m.text ? <span className="text-ink-mute">Готовлю ответ…</span> : m.text}
              {m.voice && <span className="mt-1 block text-[11px] opacity-60">голосовое</span>}
              {localMode && (role === "tutor" || role === "school") && m.role !== "user" && m.status === "done" && <button type="button" className="mt-3 block rounded-lg border border-line bg-white px-3 py-1.5 text-left text-xs font-semibold text-ink" onClick={() => draftFromSpark(m.text)}>Открыть ответ как черновик занятия</button>}
            </div>
          </div>
        ))}
      </div>
      {error && <div className="px-4 pb-2"><ErrorBox error={error} /></div>}
      {localMode && busy && <div className="px-4 pb-2"><button type="button" className="btn-light btn-sm" onClick={() => { localRequest.current++; localEngine.current?.close(); localEngine.current = null; setLocalMode(false); setBusy(false); setError(new Error("Ответ остановлен. Вы можете снова включить ИИ или выбрать облегчённую модель.")); }}>Остановить ответ</button></div>}
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="relative flex items-center gap-2 border-t border-line p-2.5">
        <input className="field !h-10 !py-0" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={pending ? "Искорка отвечает…" : "Спросите Искорку"} aria-label="Вопрос" />
        {text.trim() ? <button type="submit" className="btn-brand !h-10 !w-10 shrink-0 !p-0" disabled={busy} aria-label="Отправить"><Send size={17} /></button>
          : localMode ? <button type="submit" className="btn-brand !h-10 !w-10 shrink-0 !p-0" disabled aria-label="Введите вопрос"><Send size={17} /></button> : <VoiceButton onSend={voice} disabled={busy} />}
      </form>
    </div>
  );
}
