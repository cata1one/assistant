import { ChevronLeft, ChevronRight, ImagePlus, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// pdf.js грузится только когда открыли PDF: главная страница остаётся лёгкой.
// legacy-сборка работает и в старых браузерах телефонов.
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
}

const memory = {}; // последняя открытая страница каждого файла: учебник открывается там, где остановились
const remember = (url) => { try { return Number(localStorage.getItem(`bright-pdf-page:${url}`)) || memory[url] || 1; } catch { return memory[url] || 1; } };
const store = (url, n) => { memory[url] = n; try { localStorage.setItem(`bright-pdf-page:${url}`, String(n)); } catch { /* нет хранилища */ } };

/**
 * Просмотр PDF постранично. onPick(blob, page) – «Страницу на доску»: страница рисуется картинкой
 * в хорошем качестве, её можно обрезать и подписывать прямо на доске.
 */
export default function PdfPages({ url, title, onPick, height = "70vh" }) {
  const canvas = useRef(null);
  const wrap = useRef(null);
  const [doc, setDoc] = useState(null);
  const [page, setPage] = useState(() => remember(url));
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const task = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setDoc(null); setError(null);
    loadPdfjs().then((pdfjs) => pdfjs.getDocument({ url, isEvalSupported: false, withCredentials: true }).promise)
      .then((d) => { if (!cancelled) { setDoc(d); setPage((p) => Math.min(Math.max(1, p), d.numPages)); } })
      .catch(() => !cancelled && setError("Не получилось открыть PDF. Возможно, файл повреждён или защищён паролем."));
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (!doc || !canvas.current) return;
    store(url, page);
    let done = false;
    doc.getPage(page).then((p) => {
      if (done) return;
      const width = (wrap.current?.clientWidth || 800) - 2;
      const base = p.getViewport({ scale: 1 });
      const scale = (width / base.width) * zoom;
      const vp = p.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
      const c = canvas.current;
      c.width = vp.width; c.height = vp.height;
      c.style.width = `${vp.width / (window.devicePixelRatio || 1)}px`;
      task.current?.cancel?.();
      task.current = p.render({ canvasContext: c.getContext("2d"), viewport: vp });
      task.current.promise.catch(() => {});
    });
    return () => { done = true; };
  }, [doc, page, zoom, url]);

  const go = (n) => doc && setPage(Math.min(doc.numPages, Math.max(1, n)));
  useEffect(() => {
    const key = (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.key === "ArrowRight") go(page + 1);
      if (e.key === "ArrowLeft") go(page - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const pick = async () => {
    setBusy(true);
    try {
      const p = await doc.getPage(page);
      const base = p.getViewport({ scale: 1 });
      const vp = p.getViewport({ scale: Math.min(2.5, 1600 / base.width) }); // чётко на доске, но файл не огромный
      const c = document.createElement("canvas");
      c.width = vp.width; c.height = vp.height;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      await p.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.88));
      await onPick(blob, page);
    } catch (e) { setError(e.message || "не получилось"); }
    setBusy(false);
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-light !h-9 !w-9 !p-0" onClick={() => go(page - 1)} disabled={!doc || page <= 1} aria-label="Предыдущая страница"><ChevronLeft size={18} /></button>
        <form onSubmit={(e) => { e.preventDefault(); go(Number(input)); setInput(""); }} className="flex items-center gap-1.5 text-sm">
          <input className="field !h-9 !w-16 !px-2 text-center" inputMode="numeric" value={input} placeholder={String(page)} onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))} aria-label="Номер страницы" />
          <span className="text-ink-mute">из {doc?.numPages || "…"}</span>
        </form>
        <button type="button" className="btn-light !h-9 !w-9 !p-0" onClick={() => go(page + 1)} disabled={!doc || page >= doc.numPages} aria-label="Следующая страница"><ChevronRight size={18} /></button>
        <span className="mx-1 h-6 w-px bg-line" />
        <button type="button" className="btn-ghost !h-9 !w-9 !p-0" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} aria-label="Мельче"><ZoomOut size={17} /></button>
        <button type="button" className="btn-ghost !h-9 !w-9 !p-0" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} aria-label="Крупнее"><ZoomIn size={17} /></button>
        {onPick && <button type="button" className="btn-brand !h-9 ml-auto" disabled={!doc || busy} onClick={pick}><ImagePlus size={16} /> {busy ? "Кладём…" : "Страницу на доску"}</button>}
      </div>
      <div ref={wrap} className="overflow-auto rounded-2xl border border-line bg-cream" style={{ height }} aria-label={title}>
        {error ? <p className="p-6 text-sm text-teach-deep">{error}</p> : !doc ? <p className="p-6 text-sm text-ink-mute">Открываем…</p> : null}
        <canvas ref={canvas} className={`mx-auto block bg-white ${doc ? "" : "hidden"}`} />
      </div>
    </div>
  );
}
