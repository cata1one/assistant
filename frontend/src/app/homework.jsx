import { Check, CheckCircle2, File, ImagePlus, Layers, NotebookPen, Pencil, Play, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { request, uploadRaw } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { Empty, ErrorBox, Loading, Modal, Notice, PageTitle } from "../ui/kit.jsx";
import { shortDate, useApi } from "./common.jsx";

const HW_STATUS = { open: ["задано", "chip"], done: ["выполнено", "chip !bg-mint-soft !text-[#146b4c]"], checked: ["проверено", "chip chip-brand"] };

/** Фото и скриншоты к ДЗ: кнопка, перетаскивание и вставка из буфера (Ctrl+V). */
function Attachments({ h, reload, canEdit }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null);
  const send = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setBusy(true); setError(null);
    try { for (const f of list) await uploadRaw(`/site/v1/homework/${h.id}/attach`, f); } catch (x) { setError(x); }
    setBusy(false); reload();
  };
  const remove = async (id) => { await request("POST", `/site/v1/homework/${h.id}`, { remove_attachment: id }).catch(setError); reload(); };
  if (!canEdit && !h.attachments.length) return null;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {h.attachments.map((a) => (
          <div key={a.id} className="group relative">
            <button type="button" onClick={() => setZoom(a)} className="block h-20 w-20 overflow-hidden rounded-xl border border-line bg-cream">
              <img src={a.url} alt={a.title} loading="lazy" className="h-full w-full object-cover" />
            </button>
            {canEdit && <button type="button" onClick={() => remove(a.id)} aria-label="Убрать картинку" className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-white opacity-80 hover:opacity-100"><X size={12} /></button>}
          </div>
        ))}
        {canEdit && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); send(e.dataTransfer.files); }}
            className="grid h-20 w-28 place-items-center rounded-xl border-2 border-dashed border-line text-center text-xs font-semibold text-ink-mute hover:border-brand hover:text-brand">
            <span><ImagePlus size={18} className="mx-auto mb-1" />{busy ? "Загружаем…" : "Фото или скрин"}</span>
          </button>
        )}
      </div>
      {canEdit && <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { send(e.target.files); e.target.value = ""; }} />}
      {canEdit && <p className="mt-1.5 text-xs text-ink-mute">Можно перетащить картинку или вставить скриншот: Ctrl+V в поле ответа.</p>}
      <ErrorBox error={error} />
      <Modal open={!!zoom} onClose={() => setZoom(null)} title={zoom?.title || ""} wide>
        {zoom && <img src={zoom.url} alt={zoom.title} className="max-h-[75vh] w-full rounded-2xl object-contain" />}
      </Modal>
    </div>
  );
}

function EditHomework({ h, onClose, reload }) {
  const [text, setText] = useState(h.text);
  const [due, setDue] = useState(h.due || "");
  const [error, setError] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    try { await request("POST", `/site/v1/homework/${h.id}`, { text, due: due || null }); onClose(); reload(); } catch (x) { setError(x); }
  };
  const remove = async () => {
    if (!window.confirm("Удалить задание?")) return;
    await request("POST", `/site/v1/homework/${h.id}`, { status: "delete" }).catch(setError); onClose(); reload();
  };
  return (
    <Modal open onClose={onClose} title="Изменить задание">
      <form onSubmit={save} className="grid gap-3">
        <textarea className="field min-h-[140px]" required maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Задание" />
        <input className="field" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Срок" />
        <ErrorBox error={error} />
        <div className="flex gap-2"><button type="submit" className="btn-brand">Сохранить</button><button type="button" className="btn-ghost ml-auto text-teach-deep" onClick={remove}><Trash2 size={15} /> Удалить</button></div>
      </form>
    </Modal>
  );
}

function HomeworkItem({ h, reload }) {
  const [answer, setAnswer] = useState(h.answer || "");
  const [error, setError] = useState(null);
  const [edit, setEdit] = useState(false);
  const [comment, setComment] = useState(h.comment || "");
  const saveComment = async (status) => {
    try { await request("POST", `/site/v1/homework/${h.id}`, { comment, ...(status ? { status } : {}) }); reload(); } catch (x) { setError(x); }
  };
  const set = async (status) => {
    try { await request("POST", `/site/v1/homework/${h.id}`, { status, answer }); reload(); } catch (x) { setError(x); }
  };
  const [label, cls] = HW_STATUS[h.status] || [h.status, "chip"];
  const student = h.role === "student";
  // Скриншот из буфера (Ctrl+V) в любом месте карточки сразу прикладывается к заданию
  const onPaste = async (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
    if (!student || h.status === "checked" || !files.length) return;
    e.preventDefault();
    try { for (const f of files) await uploadRaw(`/site/v1/homework/${h.id}/attach`, f); } catch (x) { setError(x); }
    reload();
  };
  return (
    <div className="card !p-5" onPaste={onPaste}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-mute">{h.role === "tutor" ? h.student : h.role === "parent" ? `${h.student} · ${h.tutor}` : h.tutor} · {shortDate(h.created_at)}{h.due ? ` · до ${h.due}` : ""}</span>
        <span className="flex items-center gap-2">
          {h.score && <span className="chip chip-brand">{h.score.score} из {h.score.total}</span>}
          <span className={cls}>{label}</span>
          {h.role === "tutor" && <button type="button" className="btn-ghost !p-1.5" onClick={() => setEdit(true)} aria-label="Изменить задание"><Pencil size={15} /></button>}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap">{h.text}</p>
      {h.unit && (
        <a href={`#/app/do/${h.id}`} className="mt-3 flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-tint px-4 py-3 font-semibold text-brand-deep hover:border-brand">
          <Layers size={18} /> <span className="flex-1">Занятие: {h.unit.title}</span>
          <span className="flex items-center gap-1 text-sm">{student && h.status === "open" ? <><Play size={14} /> Начать</> : h.score ? "Посмотреть ответы" : "Открыть"}</span>
        </a>
      )}
      {h.materials.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">{h.materials.map((m) => <a key={m.id} href={m.url} target="_blank" rel="noopener" className="chip hover:border-brand"><File size={12} /> {m.title}</a>)}</div>
      )}
      <Attachments h={h} reload={reload} canEdit={student && h.status !== "checked"} />
      {student && h.status !== "checked" && (
        <div className="mt-4 grid gap-2">
          <textarea className="field min-h-[70px]" maxLength={3000} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Ответ или комментарий для преподавателя" aria-label="Ответ" />
          <div className="flex gap-2">
            {h.status === "open" ? <button type="button" className="btn-brand btn-sm" onClick={() => set("done")}><CheckCircle2 size={14} /> Готово</button>
              : <button type="button" className="btn-light btn-sm" onClick={() => set("open")}>Вернуть в работу</button>}
          </div>
        </div>
      )}
      {!student && h.answer && <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-cream p-3 text-sm"><b>Ответ ученика:</b> {h.answer}</p>}
      {h.comment && h.role !== "tutor" && <p className="mt-3 whitespace-pre-wrap rounded-2xl border border-brand/30 bg-brand-tint p-3 text-sm"><b>💬 Комментарий преподавателя:</b> {h.comment}</p>}
      {h.role === "tutor" && (h.status !== "open" || h.comment) && (
        <div className="mt-3 grid gap-2">
          <textarea className="field min-h-[60px] text-sm" maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий ученику: что получилось, над чем поработать" aria-label="Комментарий ученику" />
          <div className="flex flex-wrap gap-2">
            {h.status === "done" && <button type="button" className="btn-brand btn-sm" onClick={() => saveComment("checked")}><Check size={14} /> Проверено{comment.trim() ? " и отправить комментарий" : ""}</button>}
            {(h.status === "checked" || comment !== (h.comment || "")) && <button type="button" className="btn-light btn-sm" disabled={comment === (h.comment || "")} onClick={() => saveComment()}>Сохранить комментарий</button>}
          </div>
        </div>
      )}
      <ErrorBox error={error} />
      {edit && <EditHomework h={h} onClose={() => setEdit(false)} reload={reload} />}
    </div>
  );
}

function AssignForm({ onDone }) {
  const students = useApi("/site/v1/students").data?.students?.filter((s) => s.joined) || [];
  const materials = useApi("/site/v1/materials").data?.materials || [];
  const units = useApi("/site/v1/units").data?.units || [];
  const [f, setF] = useState({ chat_id: "", text: "", words: "", due: "", materials: [], unit_id: "" });
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setError(null); setMsg(null);
    try {
      const r = await request("POST", "/site/v1/homework", { ...f, chat_id: f.chat_id || students[0]?.chat_id, due: f.due || null, unit_id: f.unit_id || null });
      setF({ ...f, text: "", words: "", materials: [], unit_id: "" });
      setMsg(r.words_added ? `Задание выдано. В карточки ученика добавлено слов: ${r.words_added}.` : "Задание выдано.");
      onDone();
    } catch (x) { setError(x); }
  };
  if (!students.length) return <Notice>Задание можно выдать, когда ученик подключится по ссылке.</Notice>;
  const toggle = (id) => setF({ ...f, materials: f.materials.includes(id) ? f.materials.filter((x) => x !== id) : [...f.materials, id].slice(0, 10) });
  return (
    <form onSubmit={submit} className="card grid gap-3">
      <h2 className="text-lg">Новое задание</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <select className="field" value={f.chat_id} onChange={(e) => setF({ ...f, chat_id: e.target.value })} aria-label="Ученик">
          {students.map((s) => <option key={s.chat_id} value={s.chat_id}>{s.name}</option>)}
        </select>
        <input className="field" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} aria-label="Срок" />
      </div>
      {units.length > 0 && (
        <select className="field" value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })} aria-label="Занятие">
          <option value="">Без интерактивного занятия</option>
          {units.map((u) => <option key={u.id} value={u.id}>Занятие: {u.title}</option>)}
        </select>
      )}
      <textarea className="field min-h-[90px]" required={!f.unit_id} maxLength={3000} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })}
        placeholder={f.unit_id ? "Комментарий к занятию (необязательно)" : "Что сделать: упражнения, видео, «Новые слова: apple — яблоко, table — стол»…"} aria-label="Задание" />
      <label className="label">Новые слова — сразу в карточки ученика
        <textarea className="field min-h-[70px] font-normal" maxLength={3000} value={f.words} onChange={(e) => setF({ ...f, words: e.target.value })} placeholder={"kitchen — кухня\nwardrobe — шкаф"} />
        <span className="text-xs font-normal text-ink-mute">По слову в строке. Слова из текста задания после «Новые слова:» и слова занятия тоже попадут в карточки.</span>
      </label>
      {materials.length > 0 && (
        <details className="rounded-2xl border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">Приложить материалы ({f.materials.length})</summary>
          <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
            {materials.map((m) => <button key={m.id} type="button" onClick={() => toggle(m.id)} aria-pressed={f.materials.includes(m.id)} className={`chip ${f.materials.includes(m.id) ? "chip-brand" : ""}`}>{m.title}</button>)}
          </div>
        </details>
      )}
      {msg && <Notice tone="ok">{msg}</Notice>}
      <ErrorBox error={error} />
      <button type="submit" className="btn-brand w-fit"><NotebookPen size={16} /> Выдать задание</button>
    </form>
  );
}

export function HomeworkPage() {
  const { role } = useSession();
  const { data, error, reload } = useApi("/site/v1/homework");
  const list = data?.homework || [];
  const open = list.filter((h) => h.status === "open");
  return (
    <>
      <PageTitle title="Домашние задания" text={role === "parent" ? "Что задано и что уже сделано." : role === "student" ? `Открытых заданий: ${open.length}. К ответу можно приложить фото тетради или скриншот.` : "Выдавайте задания, занятия и слова для карточек."} />
      <div className={role === "tutor" ? "grid items-start gap-4 lg:grid-cols-[1fr_1.2fr]" : ""}>
        {role === "tutor" && <AssignForm onDone={reload} />}
        <div className="grid gap-3">
          <ErrorBox error={error} />
          {!data ? <Loading /> : !list.length ? <Empty icon={NotebookPen} title="Заданий пока нет" text={role === "tutor" ? "Выдайте первое задание." : "Когда преподаватель задаст ДЗ, оно появится здесь."} />
            : list.map((h) => <HomeworkItem key={h.id} h={h} reload={reload} />)}
        </div>
      </div>
    </>
  );
}
