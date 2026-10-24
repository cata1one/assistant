import {
  ArrowDown, ArrowLeft, ArrowUp, BookOpenCheck, Copy, Eye, Layers, Pencil, Plus, Send, Sparkles, Trash2, Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { Empty, ErrorBox, Loading, Modal, Notice, PageTitle, Tabs } from "../ui/kit.jsx";
import { LANGS, ttsOf } from "../lib/langs.js";
import { useApi } from "./common.jsx";
import UnitPlayer from "./player.jsx";

const TYPES = {
  text: "Текст или правило", words: "Новые слова", gap: "Вставить слова в текст", match: "Пары: слово и значение",
  choice: "Тест с вариантами", listening: "Аудирование", write: "Свободный ответ", video: "Видео",
};
const KIND_SHORT = { gap: "пропуски", match: "пары", choice: "тест", listening: "аудирование", words: "слова", write: "письмо", text: "текст", video: "видео" };

// Черновик от генератора передаём в редактор без сохранения на сервере
let pendingDraft = null;

// == формат редактора: блок ↔ простой текст ======================================================
const splitPair = (line) => {
  const m = line.match(/^(.+?)\s+[—–=-]\s+(.+)$/);
  return m ? [m[1].trim(), m[2].trim()] : null;
};
const questionsToText = (qs = []) => qs.map((q) => [q.q, ...q.options.map((o, j) => (j === q.answer ? `*${o}` : o))].join("\n")).join("\n\n");
const textToQuestions = (text) => text.split(/\n\s*\n/).map((chunk) => {
  const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;
  const opts = lines.slice(1);
  const answer = opts.findIndex((o) => o.startsWith("*"));
  return { q: lines[0], options: opts.map((o) => o.replace(/^\*\s*/, "")), answer: Math.max(0, answer) };
}).filter(Boolean);

function toEdit(b) {
  const e = { ...b };
  if (b.type === "words") e.itemsText = (b.items || []).map((w) => (w.translation ? `${w.word} – ${w.translation}` : w.word)).join("\n");
  if (b.type === "match") e.pairsText = (b.pairs || []).map((p) => `${p[0]} – ${p[1]}`).join("\n");
  if (b.type === "choice" || b.type === "listening") e.qText = questionsToText(b.questions);
  return e;
}

function fromEdit(e) {
  const b = { type: e.type, title: e.title || "" };
  if (e.type === "text") b.body = e.body || "";
  if (e.type === "words") b.items = (e.itemsText || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const p = splitPair(l); return p ? { word: p[0], translation: p[1] } : { word: l }; });
  if (e.type === "gap") Object.assign(b, { text: e.text || "", bank: !!e.bank });
  if (e.type === "match") b.pairs = (e.pairsText || "").split("\n").map((l) => splitPair(l.trim())).filter(Boolean);
  if (e.type === "choice") b.questions = textToQuestions(e.qText || "");
  if (e.type === "listening") Object.assign(b, { script: e.script || "", lang: e.lang || "en-US", audio: e.audio || null, questions: textToQuestions(e.qText || "") });
  if (e.type === "write") b.prompt = e.prompt || "";
  if (e.type === "video") b.url = e.url || "";
  return b;
}

function BlockEditor({ b, onChange, audios }) {
  const set = (k) => (ev) => onChange({ ...b, [k]: ev.target.type === "checkbox" ? ev.target.checked : ev.target.value });
  const area = (k, ph, rows = 4) => <textarea className="field font-normal" rows={rows} value={b[k] || ""} onChange={set(k)} placeholder={ph} />;
  return (
    <div className="grid gap-3">
      <input className="field" value={b.title || ""} onChange={set("title")} placeholder="Заголовок задания" aria-label="Заголовок" />
      {b.type === "text" && area("body", "Текст, правило или инструкция", 6)}
      {b.type === "words" && <>{area("itemsText", "kitchen – кухня\nwardrobe – шкаф", 5)}<p className="text-xs text-ink-mute">При выдаче занятия эти слова сразу попадут в карточки ученика.</p></>}
      {b.type === "gap" && (
        <>
          {area("text", "I [have been] to London. She [has|'s] got a cat.", 6)}
          <p className="text-xs text-ink-mute">Правильный ответ – в квадратных скобках. Несколько верных вариантов – через «|»: [have been|'ve been].</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!b.bank} onChange={set("bank")} /> Показать слова для вставки (банк слов)</label>
        </>
      )}
      {b.type === "match" && <>{area("pairsText", "bustling – full of people and activity\nsuburb – пригород", 6)}<p className="text-xs text-ink-mute">По паре в строке через « – ». Ученик увидит правую колонку перемешанной.</p></>}
      {(b.type === "choice" || b.type === "listening") && (
        <>
          {b.type === "listening" && (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <select className="field" value={b.lang || "en-US"} onChange={set("lang")} aria-label="Язык озвучки">
                  <option value="en-GB">Английский (британский)</option>
                  {LANGS.map((l) => <option key={l.id} value={l.tts}>{l.title}</option>)}
                </select>
                <select className="field" value={b.audio || ""} onChange={set("audio")} aria-label="Аудиофайл">
                  <option value="">Озвучка текста браузером</option>
                  {audios.map((m) => <option key={m.id} value={m.url}>{m.title}</option>)}
                </select>
              </div>
              {area("script", "Текст записи. Пропуски для ученика – в [скобках]: My name is [Anna].", 5)}
              <p className="text-xs text-ink-mute">Без аудиофайла текст прочитает голос браузера – бесплатно. Аудиофайл загрузите в «Материалы».</p>
            </>
          )}
          {area("qText", "Вопрос?\n*правильный ответ\nнеправильный\nнеправильный\n\nСледующий вопрос?\n…", 7)}
          <p className="text-xs text-ink-mute">Вопрос, под ним варианты; правильный отметьте звёздочкой «*». Вопросы разделяйте пустой строкой.</p>
        </>
      )}
      {b.type === "write" && area("prompt", "Напишите 5 предложений о…", 3)}
      {b.type === "video" && <input className="field" type="url" value={b.url || ""} onChange={set("url")} placeholder="https://vk.com/video… или YouTube, Rutube" aria-label="Ссылка на видео" />}
    </div>
  );
}

function AssignModal({ unit, onClose }) {
  const students = useApi("/site/v1/students").data?.students?.filter((s) => s.joined);
  const [chat, setChat] = useState("");
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const send = async (e) => {
    e.preventDefault(); setError(null);
    try {
      const r = await request("POST", "/site/v1/homework", { chat_id: chat || students[0].chat_id, unit_id: unit.id, text: text || null, due: due || null });
      setMsg(`Занятие выдано${r.words_added ? `, в карточки добавлено слов: ${r.words_added}` : ""}.`);
    } catch (x) { setError(x); }
  };
  return (
    <Modal open onClose={onClose} title={`Выдать: ${unit.title}`}>
      {!students ? <Loading /> : !students.length ? <Notice>Пока нет подключившихся учеников.</Notice> : msg ? (
        <div className="grid gap-3"><Notice tone="ok">{msg}</Notice><button type="button" className="btn-light w-fit" onClick={onClose}>Готово</button></div>
      ) : (
        <form onSubmit={send} className="grid gap-3">
          <select className="field" value={chat} onChange={(e) => setChat(e.target.value)} aria-label="Ученик">{students.map((s) => <option key={s.chat_id} value={s.chat_id}>{s.name}</option>)}</select>
          <input className="field" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Комментарий (необязательно)" aria-label="Комментарий" />
          <input className="field" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Срок" />
          <ErrorBox error={error} />
          <button type="submit" className="btn-brand w-fit"><Send size={16} /> Выдать как домашнее задание</button>
        </form>
      )}
    </Modal>
  );
}

function CreateModal({ ai, onClose }) {
  const [f, setF] = useState({ topic: "", language: "en", level: "A2", words: "", text: "", wishes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const go = async (mode) => {
    setBusy(true); setError(null);
    try {
      pendingDraft = await request("POST", "/site/v1/units/generate", { ...f, mode });
      window.location.hash = "#/app/units/new";
    } catch (x) { setError(x); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Новое занятие" wide>
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_150px_120px]">
          <input className="field" value={f.topic} onChange={set("topic")} maxLength={200} placeholder="Тема: «Путешествия», «IELTS Speaking: работа», «HSK 2: еда»" aria-label="Тема" />
          <select className="field" value={f.language} onChange={set("language")} aria-label="Язык">{LANGS.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
          <input className="field" value={f.level} onChange={set("level")} maxLength={20} placeholder="A2, B1, HSK 2" aria-label="Уровень" />
        </div>
        <label className="label">Слова (необязательно)<textarea className="field font-normal" rows={4} value={f.words} onChange={set("words")} placeholder={"luggage – багаж\nboarding pass – посадочный талон"} /></label>
        <label className="label">Свой текст (необязательно)<textarea className="field font-normal" rows={3} value={f.text} onChange={set("text")} placeholder="Текст, по которому строить задания" /></label>
        {ai && <input className="field" value={f.wishes} onChange={set("wishes")} maxLength={1000} placeholder="Пожелания для ИИ: «для подростка, больше говорения»" aria-label="Пожелания" />}
        <ErrorBox error={error} />
        <div className="flex flex-wrap gap-2">
          {ai && <button type="button" className="btn-brand" disabled={busy || !f.topic.trim()} onClick={() => go("ai")}><Wand2 size={16} /> {busy ? "ИИ составляет занятие…" : "Создать с ИИ"}</button>}
          <button type="button" className={ai ? "btn-light" : "btn-brand"} disabled={busy} onClick={() => go("offline")}><Sparkles size={16} /> Собрать из моих слов и текста</button>
          <button type="button" className="btn-ghost" onClick={() => { pendingDraft = { title: f.topic || "Новое занятие", language: f.language, level: f.level, blocks: [] }; window.location.hash = "#/app/units/new"; }}>Пустое занятие</button>
        </div>
        {!ai && <p className="text-xs text-ink-mute">ИИ на сервере не подключён: занятие собирается из ваших слов и текста – пары, пропуски, тест и аудирование. Как подключить бесплатный ИИ – в README, раздел «Конструктор занятий».</p>}
      </div>
    </Modal>
  );
}

export function UnitsPage() {
  const { role } = useSession();
  const { data, error, reload } = useApi("/site/v1/units");
  const [tab, setTab] = useState("mine");
  const [create, setCreate] = useState(false);
  const [assign, setAssign] = useState(null);
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState(null);
  const copyLib = async (u) => {
    try { const c = await request("POST", `/site/v1/units/library/${u.id}`, {}); window.location.hash = `#/app/units/${c.id}`; } catch (x) { setErr(x); }
  };
  const remove = async (u) => {
    if (!window.confirm(`Удалить занятие «${u.title}»?`)) return;
    await request("POST", `/site/v1/units/${u.id}/delete`, {}).catch(setErr); reload();
  };
  const card = (u, lib) => (
    <div key={u.id} className="card flex flex-col !p-5">
      <div className="flex flex-wrap gap-1.5">{u.level && <span className="chip chip-brand">{u.level}</span>}{(u.tags || []).map((t) => <span key={t} className="chip">{t}</span>)}{u.shared && <span className="chip">база школы</span>}</div>
      <h3 className="mt-3 text-lg">{u.title}</h3>
      <p className="mt-1 text-xs text-ink-mute">{[...new Set(u.blocks.map((b) => KIND_SHORT[b.type]))].join(" · ")}</p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
        {lib ? (
          <>
            <button type="button" className="btn-light btn-sm" onClick={() => setPreview(u)}><Eye size={14} /> Посмотреть</button>
            <button type="button" className="btn-brand btn-sm" onClick={() => copyLib(u)}><Copy size={14} /> Взять себе</button>
          </>
        ) : (
          <>
            <a className="btn-light btn-sm" href={`#/app/units/${u.id}`}><Pencil size={14} /> Открыть</a>
            {role === "tutor" && <button type="button" className="btn-brand btn-sm" onClick={() => setAssign(u)}><Send size={14} /> Выдать</button>}
            {(u.mine || role === "school") && <button type="button" className="btn-ghost btn-sm ml-auto !px-2" onClick={() => remove(u)} aria-label="Удалить"><Trash2 size={14} /></button>}
          </>
        )}
      </div>
    </div>
  );
  return (
    <>
      <PageTitle title="Занятия" text="Интерактивные уроки: вставить слова, пары, тесты, аудирование. Выдавайте их как домашнее задание – ответы проверяются сами."
        actions={<button type="button" className="btn-brand" onClick={() => setCreate(true)}><Plus size={16} /> Создать занятие</button>} />
      <div className="mb-5"><Tabs label="Занятия" value={tab} onChange={setTab} items={[{ id: "mine", title: "Мои занятия" }, { id: "library", title: "Готовые: IELTS, HSK, грамматика" }]} /></div>
      <ErrorBox error={error || err} />
      {!data ? <Loading /> : tab === "mine" ? (
        !data.units.length ? <Empty icon={Layers} title="Занятий пока нет" text="Создайте занятие с ИИ или из своих слов – или возьмите готовое из библиотеки." action={<button type="button" className="btn-light" onClick={() => setTab("library")}>Открыть библиотеку</button>} />
          : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.units.map((u) => card(u, false))}</div>
      ) : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.library.map((u) => card(u, true))}</div>}
      {create && <CreateModal ai={data?.ai} onClose={() => setCreate(false)} />}
      {assign && <AssignModal unit={assign} onClose={() => setAssign(null)} />}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title || ""} wide>
        {preview && (
          <div className="grid gap-3">
            {preview.blocks.map((b, i) => (
              <div key={i} className="rounded-2xl border border-line p-3 text-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-brand">{TYPES[b.type]}</p>
                <p className="font-semibold">{b.title}</p>
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-ink-soft">{b.body || b.text || b.script || b.prompt || (b.items || []).map((w) => w.word).join(", ") || (b.pairs || []).map((p) => p[0]).join(", ") || (b.questions || []).map((q) => q.q).join(" · ")}</p>
              </div>
            ))}
            <button type="button" className="btn-brand w-fit" onClick={() => copyLib(preview)}><Copy size={14} /> Взять себе и изменить</button>
          </div>
        )}
      </Modal>
    </>
  );
}

export function UnitEditor({ id }) {
  const isNew = id === "new";
  const { role } = useSession();
  const [unit, setUnit] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [mode, setMode] = useState("edit");
  const [studentView, setStudentView] = useState(null);
  const [assign, setAssign] = useState(false);
  const audios = (useApi("/site/v1/materials").data?.materials || []).filter((m) => m.mime?.startsWith("audio/"));
  useEffect(() => {
    if (isNew) {
      const d = pendingDraft || { title: "Новое занятие", blocks: [] };
      setUnit({ ...d, blocks: d.blocks.map(toEdit) });
      if (d.notice) setMsg(d.notice);
      return;
    }
    request("GET", `/site/v1/units/${id}`).then((u) => setUnit({ ...u, blocks: u.blocks.map(toEdit) })).catch(setError);
  }, [id, isNew]);
  if (error && !unit) return <ErrorBox error={error} />;
  if (!unit) return <Loading />;
  const setBlock = (i, b) => setUnit({ ...unit, blocks: unit.blocks.map((x, j) => (j === i ? b : x)) });
  const move = (i, d) => { const bl = [...unit.blocks]; [bl[i], bl[i + d]] = [bl[i + d], bl[i]]; setUnit({ ...unit, blocks: bl }); };
  const save = async () => {
    setError(null); setMsg(null);
    try {
      const body = { title: unit.title, language: unit.language, level: unit.level, blocks: unit.blocks.map(fromEdit), source: unit.source };
      const saved = await request("POST", isNew ? "/site/v1/units" : `/site/v1/units/${id}`, body);
      pendingDraft = null;
      setMsg("Сохранено");
      if (isNew) window.location.hash = `#/app/units/${saved.id}`;
      else setUnit({ ...saved, blocks: saved.blocks.map(toEdit) });
      return saved;
    } catch (x) { setError(x); return null; }
  };
  const openPreview = async () => {
    const saved = await save();
    if (!saved) return;
    const v = await request("GET", `/site/v1/units/${saved.id}?view=student`).catch(setError);
    if (v) { setStudentView({ ...v.unit, id: saved.id }); setMode("preview"); }
  };
  return (
    <>
      <a href="#/app/units" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-ink-mute hover:text-ink"><ArrowLeft size={14} /> Все занятия</a>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input className="field min-w-[220px] flex-1 !text-xl font-bold" value={unit.title} onChange={(e) => setUnit({ ...unit, title: e.target.value })} aria-label="Название занятия" />
        <input className="field w-28" value={unit.level || ""} onChange={(e) => setUnit({ ...unit, level: e.target.value })} placeholder="Уровень" aria-label="Уровень" />
        <Tabs label="Режим" value={mode} onChange={(m) => (m === "preview" ? openPreview() : setMode(m))} items={[{ id: "edit", title: "Редактор" }, { id: "preview", title: "Как видит ученик" }]} />
      </div>
      {msg && <Notice tone="ok" className="mb-4">{msg}</Notice>}
      <ErrorBox error={error} />
      {mode === "preview" && studentView ? (
        <UnitPlayer key={studentView.id + JSON.stringify(unit.blocks).length} unit={studentView} submitLabel="Проверить (пробный прогон)"
          onSubmit={(answers) => request("POST", `/site/v1/units/${studentView.id}/check`, { answers })} />
      ) : (
        <div className="grid gap-3">
          {unit.blocks.map((b, i) => (
            <div key={i} className="card !p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="chip chip-brand">{i + 1}. {TYPES[b.type]}</span>
                <span className="ml-auto flex gap-1">
                  <button type="button" className="btn-ghost !p-1.5" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Выше"><ArrowUp size={15} /></button>
                  <button type="button" className="btn-ghost !p-1.5" disabled={i === unit.blocks.length - 1} onClick={() => move(i, 1)} aria-label="Ниже"><ArrowDown size={15} /></button>
                  <button type="button" className="btn-ghost !p-1.5" onClick={() => setUnit({ ...unit, blocks: unit.blocks.filter((_, j) => j !== i) })} aria-label="Удалить задание"><Trash2 size={15} /></button>
                </span>
              </div>
              <BlockEditor b={b} onChange={(nb) => setBlock(i, nb)} audios={audios} />
            </div>
          ))}
          <div className="card !p-4">
            <p className="mb-2 text-sm font-semibold">Добавить задание</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPES).map(([t, label]) => (
                <button key={t} type="button" className="btn-light btn-sm" onClick={() => setUnit({ ...unit, blocks: [...unit.blocks, { type: t, title: label, lang: ttsOf(unit.language) }] })}><Plus size={13} /> {label}</button>
              ))}
            </div>
          </div>
          <div className="sticky bottom-24 z-10 flex flex-wrap gap-2 rounded-3xl bg-cream/90 py-2 backdrop-blur lg:bottom-4">
            <button type="button" className="btn-brand" onClick={save}><BookOpenCheck size={16} /> Сохранить</button>
            {!isNew && role === "tutor" && <button type="button" className="btn-light" onClick={() => setAssign(true)}><Send size={16} /> Выдать ученику</button>}
          </div>
        </div>
      )}
      {assign && <AssignModal unit={{ id, title: unit.title }} onClose={() => setAssign(false)} />}
    </>
  );
}

/** Ученик выполняет занятие из домашнего задания. */
export function DoUnit({ hwId }) {
  const { data, error, reload } = useApi(`/site/v1/homework/${hwId}/unit`, [hwId]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const student = data.role === "student";
  return (
    <>
      <a href="#/app/homework" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-ink-mute hover:text-ink"><ArrowLeft size={14} /> Домашние задания</a>
      <PageTitle title={data.unit.title} text={student ? "Выполните задания и нажмите «Отправить» – ответы проверятся сразу." : data.result ? "Ответы ученика." : "Ученик ещё не выполнил занятие."} />
      {(student || data.result) && (
        <UnitPlayer unit={data.unit} result={data.result} readOnly={!student || data.status === "checked"} submitLabel="Отправить преподавателю"
          onSubmit={async (answers) => { const r = await request("POST", `/site/v1/homework/${hwId}/unit`, { answers }); reload(); return r; }} />
      )}
    </>
  );
}
