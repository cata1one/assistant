import { RotateCcw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { sendVoice } from "../lib/voice.js";
import { ErrorBox, Loading } from "../ui/kit.jsx";
import VoiceButton from "./VoiceButton.jsx";

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
export function SparkMark({ size = 36 }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-sun" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" fill="#17171A" /></svg>
    </span>
  );
}

export function SparkPage() {
  const { role } = useSession();
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const box = useRef(null);
  const load = () => request("GET", "/site/v1/spark").then(setData).catch(setError);
  useEffect(() => { load(); }, []);
  const pending = data?.messages.some((m) => m.status === "pending");
  useEffect(() => {
    if (!pending) return undefined;
    const t = setInterval(load, 2500); // ответ ИИ готовится в фоне
    return () => clearInterval(t);
  }, [pending]);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [data?.messages.length, pending]);

  const ask = async (q) => {
    const value = (q ?? text).trim();
    if (!value || busy) return;
    setBusy(true); setError(null);
    try { setData(await request("POST", "/site/v1/spark", { text: value })); setText(""); } catch (x) { setError(x); }
    setBusy(false);
  };
  const voice = async (blob) => { setError(null); setData(await sendVoice("/site/v1/spark/voice", blob)); };
  const clear = async () => { if (window.confirm("Очистить переписку с Искоркой?")) setData(await request("POST", "/site/v1/spark/clear", {})); };

  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  const ideas = IDEAS[role] || IDEAS.student;
  return (
    <div className="panel flex h-[calc(100dvh-9.5rem)] min-h-[460px] flex-col lg:h-[calc(100dvh-5rem)]">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <SparkMark />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg">Искорка</h1>
          <p className="truncate text-[13px] text-ink-mute">{data.ai ? "Помощник: объяснит, придумает, проверит. Можно голосом" : "Подскажет по платформе и проверит слова. ИИ на сервере пока не включён"}</p>
        </div>
        {data.messages.length > 0 && <button type="button" className="btn-ghost !h-9 !w-9 !p-0" onClick={clear} aria-label="Очистить"><RotateCcw size={16} /></button>}
      </div>
      <div ref={box} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!data.messages.length && (
          <div className="mx-auto max-w-md py-6 text-center">
            <SparkMark size={56} />
            <p className="mt-4 text-lg font-semibold">Привет! Я Искорка.</p>
            <p className="mt-1 text-sm text-ink-mute">Спросите текстом или запишите голосовое. Вот с чего можно начать:</p>
            <div className="mt-4 grid gap-2">
              {ideas.map((q) => <button key={q} type="button" onClick={() => ask(q)} className="rounded-2xl border border-line bg-white px-4 py-2.5 text-left text-sm transition hover:border-ink/30">{q}</button>)}
            </div>
          </div>
        )}
        {data.messages.map((m) => (
          <div key={m.id} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role !== "user" && <SparkMark size={28} />}
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${m.role === "user" ? "rounded-br-md bg-ink text-white" : m.status === "error" ? "bg-teach-tint text-teach-deep" : "rounded-tl-md bg-cream"}`}>
              {m.status === "pending" ? <span className="inline-flex items-center gap-1.5 text-ink-mute"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-mute" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-mute [animation-delay:.15s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-mute [animation-delay:.3s]" /> думаю</span> : m.text}
              {m.voice && <span className="mt-1 block text-[11px] opacity-60">голосовое</span>}
            </div>
          </div>
        ))}
      </div>
      {error && <div className="px-4 pb-2"><ErrorBox error={error} /></div>}
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="relative flex items-center gap-2 border-t border-line p-2.5">
        <input className="field !h-10 !py-0" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={pending ? "Искорка отвечает…" : "Спросите Искорку"} aria-label="Вопрос" />
        {text.trim() ? <button type="submit" className="btn-brand !h-10 !w-10 shrink-0 !p-0" disabled={busy} aria-label="Отправить"><Send size={17} /></button>
          : <VoiceButton onSend={voice} disabled={busy} />}
      </form>
    </div>
  );
}
