import { Crop as CropIcon, X } from "lucide-react";
import { useRef, useState } from "react";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Обрезка картинки: рамку двигают пальцем или мышью, углы растягивают.
 * crop — [x, y, w, h] в долях исходной картинки.
 */
export default function CropDialog({ src, crop, onApply, onClose }) {
  const [r, setR] = useState(() => crop || [0.05, 0.05, 0.9, 0.9]);
  const box = useRef(null);
  const drag = useRef(null);
  const start = (mode) => (e) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, r0: r };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const b = box.current.getBoundingClientRect();
    const dx = (e.clientX - d.sx) / b.width, dy = (e.clientY - d.sy) / b.height;
    let [x, y, w, h] = d.r0;
    if (d.mode === "move") { x = clamp(x + dx, 0, 1 - w); y = clamp(y + dy, 0, 1 - h); }
    if (d.mode.includes("l")) { const nx = clamp(x + dx, 0, x + w - 0.05); w += x - nx; x = nx; }
    if (d.mode.includes("t")) { const ny = clamp(y + dy, 0, y + h - 0.05); h += y - ny; y = ny; }
    if (d.mode.includes("r")) w = clamp(w + dx, 0.05, 1 - x);
    if (d.mode.includes("b")) h = clamp(h + dy, 0.05, 1 - y);
    setR([x, y, w, h]);
  };
  const end = () => { drag.current = null; };
  const pct = (v) => `${v * 100}%`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-3" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div className="w-full max-w-2xl rounded-3xl bg-white p-4 shadow-lift">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg"><CropIcon size={18} /> Обрезать картинку</h3>
          <button type="button" className="btn-ghost !p-2" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        <div className="flex justify-center rounded-2xl bg-cream p-2" style={{ touchAction: "none" }}>
          <div ref={box} className="relative inline-block select-none">
            <img src={src} alt="" draggable="false" className="block max-h-[60vh] max-w-full" />
            {/* затемнение вне рамки */}
            {[{ left: 0, top: 0, width: "100%", height: pct(r[1]) }, { left: 0, top: pct(r[1] + r[3]), width: "100%", bottom: 0 },
              { left: 0, top: pct(r[1]), width: pct(r[0]), height: pct(r[3]) }, { left: pct(r[0] + r[2]), right: 0, top: pct(r[1]), height: pct(r[3]) }]
              .map((st, i) => <div key={i} className="pointer-events-none absolute bg-ink/45" style={st} />)}
            <div onPointerDown={start("move")} className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.3)]"
              style={{ left: pct(r[0]), top: pct(r[1]), width: pct(r[2]), height: pct(r[3]) }}>
              {["tl", "tr", "bl", "br"].map((c) => (
                <span key={c} onPointerDown={start(c)} className="absolute h-6 w-6 rounded-full border-2 border-white bg-brand"
                  style={{ [c[0] === "t" ? "top" : "bottom"]: -12, [c[1] === "l" ? "left" : "right"]: -12, cursor: c === "tl" || c === "br" ? "nwse-resize" : "nesw-resize" }} />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-brand" onClick={() => onApply(r.map((v) => Math.round(v * 10000) / 10000))}>Обрезать</button>
          <button type="button" className="btn-light" onClick={() => onApply(null)}>Вернуть исходную</button>
          <button type="button" className="btn-ghost" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
