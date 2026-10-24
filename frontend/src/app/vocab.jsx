import { Plus, Repeat, Search, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { request } from "../lib/api.js";
import { Empty, ErrorBox, Loading, Notice, PageTitle } from "../ui/kit.jsx";
import { useApi } from "./common.jsx";

const SOURCE = { lesson: "с урока", homework: "из ДЗ", tutor: "от преподавателя", student: "добавлено вами", library: "из занятия" };

function WordCard({ w, onDelete, tutorView }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="group relative">
      <button type="button" onClick={() => setFlipped(!flipped)} aria-label={`${w.word} – ${flipped ? "показать слово" : "показать перевод"}`}
        className={`card card-hover flex min-h-[110px] w-full flex-col items-center justify-center !p-4 text-center ${flipped ? "!bg-brand-tint" : ""}`}>
        <span className="font-display text-lg font-extrabold">{flipped ? w.translation || "–" : w.word}</span>
        {!flipped && w.transcription && <span className="mt-1 text-sm text-ink-mute">{w.transcription}</span>}
        {flipped && w.example && <span className="mt-1 text-xs text-ink-mute">{w.example}</span>}
        <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">{tutorView && w.source === "student" ? "добавил ученик" : SOURCE[w.source] || ""}</span>
      </button>
      {onDelete && (
        <button type="button" onClick={() => onDelete(w)} aria-label={`Убрать слово ${w.word}`} title="Убрать из карточек"
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white text-ink-mute opacity-0 shadow-soft transition hover:text-teach-deep focus:opacity-100 group-hover:opacity-100">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

/** Словарь: слова уроков, ДЗ, от преподавателя и свои. chatId – словарь конкретного ученика (для преподавателя). */
export function Vocab({ chatId, tutorView }) {
  const path = `/site/v1/vocab${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ""}`;
  const { data, error, reload } = useApi(path, [chatId]);
  const [q, setQ] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const add = async (e) => {
    e.preventDefault(); setErr(null); setMsg(null);
    try {
      const r = await request("POST", "/site/v1/vocab", { text, chat_id: chatId || undefined });
      setText(""); setMsg(`Добавлено слов: ${r.added}. Они уже в карточках.`); reload();
    } catch (x) { setErr(x); }
  };
  const remove = async (w) => {
    if (!window.confirm(`Убрать «${w.word}» из словаря и карточек?`)) return;
    try { await request("POST", "/site/v1/vocab/delete", { key: w.key, word: w.word, chat_id: chatId || undefined }); reload(); } catch (x) { setErr(x); }
  };
  const needle = q.trim().toLowerCase();
  const list = (data?.words || []).filter((w) => !needle || `${w.word} ${w.translation || ""}`.toLowerCase().includes(needle));
  return (
    <>
      <form onSubmit={add} className="card mb-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="label">{tutorView ? "Добавить слова ученику" : "Добавить свои слова"}
          <textarea className="field min-h-[64px] font-normal" required maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder={"kitchen – кухня\n你好 (nǐ hǎo) – привет"} />
        </label>
        <button type="submit" className="btn-brand"><Plus size={16} /> Добавить</button>
        <p className="text-xs text-ink-mute md:col-span-2">По слову в строке: «слово – перевод». Слова сразу появляются в карточках.</p>
        {msg && <Notice tone="ok" className="md:col-span-2">{msg}</Notice>}
        {err && <div className="md:col-span-2"><ErrorBox error={err} /></div>}
      </form>
      <label className="relative mb-4 block max-w-sm"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute" /><input className="field !pl-11" placeholder="Поиск по словарю" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск" /></label>
      <ErrorBox error={error} />
      {!data ? <Loading /> : !list.length ? <Empty icon={Sparkles} title={needle ? "Ничего не нашлось" : "Слов пока нет"} text="Слова попадают сюда с уроков, из домашних заданий и занятий, или добавьте их сами." />
        : <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{list.map((w) => <WordCard key={w.key} w={w} onDelete={remove} tutorView={tutorView} />)}</div>}
    </>
  );
}

export function WordsPage() {
  return (
    <>
      <PageTitle title="Словарь" text="Новые слова с уроков, из домашних заданий и от преподавателя. Лишнее можно убрать – кнопка в углу карточки."
        actions={<a href="#/app/cards" className="btn-brand"><Repeat size={16} /> Учить карточками</a>} />
      <Vocab />
    </>
  );
}
