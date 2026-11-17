import {
  ArrowDown, ArrowLeft, ArrowUp, BookOpenCheck, Copy, Eye, FileText, Layers, Pencil, Plus, Send, Sparkles, Trash2, Wand2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { Empty, ErrorBox, Loading, Modal, Notice, PageTitle, Tabs } from "../ui/kit.jsx";
import { LANGS, ttsOf } from "../lib/langs.js";
import { useApi } from "./common.jsx";
import Iskorka from "./Iskorka.jsx";
import PdfImport from "./pdfimport.jsx";
import UnitPlayer from "./player.jsx";
import Quest from "./quest.jsx";
import { BookShelf, BookView } from "./books.jsx";

const TYPES = {
  text: "Текст или правило", words: "Новые слова", gap: "Вставить слова в текст", match: "Пары: слово и значение",
  choice: "Тест с вариантами", listening: "Аудирование", write: "Свободный ответ", video: "Видео",
};
const TYPE_EXAMPLES = {
  text: "Объяснение, история или текст для чтения",
  words: "Слова и перевод для изучения",
  gap: "Пропуски с ответами в [скобках]",
  match: "Соединить слова и определения",
  choice: "Вопросы с вариантами ответа",
  listening: "Запись или озвученный текст",
  write: "Ответ в свободной форме",
  video: "Видео и вопросы к нему",
};
const KIND_SHORT = { gap: "пропуски", match: "пары", choice: "тест", listening: "аудирование", words: "слова", write: "письмо", text: "текст", video: "видео" };

// Черновик от генератора передаём в редактор без сохранения на сервере
let pendingDraft = null;

// The teacher explicitly chooses an answer; it is only a draft until they save it.
export function draftFromSpark(text) {
  pendingDraft = { title: "Черновик от Искорки", language: "en", level: "", blocks: [{ type: "text", title: "Материал от Искорки", body: text }], notice: "Проверьте содержание и добавьте интерактивные задания перед выдачей." };
  window.location.hash = "#/app/units/new";
}

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
  if (answer < 0) return null;
  return { q: lines[0], options: opts.map((o) => o.replace(/^\*\s*/, "")), answer };
}).filter(Boolean);

function toEdit(b) {
  const e = { ...b };
  if (b.type === "words") e.itemsText = b.editor?.itemsText ?? (b.items || []).map((w) => (w.translation ? `${w.word} – ${w.translation}` : w.word)).join("\n");
  if (b.type === "match") e.pairsText = b.editor?.pairsText ?? (b.pairs || []).map((p) => `${p[0]} – ${p[1]}`).join("\n");
  if (b.type === "choice" || b.type === "listening" || b.type === "video") e.qText = b.editor?.qText ?? questionsToText(b.questions);
  return e;
}

function fromEdit(e) {
  const b = { type: e.type, title: e.title || "", context: e.context || "", instruction: e.instruction || "" };
  b.editor = Object.fromEntries(["itemsText", "pairsText", "qText"].filter((key) => typeof e[key] === "string").map((key) => [key, e[key]]));
  if (e.type === "text") b.body = e.body || "";
  if (e.type === "words") b.items = (e.itemsText || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const p = splitPair(l); return p ? { word: p[0], translation: p[1] } : { word: l }; });
  if (e.type === "gap") Object.assign(b, { text: e.text || "", bank: !!e.bank });
  if (e.type === "match") b.pairs = (e.pairsText || "").split("\n").map((l) => splitPair(l.trim())).filter(Boolean);
  if (e.type === "choice") b.questions = textToQuestions(e.qText || "");
  if (e.type === "listening") Object.assign(b, { script: e.script || "", lang: e.lang || "en-US", audio: e.audio || null, audio_start: Number(e.audio_start || 0), audio_end: e.audio_end === "" || e.audio_end == null ? null : Number(e.audio_end), questions: textToQuestions(e.qText || "") });
  if (e.type === "write") b.prompt = e.prompt || "";
  if (e.type === "video") Object.assign(b, { url: e.url || "", questions: textToQuestions(e.qText || "") });
  return b;
}

function BlockEditor({ b, onChange, audios }) {
  const [pdf, setPdf] = useState(false);
  const field = useRef(null);
  const hide = () => { // выделенное слово или фразу превращает в [ответ]
    const el = field.current;
    if (!el || el.selectionStart === el.selectionEnd) return;
    const t = b.text || "";
    onChange({ ...b, text: `${t.slice(0, el.selectionStart)}[${t.slice(el.selectionStart, el.selectionEnd)}]${t.slice(el.selectionEnd)}` });
  };
  const set = (k) => (ev) => onChange({ ...b, [k]: ev.target.type === "checkbox" ? ev.target.checked : ev.target.value });
  const area = (k, ph, rows = 4) => <textarea className="field font-normal" rows={rows} value={b[k] || ""} onChange={set(k)} placeholder={ph} />;
  return (
    <div className="grid gap-3">
      <input className="field" value={b.title || ""} onChange={set("title")} placeholder="Заголовок задания" aria-label="Заголовок" />
      {["gap", "choice", "listening", "write"].includes(b.type) && <details open className="rounded-xl border border-line p-3">
        <summary className="cursor-pointer text-sm font-semibold">Контекст и инструкция к заданию</summary>
        <div className="mt-3 grid gap-3"><label className="label">Ситуация или исходный текст{area("context", "Этот текст останется рядом с вопросом в режиме ученика.", 3)}</label>
        <label className="label">Что нужно сделать{area("instruction", "Укажите форму ответа, ограничения и критерии.", 2)}</label></div>
      </details>}
      {b.type === "text" && <>{area("body", "Текст, правило или инструкция", 6)}<button type="button" className="btn-light btn-sm w-fit" onClick={() => setPdf(true)}><FileText size={14} /> Вставить из PDF</button></>}
      {b.type === "words" && <>{area("itemsText", "kitchen – кухня\nwardrobe – шкаф", 5)}<p className="text-xs text-ink-mute">При выдаче занятия эти слова сразу попадут в карточки ученика.</p></>}
      {b.type === "gap" && (
        <>
          <textarea ref={field} className="field font-normal" rows={4} dir="auto" value={b.text || ""} onChange={set("text")} placeholder="I [have been] to London. She [has|'s] got a cat." />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-light btn-sm" onClick={hide} title="Выделите слово в тексте и нажмите"><Eye size={14} /> Скрыть выделенное в [ ]</button>
            <button type="button" className="btn-light btn-sm" onClick={() => setPdf(true)}><FileText size={14} /> Вставить из PDF</button>
          </div>
          <p className="text-xs text-ink-mute">Правильный ответ – в квадратных скобках. Например: I [work] here. Несколько верных вариантов – через «|»: [have been|'ve been].</p>
          {!!b.text && <div className="rounded-xl border border-line bg-paper p-4">
            <p className="mb-2 text-xs font-semibold text-ink-mute">Предпросмотр для ученика</p>
            <p className="whitespace-pre-wrap leading-loose">{b.text.split(/(\[[^\[\]\n]{1,80}\])/g).map((part, i) =>
              /^\[[^\[\]\n]{1,80}\]$/.test(part)
                ? <input key={i} className="mx-1 inline-block w-28 rounded-md border border-line bg-white px-2 py-1 align-baseline text-sm" aria-label={`Пропуск ${Math.ceil(i / 2)}`} placeholder="Ответ" disabled />
                : <span key={i}>{part}</span>
            )}</p>
          </div>}
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
              {b.audio && <div className="grid gap-3 sm:grid-cols-2">
                <label className="label">Начало фрагмента, сек.<input type="number" min="0" step="0.1" className="field" value={b.audio_start ?? 0} onChange={set("audio_start")} /></label>
                <label className="label">Конец фрагмента, сек.<input type="number" min="0" step="0.1" className="field" placeholder="До конца записи" value={b.audio_end ?? ""} onChange={set("audio_end")} /></label>
              </div>}
              {area("script", "Текст записи. Пропуски для ученика – в [скобках]: My name is [Anna].", 5)}
              <p className="text-xs text-ink-mute">Без аудиофайла текст прочитает голос браузера – бесплатно. Аудиофайл загрузите в «Материалы».</p>
            </>
          )}
          {area("qText", "Вопрос?\n*правильный ответ\nнеправильный\nнеправильный\n\nСледующий вопрос?\n…", 7)}
          <p className="text-xs text-ink-mute">Вопрос, под ним варианты; правильный отметьте звёздочкой «*». Вопросы разделяйте пустой строкой.</p>
        </>
      )}
      <PdfImport open={pdf} onClose={() => setPdf(false)} onInsert={(t) => onChange(b.type === "text" ? { ...b, body: `${b.body ? `${b.body}\n\n` : ""}${t}` } : { ...b, text: `${b.text ? `${b.text}\n\n` : ""}${t}` })} />
      {b.type === "write" && area("prompt", "Напишите 5 предложений о…", 3)}
      {b.type === "video" && (
        <>
          <input className="field" type="url" value={b.url || ""} onChange={set("url")} placeholder="https://vk.com/video… или YouTube, Rutube" aria-label="Ссылка на видео" />
          {area("qText", "Вопросы на понимание речи (необязательно):\nО чём говорит девушка?\n*О поездке\nО работе\nО погоде", 6)}
          <p className="text-xs text-ink-mute">Ученик посмотрит видео и ответит на вопросы. Правильный вариант отметьте «*», вопросы разделяйте пустой строкой.</p>
        </>
      )}
    </div>
  );
}

function AssignModal({ unit, onClose }) {
  const students = useApi("/site/v1/students").data?.students?.filter((s) => s.joined);
  const [chat, setChat] = useState("");
  const groups = useApi("/site/v1/groups").data?.groups || [];
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const send = async (e) => {
    e.preventDefault(); setError(null);
    try {
      const selected = chat.startsWith("group:") ? groups.find((g) => g.id === chat.slice(6)) : null;
      const recipients = selected ? students.filter((s) => selected.members.includes(s.pair_id)) : [students.find((s) => s.chat_id === chat) || students[0]];
      if (!recipients.length) throw new Error("В классе пока нет подключившихся учеников.");
      const results = await Promise.allSettled(recipients.map((s) => request("POST", "/site/v1/homework", { chat_id: s.chat_id, unit_id: unit.id, text: text || null, due: due || null })));
      const failed = results.flatMap((r, i) => r.status === "rejected" ? [recipients[i].name] : []);
      setMsg(failed.length ? `Выдано: ${recipients.length - failed.length} из ${recipients.length}. Не удалось выдать: ${failed.join(", ")}. Повторите выдачу этим ученикам отдельно.` : `Занятие выдано ученикам: ${recipients.length}.`);
    } catch (x) { setError(x); }
  };
  return (
    <Modal open onClose={onClose} title={`Выдать: ${unit.title}`}>
      {!students ? <Loading /> : !students.length ? <Notice>Пока нет подключившихся учеников.</Notice> : msg ? (
        <div className="grid gap-3"><Notice tone="ok">{msg}</Notice><button type="button" className="btn-light w-fit" onClick={onClose}>Готово</button></div>
      ) : (
        <form onSubmit={send} className="grid gap-3">
          <select className="field" value={chat} onChange={(e) => setChat(e.target.value)} aria-label="Ученик">{students.map((s) => <option key={s.chat_id} value={s.chat_id}>{s.name}</option>)}{groups.map((g) => <option key={g.id} value={`group:${g.id}`}>Класс: {g.title}</option>)}</select>
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
  const [pdf, setPdf] = useState(false);
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
        <label className="label">Свой текст или упражнение (необязательно)<textarea className="field font-normal" rows={4} value={f.text} onChange={set("text")} placeholder={"Вставьте текст. Правильные ответы пишите в [квадратных скобках]: I [have been] to London. Ученик увидит пропуски, ответы видны только вам."} /></label>
        <div className="-mt-1 flex flex-wrap items-center gap-3"><button type="button" className="btn-light btn-sm" onClick={() => setPdf(true)}><FileText size={14} /> Вставить из PDF</button><p className="text-xs text-ink-mute">Скобки не расставили – не страшно: пропуски сделаем из ваших слов.</p></div>
        <PdfImport open={pdf} onClose={() => setPdf(false)} onInsert={(t) => setF((x) => ({ ...x, text: `${x.text ? `${x.text}\n\n` : ""}${t}`.slice(0, 5000) }))} />
        {ai && <input className="field" value={f.wishes} onChange={set("wishes")} maxLength={1000} placeholder="Пожелания для ИИ: «для подростка, больше говорения»" aria-label="Пожелания" />}
        <ErrorBox error={error} />
        <div className="flex flex-wrap gap-2">
          {ai && <button type="button" className="btn-brand" disabled={busy || !f.topic.trim()} onClick={() => go("ai")}><Wand2 size={16} /> {busy ? "ИИ составляет занятие…" : "Создать с ИИ"}</button>}
          <button type="button" className={ai ? "btn-light" : "btn-brand"} disabled={busy} onClick={() => go("offline")}><Sparkles size={16} /> Собрать из моих слов и текста</button>
          <button type="button" className="btn-ghost" onClick={() => { pendingDraft = { title: f.topic || "Новое занятие", language: f.language, level: f.level, blocks: [] }; window.location.hash = "#/app/units/new"; }}>Пустое занятие</button>
        </div>
        <p className="text-xs text-ink-mute">{ai ? "Проверьте созданный ИИ черновик и ответы перед выдачей ученикам." : "ИИ пока не подключён. Можно собрать занятие из своих материалов или создать его вручную."}</p>
      </div>
    </Modal>
  );
}

export function UnitsPage({ embedded = false, tab: fixedTab } = {}) {
  const { role } = useSession();
  const { data, error, reload } = useApi("/site/v1/units");
  const [ownTab, setTab] = useState("mine");
  const tab = fixedTab || ownTab;
  const [lang, setLang] = useState("all");
  const [tag, setTag] = useState("all");
  const [create, setCreate] = useState(false);
  const [assign, setAssign] = useState(null);
  const [preview, setPreview] = useState(null);
  const [quest, setQuest] = useState(false);
  const [book, setBook] = useState(null);
  const shelf = useApi(tab === "library" ? "/site/v1/library" : null, [tab]);
  const [err, setErr] = useState(null);
  const open = async (u) => { // тяжёлое занятие подгружается только при открытии
    try { setPreview(await request("GET", `/site/v1/library/unit/${u.id}`)); } catch (x) { setErr(x); }
  };
  const copyLib = async (u) => {
    try { const c = await request("POST", `/site/v1/units/library/${u.id}`, {}); window.location.hash = `#/app/units/${c.id}`; } catch (x) { setErr(x); }
  };
  const remove = async (u) => {
    if (!window.confirm(`Удалить занятие «${u.title}»?`)) return;
    await request("POST", `/site/v1/units/${u.id}/delete`, {}).catch(setErr); reload();
  };
  const card = (u, lib) => (
    <div key={u.id} className="panel group flex flex-col p-4 transition hover:border-ink/25">
      <div className="flex flex-wrap gap-1">
        {u.level && <span className="chip !bg-ink !text-white">{u.level}</span>}
        {(u.tags || []).slice(0, 2).map((t) => <span key={t} className="chip">{t}</span>)}
        {u.shared && <span className="chip">база школы</span>}
      </div>
      <h3 className="mt-2.5 text-[15px] font-semibold leading-snug">{u.title}</h3>
      {u.summary && <p className="mt-1 line-clamp-2 text-[13px] text-ink-mute">{u.summary}</p>}
      <p className="mt-1.5 text-xs text-ink-mute">{u.blocks.length} {u.blocks.length === 1 ? "задание" : u.blocks.length < 5 ? "задания" : "заданий"} · {[...new Set(u.blocks.map((b) => KIND_SHORT[b.type]))].slice(0, 4).join(", ")}</p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-3.5">
        {lib ? (
          <>
            <button type="button" className="btn-light btn-sm" onClick={() => open(u)}><Eye size={14} /> Посмотреть</button>
            {role !== "student" && <button type="button" className="btn-brand btn-sm" onClick={() => copyLib(u)}><Copy size={14} /> Взять себе</button>}
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
  const library = shelf.data?.library || [];
  const langs = [...new Set(library.map((u) => u.language).filter(Boolean))];
  const tags = [...new Set(library.flatMap((u) => u.tags || []))];
  const libList = library.filter((u) => (lang === "all" || u.language === lang) && (tag === "all" || (u.tags || []).includes(tag)));
  const LANG_TITLE = Object.fromEntries(LANGS.map((l) => [l.id, `${l.flag} ${l.title}`]));
  const chip = (active) => `chip !px-2.5 !py-1 !text-[13px] ${active ? "!bg-ink !text-white" : ""}`;
  return (
    <>
      {!embedded && <PageTitle title="Занятия" text="Интерактивные уроки: вставить слова, пары, тесты, аудирование. Выдавайте их как домашнее задание – ответы проверяются сами." />}
      {!fixedTab && <div className="mb-5"><Tabs label="Занятия" value={tab} onChange={setTab} items={[{ id: "mine", title: "Мои занятия" }, { id: "library", title: "Учебники Bright" }]} /></div>}
      <ErrorBox error={error || err} />
      {!data ? <Loading /> : tab === "mine" ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-brand" onClick={() => setCreate(true)}><Plus size={16} /> Создать занятие</button>
            <span className="text-[13px] text-ink-mute">{data.ai ? "С ИИ по теме или из ваших слов и текста" : "Из ваших слов и текста: задания соберутся сами"}</span>
          </div>
          {!data.units.length ? <Empty icon={Layers} title="Своих занятий пока нет" text="Создайте занятие за минуту или возьмите готовое из курсов Bright и поменяйте под ученика." />
            : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.units.map((u) => card(u, false))}</div>}
        </>
      ) : (
        book ? <BookView bookId={book} onBack={() => setBook(null)} onAssign={(u) => setAssign(u)} /> : <>
          <h2 className="mb-3 text-xl">Учебники</h2>
          {shelf.data ? <BookShelf books={shelf.data.books} onOpen={(b) => { setBook(b.id); window.scrollTo(0, 0); }} /> : <Loading />}
          <h2 className="mb-3 mt-10 text-xl">Все уроки</h2>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button type="button" className={chip(lang === "all")} onClick={() => setLang("all")}>Все языки</button>
            {langs.map((l) => <button key={l} type="button" className={chip(lang === l)} onClick={() => setLang(l)}>{LANG_TITLE[l] || l}</button>)}
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button type="button" className={chip(tag === "all")} onClick={() => setTag("all")}>Все темы</button>
            {tags.map((t) => <button key={t} type="button" className={chip(tag === t)} onClick={() => setTag(t)}>{t}</button>)}
          </div>
          <p className="mb-3 text-[13px] text-ink-mute">Занятий: {libList.length}. Все тексты и задания написаны для Bright.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{libList.map((u) => card(u, true))}</div>
        </>
      )}
      {create && <CreateModal ai={data?.ai} onClose={() => setCreate(false)} />}
      {assign && <AssignModal unit={assign} onClose={() => setAssign(null)} />}
      <Modal lesson open={!!preview && !quest} onClose={() => { setPreview(null); setQuest(false); }} title={preview?.title || ""} wide>
        {preview && (
          <div className="grid gap-4">
                <button type="button" onClick={() => setQuest(true)} className="w-fit rounded-2xl bg-mint px-6 py-2.5 font-bold text-white shadow-[0_3px_0_#146b4c] active:translate-y-0.5 active:shadow-none">Пройти как ученик</button>
                <UnitPlayer unit={preview.preview} submitLabel="Проверить себя"
                  onSubmit={(answers) => request("POST", `/site/v1/library/${preview.id}/check`, { answers })} />
            {role !== "student" && <button type="button" className="btn-brand w-fit" onClick={() => copyLib(preview)}><Copy size={14} /> Взять себе и изменить</button>}
          </div>
        )}
      </Modal>
      {preview && quest && <Quest unit={preview.preview}
        onCheck={(answers) => request("POST", `/site/v1/library/${preview.id}/check`, { answers })}
        onSubmit={(answers) => request("POST", `/site/v1/library/${preview.id}/check`, { answers })}
        onExit={() => setQuest(false)} />}
    </>
  );
}

/** Курсы Bright для ученика: проходить готовые занятия самому и сразу видеть ошибки. */
export function CoursesPage() {
  const { data, error } = useApi("/site/v1/library");
  const [book, setBook] = useState(null);
  if (book) return <BookView bookId={book} onBack={() => setBook(null)} />;
  return (
    <>
      <PageTitle title="Учебники Bright" text="Занимайтесь сами между уроками: правило, слова, задания с проверкой сразу и аудирование." />
      <ErrorBox error={error} />
      {!data ? <Loading /> : <BookShelf books={data.books} onOpen={(b) => { setBook(b.id); window.scrollTo(0, 0); }} />}
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
  const [aiExercise, setAiExercise] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [assign, setAssign] = useState(false);
  const savedSnapshot = useRef(null);
  const dirty = useRef(false);
  dirty.current = !!unit && savedSnapshot.current !== null && JSON.stringify(unit) !== savedSnapshot.current;
  const audios = (useApi("/site/v1/materials").data?.materials || []).filter((m) => m.mime?.startsWith("audio/"));
  useEffect(() => {
    if (isNew) {
      const d = pendingDraft || { title: "Новое занятие", blocks: [] };
      const initial = { ...d, blocks: d.blocks.map(toEdit) };
      savedSnapshot.current = JSON.stringify(initial); setUnit(initial);
      if (d.notice) setMsg(d.notice);
      return;
    }
    request("GET", `/site/v1/units/${id}`).then((u) => { const initial = { ...u, blocks: u.blocks.map(toEdit) }; savedSnapshot.current = JSON.stringify(initial); setUnit(initial); }).catch(setError);
  }, [id, isNew]);
  useEffect(() => {
    const beforeUnload = (event) => { if (dirty.current) { event.preventDefault(); event.returnValue = ""; } };
    const beforeLink = (event) => {
      const href = event.target.closest?.("a")?.getAttribute("href");
      if (dirty.current && href?.startsWith("#/") && !window.confirm("В занятии есть несохранённые изменения. Выйти без сохранения?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", beforeLink, true); };
  }, []);
  if (error && !unit) return <ErrorBox error={error} />;
  if (!unit) return <Loading />;
  const setBlock = (i, b) => setUnit({ ...unit, blocks: unit.blocks.map((x, j) => (j === i ? b : x)) });
  const move = (i, d) => { const bl = [...unit.blocks]; [bl[i], bl[i + d]] = [bl[i + d], bl[i]]; setUnit({ ...unit, blocks: bl }); };
  const save = async () => {
    setError(null); setMsg(null);
    try {
      const body = { title: unit.title, language: unit.language, level: unit.level, blocks: unit.blocks.map(fromEdit), source: unit.source };
      const saved = await request("POST", isNew ? "/site/v1/units" : `/site/v1/units/${id}`, body);
      const edited = { ...saved, blocks: saved.blocks.map(toEdit) };
      savedSnapshot.current = JSON.stringify(edited); dirty.current = false;
      pendingDraft = null;
      setMsg(saved.blocks.length === 0 || saved.blocks.some((block) => block.incomplete) ? "Черновик сохранён. Заполните задания перед выдачей ученику." : "Сохранено");
      if (isNew) window.location.hash = `#/app/units/${saved.id}`;
      else setUnit(edited);
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
        <div className="grid items-start gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-line bg-white p-4 xl:sticky xl:top-5" aria-label="Структура урока">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Структура урока</p>
            <p className="mt-1 text-sm text-ink-soft">{unit.blocks.length ? `Заданий: ${unit.blocks.length}` : "Добавьте первое задание"}</p>
            <ol className="mt-3 grid gap-1">{unit.blocks.map((b, i) => <li key={i}><a href={`#exercise-${i}`} onClick={(e) => { e.preventDefault(); document.getElementById(`exercise-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="block rounded-lg px-2 py-2 text-sm text-ink-soft hover:bg-cream"><b className="mr-2 text-brand">{i + 1}.</b>{b.title || TYPES[b.type]}</a></li>)}</ol>
          </aside>
          <div className="grid min-w-0 gap-4">
          {unit.blocks.map((b, i) => (
            <div key={i} id={`exercise-${i}`} className="card !p-4 md:!p-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="chip chip-brand">{i + 1}. {TYPES[b.type]}</span>{b.incomplete && <span className="text-xs text-ink-mute">Черновик — заполните задание</span>}
                <span className="ml-auto flex gap-1">
                  <button type="button" className="btn-ghost !p-1.5" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Выше"><ArrowUp size={15} /></button>
                  <button type="button" className="btn-ghost !p-1.5" disabled={i === unit.blocks.length - 1} onClick={() => move(i, 1)} aria-label="Ниже"><ArrowDown size={15} /></button>
                  <button type="button" className="btn-ghost !p-1.5" onClick={() => setUnit({ ...unit, blocks: [...unit.blocks.slice(0, i + 1), structuredClone(b), ...unit.blocks.slice(i + 1)] })} aria-label="Копировать задание"><Copy size={15} /></button>
                  <button type="button" className="btn-ghost !p-1.5" onClick={() => setUnit({ ...unit, blocks: unit.blocks.filter((_, j) => j !== i) })} aria-label="Удалить задание"><Trash2 size={15} /></button>
                </span>
              </div>
              <BlockEditor b={b} onChange={(nb) => setBlock(i, nb)} audios={audios} />
            </div>
          ))}
          <div className="card !p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Добавить задание</p><button type="button" className="btn-light btn-sm" onClick={() => { setError(null); setAiExercise({ type: "gap", topic: unit.title || "", wishes: "" }); }}><Wand2 size={14} /> Создать с ИИ</button></div>
            <p className="mb-4 text-sm text-ink-soft">Выберите формат. Настроить содержимое можно после добавления.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(TYPES).map(([t, label]) => (
                <button key={t} type="button" className="group rounded-xl border border-line bg-white p-3 text-left transition hover:border-brand hover:bg-brand-tint" onClick={() => setUnit({ ...unit, blocks: [...unit.blocks, { type: t, title: label, lang: ttsOf(unit.language) }] })}>
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink"><Plus size={15} className="text-brand" />{label}</span>
                  <span className="mt-1 block pl-6 text-xs leading-relaxed text-ink-soft">{TYPE_EXAMPLES[t]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pb-4">
            <button type="button" className="btn-brand" onClick={save}><BookOpenCheck size={16} /> Сохранить</button>
            {!isNew && role === "tutor" && <button type="button" className="btn-light" onClick={async () => { const saved = await save(); if (saved) setAssign(saved); }}><Send size={16} /> Выдать ученику</button>}
          </div>
          </div>
        </div>
      )}
      {assign && <AssignModal unit={assign} onClose={() => setAssign(false)} />}
      {aiExercise && <Modal open onClose={() => !aiBusy && setAiExercise(null)} title="Создать задание с ИИ">
        <form className="grid gap-3" onSubmit={async (event) => {
          event.preventDefault(); setError(null); setAiBusy(true);
          try {
            const result = await request("POST", "/site/v1/units/generate-exercise", { ...aiExercise, language: unit.language, level: unit.level });
            setUnit((current) => ({ ...current, blocks: [...current.blocks, toEdit(result.block)] }));
            setAiExercise(null);
          } catch (e) { setError(e); }
          finally { setAiBusy(false); }
        }}>
          <label className="label">Тема<input className="field" required maxLength={200} value={aiExercise.topic} onChange={(e) => setAiExercise({ ...aiExercise, topic: e.target.value })} /></label>
          <label className="label">Тип задания<select className="field" value={aiExercise.type} onChange={(e) => setAiExercise({ ...aiExercise, type: e.target.value })}>{Object.entries(TYPES).filter(([key]) => key !== "video").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="label">Пожелания<textarea className="field" maxLength={1000} value={aiExercise.wishes} onChange={(e) => setAiExercise({ ...aiExercise, wishes: e.target.value })} placeholder="Например: пять предложений для подростка, тема путешествия" /></label>
          <ErrorBox error={error} />
          <button className="btn-brand" disabled={aiBusy}>{aiBusy ? "Создаём…" : "Создать черновик"}</button>
        </form>
      </Modal>}
    </>
  );
}

/** Ученик выполняет занятие из домашнего задания. */
export function DoUnit({ hwId }) {
  const { data, error, reload } = useApi(`/site/v1/homework/${hwId}/unit`, [hwId]);
  const [playing, setPlaying] = useState(false);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const student = data.role === "student";
  const canPlay = student && data.status !== "checked";
  if (canPlay && playing) {
    return (
      <Quest unit={data.unit} title
        onCheck={(answers) => request("POST", `/site/v1/homework/${hwId}/unit/check`, { answers })}
        onSubmit={(answers) => request("POST", `/site/v1/homework/${hwId}/unit`, { answers })}
        onExit={() => { setPlaying(false); reload(); }} />
    );
  }
  const r = data.result;
  return (
    <>
      <a href="#/app/homework" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-ink-mute hover:text-ink"><ArrowLeft size={14} /> Домашние задания</a>
      {canPlay && (
        <div className="panel mb-5 flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
          <Iskorka size={84} mood={r ? "joy" : "happy"} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.6rem] leading-tight">{data.unit.title}</h1>
            <p className="mt-1 text-ink-mute">{r ? `Сделано: ${r.score} из ${r.total} с первой попытки. Можно пройти ещё раз и улучшить результат.`
              : "Задания по одному, проверка сразу. Ошибки вернутся в конце – исправите и запомните."}</p>
          </div>
          <button type="button" onClick={() => setPlaying(true)} className="w-full shrink-0 rounded-2xl bg-mint px-8 py-3.5 text-[17px] font-bold text-white shadow-[0_4px_0_#146b4c] active:translate-y-1 active:shadow-none sm:w-auto">{r ? "Пройти ещё раз" : "Начать"}</button>
        </div>
      )}
      {!canPlay && <PageTitle title={data.unit.title} text={r ? "Ответы ученика." : "Ученик ещё не выполнил занятие."} />}
      {r && <UnitPlayer unit={data.unit} result={r} readOnly />}
    </>
  );
}
