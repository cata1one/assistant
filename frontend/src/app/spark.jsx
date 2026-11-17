import { ArrowDown, BookOpen, RotateCcw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { sendVoice } from "../lib/voice.js";
import { ErrorBox, Loading } from "../ui/kit.jsx";
import Iskorka from "./Iskorka.jsx";
import VoiceButton from "./VoiceButton.jsx";
import { draftFromSpark } from "./units.jsx";

const IDEAS = {
  tutor: ["Составь план урока по Present Perfect для уровня B1", "Придумай упражнение по теме путешествий с ответами", "Объясни разницу между much и many"],
  school: ["Составь план вводного урока", "Помоги написать объявление о наборе в группу", "Создай чек-лист хорошего урока"],
  student: ["Объясни Present Perfect простыми словами", "Давай поговорим по-английски о хобби", "Помоги повторить мои слова"],
  parent: ["Как помочь ребёнку с английским дома?", "Где найти домашнее задание?", "Как оплатить занятие?"],
};

export function SparkMark({ size = 36, mood = "happy", still = true }) {
  return <Iskorka size={size} mood={mood} still={still} />;
}

export function SparkPage() {
  const { role } = useSession();
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const box = useRef(null);
  const load = () => request("GET", "/site/v1/spark").then(setData).catch(setError);
  useEffect(() => { load(); }, []);
  const pending = !!data?.messages.some((m) => m.status === "pending");
  useEffect(() => {
    if (!pending) return undefined;
    const timer = setInterval(load, 2500);
    return () => clearInterval(timer);
  }, [pending]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [data?.messages.length, pending]);

  const ask = async (question) => {
    const value = (question ?? text).trim();
    if (!value || sending || pending) return;
    setSending(true); setError(null);
    try { setData(await request("POST", "/site/v1/spark", { text: value })); setText(""); }
    catch (err) { setError(err); }
    finally { setSending(false); }
  };
  const voice = async (blob) => {
    setError(null);
    try { setData(await sendVoice("/site/v1/spark/voice", blob)); } catch (err) { setError(err); }
  };
  const clear = async () => {
    if (!window.confirm("Очистить переписку с Искоркой?")) return;
    try { setData(await request("POST", "/site/v1/spark/clear", {})); setError(null); } catch (err) { setError(err); }
  };
  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  const waiting = sending || pending;
  return <div className="mx-auto flex h-[calc(100dvh-10rem)] min-h-[440px] max-w-5xl flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-soft lg:h-[calc(100dvh-5rem)]">
    <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:px-6">
      <Iskorka size={48} mood={waiting ? "think" : "happy"} still />
      <div className="min-w-0 flex-1"><h1 className="text-lg font-bold">Искорка</h1><p className="text-xs text-ink-mute">{waiting ? "Готовлю ответ…" : data.ai ? "Помощник для занятий и языковой практики" : "Помощь по платформе · ИИ пока не подключён"}</p></div>
      {data.messages.length > 0 && <button type="button" className="btn-ghost !h-9 !w-9 !p-0" onClick={clear} disabled={waiting} aria-label="Очистить переписку"><RotateCcw size={17} /></button>}
    </header>
    <div ref={box} className="flex-1 space-y-4 overflow-y-auto bg-cream/30 px-4 py-5 md:px-8" aria-live="polite">
      {!data.messages.length && <div className="mx-auto max-w-2xl py-5 text-center md:py-10">
        <Iskorka size={90} mood="happy" still />
        <h2 className="mt-4 text-xl font-bold">Чем помочь сегодня?</h2>
        <p className="mt-2 text-sm text-ink-mute">Задайте вопрос, попросите объяснение или подготовьте материал к уроку.</p>
        <div className="mt-6 grid gap-2 text-left md:grid-cols-3">{(IDEAS[role] || IDEAS.student).map((q) => <button key={q} type="button" onClick={() => ask(q)} disabled={waiting} className="rounded-2xl border border-line bg-white p-4 text-sm leading-relaxed hover:border-brand hover:bg-brand-tint">{q}</button>)}</div>
      </div>}
      {data.messages.map((m) => <div key={m.id} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}>
        {m.role !== "user" && <Iskorka size={34} still mood={m.status === "error" ? "oops" : "happy"} className="mt-1 shrink-0" />}
        <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed md:max-w-[78%] ${m.role === "user" ? "rounded-br-md bg-ink text-white" : m.status === "error" ? "bg-teach-tint text-teach-deep" : "rounded-tl-md border border-line bg-white"}`}>
          {m.status === "pending" ? "Готовлю ответ…" : m.text}
          {m.voice && <span className="mt-1 block text-xs opacity-60">Голосовое</span>}
          {(role === "tutor" || role === "school") && m.role !== "user" && m.status === "done" && data.ai && <button type="button" className="mt-3 flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-left text-xs font-semibold" onClick={() => draftFromSpark(m.text)}><BookOpen size={14} /> Открыть как черновик занятия</button>}
        </div>
      </div>)}
    </div>
    {error && <div className="px-4 pt-2"><ErrorBox error={error} /></div>}
    <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="border-t border-line bg-white p-3 md:px-6">
      <div className="flex items-center gap-2"><input className="field !h-11 !py-0" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Напишите Искорке…" aria-label="Вопрос" />
        {text.trim() ? <button type="submit" className="btn-brand !h-11 !w-11 shrink-0 !p-0" disabled={waiting} aria-label="Отправить"><Send size={18} /></button> : <VoiceButton onSend={voice} disabled={waiting} />}
      </div>
      <p className="mt-2 text-xs text-ink-mute">{data.ai ? "Ответы ИИ могут содержать ошибки. Вопрос и сведения, нужные для ответа, передаются подключённому поставщику ИИ." : "Пока ИИ не подключён, Искорка отвечает на вопросы о Bright и помогает повторить слова."}</p>
    </form>
  </div>;
}
