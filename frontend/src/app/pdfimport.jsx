import { FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { extractPdfText } from "../board/PdfPages.jsx";
import { ErrorBox, Modal, Notice } from "../ui/kit.jsx";
import { useApi } from "./common.jsx";

/**
 * Вставка текста из PDF в занятие. Берёт файл с компьютера или из «Материалов», вытаскивает текст выбранных
 * страниц (всё происходит в браузере, файл никуда не отправляется). Текст можно поправить до вставки.
 * onInsert(text) – вставить в задание. Сканы без текста не читаются: для них нужен распознанный PDF.
 */
export default function PdfImport({ open, onClose, onInsert, hint }) {
  const mats = useApi(open ? "/site/v1/materials" : null, [open]);
  const input = useRef(null);
  const [src, setSrc] = useState(null); // { blob|url, name }
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const pdfs = (mats.data?.materials || []).filter((m) => m.mime === "application/pdf");
  const read = async (source, name, a = from, b = to) => {
    setBusy("Читаем страницы…"); setError(null);
    try {
      const r = await extractPdfText(source, a, b, (n, last) => setBusy(`Страница ${n} из ${last}…`));
      if (!r.text) setError(new Error("В этих страницах нет текста: похоже, это скан-картинка. Положите страницу на доску или загрузите PDF с распознанным текстом."));
      setText(r.text); setSrc({ source, name, total: r.total });
    } catch { setError(new Error("Не получилось открыть PDF. Файл повреждён или защищён паролем.")); }
    setBusy("");
  };
  const pick = (source, name) => { setFrom(1); setTo(1); setText(""); read(source, name, 1, 1); };
  const close = () => { setSrc(null); setText(""); setError(null); onClose(); };
  return (
    <Modal open={open} onClose={close} title="Вставить из PDF" wide>
      {!src ? (
        <div className="grid gap-4">
          <p className="text-sm text-ink-soft">Текст берётся из PDF в вашем браузере. Используйте материалы, на которые у вас есть права: свои или учебники, по которым вы занимаетесь с учениками.</p>
          <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pick(f, f.name); }} />
          <button type="button" className="btn-brand w-fit" onClick={() => input.current?.click()}><Upload size={16} /> Выбрать PDF с компьютера</button>
          {pdfs.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Или из ваших материалов</p>
              <ul className="grid gap-1.5">{pdfs.map((m) => <li key={m.id}><button type="button" className="flex w-full items-center gap-2 rounded-xl border border-line px-3 py-2 text-left hover:bg-cream" onClick={() => pick(m.url, m.title)}><FileText size={16} className="text-ink-mute" />{m.title}</button></li>)}</ul>
            </div>
          )}
          {busy && <p className="text-sm text-ink-mute">{busy}</p>}
          <ErrorBox error={error} />
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm"><b>{src.name}</b> · страниц: {src.total}</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="label w-28">С страницы<input className="field" type="number" min={1} max={src.total} value={from} onChange={(e) => setFrom(Number(e.target.value))} /></label>
            <label className="label w-28">По страницу<input className="field" type="number" min={1} max={src.total} value={to} onChange={(e) => setTo(Number(e.target.value))} /></label>
            <button type="button" className="btn-light" disabled={!!busy} onClick={() => read(src.source, src.name)}>{busy || "Прочитать"}</button>
            <button type="button" className="btn-ghost" onClick={() => { setSrc(null); setText(""); }}>Другой файл</button>
          </div>
          <ErrorBox error={error} />
          {text && (
            <>
              <textarea dir="auto" className="field min-h-[260px] font-normal" value={text} onChange={(e) => setText(e.target.value)} aria-label="Текст из PDF" />
              <Notice>Уберите лишнее и расставьте правильные ответы в [квадратных скобках]. Ученик увидит пропуски, ответы увидите только вы.{hint ? ` ${hint}` : ""}</Notice>
              <button type="button" className="btn-brand w-fit" onClick={() => { onInsert(text); close(); }}>Вставить в занятие</button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
