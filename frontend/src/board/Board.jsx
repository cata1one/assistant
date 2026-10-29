import {
  ArrowUpRight, Crop as CropIcon, Circle, Columns3, Eraser, FileText, Film, FolderOpen, Hand, Highlighter, ImagePlus, Layers, Link2,
  Maximize, Minus, MousePointer2, Pause, Pencil, Play, Plus, RotateCcw, Rows3, Smile, Square, StickyNote, Table, Timer, Trash2, Type, Undo2,
} from "lucide-react";
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getToken, request } from "../lib/api.js";
import { Modal } from "../ui/kit.jsx";
import CropDialog from "./Crop.jsx";

const PdfPages = lazy(() => import("./PdfPages.jsx"));
import { PACKS, stickerById } from "./stickers.js";

/*
 * Доска Bright: бесконечный холст из DOM-объектов.
 * Каждая правка – операция «obj» (последняя версия объекта с данным oid побеждает) или «del».
 * На общей доске операции уходят на сервер, а новые приходят опросом раз в ~1 секунду.
 */

const COLORS = ["#17171A", "#2B59E8", "#E4572E", "#1F9D63", "#F5B400", "#6E5BD8", "#D93B3B"];
const NOTE_COLORS = ["#FDE68A", "#FBCFE8", "#BFDBFE", "#BBF7D0", "#FED7AA", "#DDD6FE"];
const LOCAL_KEY = "better-board-local-v2"; // старое имя ключа: личные доски у пользователей не пропадают
const oidGen = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const TOOLS = [
  ["select", MousePointer2, "Выбор и перемещение (V)"], ["hand", Hand, "Двигать холст (H, пробел)"],
  ["pen", Pencil, "Ручка (P)"], ["marker", Highlighter, "Маркер"], ["eraser", Eraser, "Ластик (E)"],
  ["text", Type, "Текст (T)"], ["note", StickyNote, "Заметка (N)"], ["rect", Square, "Прямоугольник"],
  ["ellipse", Circle, "Круг"], ["arrow", ArrowUpRight, "Стрелка"], ["line", Minus, "Линия"],
];

// -- отрисовка объектов --------------------------------------------------------------------------
const ObjView = memo(function ObjView({ o, selected, editing, onEditDone, activeVideo, setActiveVideo, onAction }) {
  // Слои задаются порядком в разметке (объекты отсортированы по z), поэтому z-index не нужен
  const style = { left: o.x, top: o.y, width: o.w, height: o.h };
  const cls = `board-obj ${selected ? "selected" : ""}`;
  if (o.type === "stroke") {
    const d = o.points.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
    return (
      <svg data-oid={o.oid} className={cls} style={{ ...style, overflow: "visible" }}>
        <path d={o.points.length === 1 ? `${d} l0.1 0` : d} fill="none" stroke={o.color} strokeWidth={o.width}
          strokeLinecap="round" strokeLinejoin="round" opacity={o.marker ? 0.35 : 1} />
      </svg>
    );
  }
  if (o.type === "shape") {
    const sw = o.width || 3;
    let body;
    if (o.shape === "rect") body = <rect x={sw / 2} y={sw / 2} width={Math.max(1, o.w - sw)} height={Math.max(1, o.h - sw)} rx="10" fill={o.fill || "none"} stroke={o.color} strokeWidth={sw} />;
    else if (o.shape === "ellipse") body = <ellipse cx={o.w / 2} cy={o.h / 2} rx={Math.max(1, o.w / 2 - sw)} ry={Math.max(1, o.h / 2 - sw)} fill={o.fill || "none"} stroke={o.color} strokeWidth={sw} />;
    else {
      const [[x1, y1], [x2, y2]] = o.points || [[0, 0], [o.w, o.h]];
      const ang = Math.atan2(y2 - y1, x2 - x1), len = 14 + sw * 2;
      body = (
        <g stroke={o.color} strokeWidth={sw} strokeLinecap="round" fill="none">
          <path d={`M${x1} ${y1}L${x2} ${y2}`} />
          {o.shape === "arrow" && <path d={`M${x2 - len * Math.cos(ang - 0.45)} ${y2 - len * Math.sin(ang - 0.45)}L${x2} ${y2}L${x2 - len * Math.cos(ang + 0.45)} ${y2 - len * Math.sin(ang + 0.45)}`} />}
        </g>
      );
    }
    return <svg data-oid={o.oid} className={cls} style={{ ...style, overflow: "visible" }}>{body}</svg>;
  }
  if (o.type === "text" || o.type === "note") {
    const isNote = o.type === "note";
    return (
      <div data-oid={o.oid} className={`${cls} ${isNote ? "board-note p-4" : ""}`}
        style={{ ...style, background: isNote ? o.color : "transparent", color: isNote ? "#1E2235" : o.color, fontSize: o.size,
          lineHeight: 1.25, fontWeight: isNote ? 600 : 500, fontFamily: "Onest Variable, sans-serif" }}>
        {editing ? (
          <textarea autoFocus defaultValue={o.text} onBlur={(e) => onEditDone(o, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); e.stopPropagation(); }}
            className="h-full w-full resize-none bg-transparent outline-none" style={{ fontSize: "inherit", color: "inherit", fontWeight: "inherit" }} />
        ) : <div className="h-full w-full overflow-hidden whitespace-pre-wrap break-words">{o.text || (isNote ? "" : "Текст")}</div>}
      </div>
    );
  }
  if (o.type === "sticker") {
    const st = stickerById(o.sticker);
    return (
      <div data-oid={o.oid} className={`${cls} grid place-items-center`} style={style}>
        {st?.emoji ? <span style={{ fontSize: Math.min(o.w, o.h) * 0.85, lineHeight: 1 }}>{st.emoji}</span>
          : <img alt="" draggable="false" src={st?.src || o.sticker} className="pointer-events-none h-full w-full object-contain" />}
      </div>
    );
  }
  if (o.type === "image") {
    if (o.crop) { // обрезанная картинка: показываем только выбранную часть
      const [cx, cy, cw, ch] = o.crop;
      return (
        <div data-oid={o.oid} className={`${cls} overflow-hidden rounded-lg`} style={style}>
          <img alt={o.title || ""} draggable="false" src={o.src} className="pointer-events-none absolute max-w-none"
            style={{ width: `${100 / cw}%`, height: `${100 / ch}%`, left: `${(-cx / cw) * 100}%`, top: `${(-cy / ch) * 100}%` }} />
        </div>
      );
    }
    return <div data-oid={o.oid} className={cls} style={style}><img alt={o.title || ""} draggable="false" src={o.src} className="pointer-events-none h-full w-full rounded-lg object-contain" /></div>;
  }
  if (o.type === "video") {
    const active = activeVideo === o.oid;
    return (
      <div data-oid={o.oid} className={`${cls} flex flex-col overflow-hidden rounded-2xl bg-ink shadow-lift`} style={style}>
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white"><Film size={14} />{o.title || "Видео"}</div>
        <div className="relative flex-1 bg-black">
          <iframe title={o.title || "Видео"} src={o.embed} className={`h-full w-full ${active ? "" : "pointer-events-none"}`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
          {!active && (
            <button type="button" data-play="1" onPointerDown={(e) => e.stopPropagation()} onClick={() => setActiveVideo(o.oid)}
              className="absolute inset-0 grid place-items-center bg-black/30 text-sm font-semibold text-white">▶ Нажмите, чтобы управлять видео</button>
          )}
        </div>
      </div>
    );
  }
  if (o.type === "card") {
    return (
      <div data-oid={o.oid} className={`${cls} board-note flex flex-col items-center justify-center p-4 text-center`} style={{ ...style, background: o.flipped ? "#FFFFFF" : o.color }}>
        {editing ? (
          <CardEditor o={o} onDone={onEditDone} />
        ) : (
          <>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{o.flipped ? "перевод" : "слово"}</span>
            <span className="mt-1 break-words font-semibold leading-tight" style={{ fontSize: Math.max(14, Math.min(o.w, o.h) / 6) }}>{(o.flipped ? o.back : o.front) || "Двойной клик, чтобы вписать"}</span>
            <button type="button" data-play="1" onPointerDown={(e) => e.stopPropagation()} onClick={() => onAction?.({ ...o, flipped: !o.flipped })}
              className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-ink-soft shadow-soft hover:text-ink" aria-label="Перевернуть карточку"><RotateCcw size={15} /></button>
          </>
        )}
      </div>
    );
  }
  if (o.type === "table") {
    return (
      <div data-oid={o.oid} className={`${cls} overflow-hidden rounded-lg border border-ink/20 bg-white`} style={style}>
        {editing ? <TableEditor o={o} onDone={onEditDone} /> : (
          <table className="h-full w-full table-fixed border-collapse text-[15px]">
            <tbody>{o.cells.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} className={`border border-ink/15 px-2 py-1 align-middle ${i === 0 && o.head ? "bg-cream font-semibold" : ""}`}>{c}</td>)}</tr>
            ))}</tbody>
          </table>
        )}
      </div>
    );
  }
  if (o.type === "timer") return <TimerView o={o} cls={cls} style={style} onAction={onAction} />;
  // файл и ссылка – карточки
  const Icon = o.type === "file" ? FileText : Link2;
  return (
    <div data-oid={o.oid} className={`${cls} card flex items-center gap-3 !p-4`} style={style}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon size={20} /></span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{o.title || o.url || "Файл"}</span>
        <a href={o.src || o.url} target="_blank" rel="noopener" onPointerDown={(e) => e.stopPropagation()} className="link text-xs">Открыть</a>
      </span>
    </div>
  );
});

function CardEditor({ o, onDone }) {
  const [f, setF] = useState({ front: o.front || "", back: o.back || "" });
  return (
    <div className="grid w-full gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
      <input autoFocus className="field !py-1.5 text-sm" placeholder="Слово" value={f.front} maxLength={200} onChange={(e) => setF({ ...f, front: e.target.value })} onKeyDown={(e) => e.stopPropagation()} />
      <input className="field !py-1.5 text-sm" placeholder="Перевод" value={f.back} maxLength={200} onChange={(e) => setF({ ...f, back: e.target.value })} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") onDone(o, f); }} />
      <button type="button" className="btn-brand btn-sm" onClick={() => onDone(o, f)}>Готово</button>
    </div>
  );
}

function TableEditor({ o, onDone }) {
  const [cells, setCells] = useState(o.cells);
  const set = (i, j, v) => setCells((c) => c.map((r, a) => (a === i ? r.map((x, b) => (b === j ? v : x)) : r)));
  return (
    <div className="flex h-full flex-col" onPointerDown={(e) => e.stopPropagation()}>
      <table className="w-full flex-1 table-fixed border-collapse"><tbody>{cells.map((r, i) => (
        <tr key={i}>{r.map((c, j) => <td key={j} className="border border-ink/15 p-0"><input value={c} maxLength={120} onChange={(e) => set(i, j, e.target.value)} onKeyDown={(e) => e.stopPropagation()}
          className={`w-full bg-transparent px-2 py-1 text-[15px] outline-none focus:bg-sun-soft ${i === 0 && o.head ? "font-semibold" : ""}`} autoFocus={i === 0 && j === 0} /></td>)}</tr>
      ))}</tbody></table>
      <div className="flex gap-1 border-t border-line bg-cream p-1">
        <button type="button" className="btn-ghost btn-sm !px-2" title="Добавить строку" onClick={() => setCells((c) => (c.length < 12 ? [...c, c[0].map(() => "")] : c))}><Rows3 size={14} />+</button>
        <button type="button" className="btn-ghost btn-sm !px-2" title="Добавить столбец" onClick={() => setCells((c) => (c[0].length < 8 ? c.map((r) => [...r, ""]) : c))}><Columns3 size={14} />+</button>
        <button type="button" className="btn-ghost btn-sm !px-2" title="Убрать строку" onClick={() => setCells((c) => (c.length > 1 ? c.slice(0, -1) : c))}><Rows3 size={14} />−</button>
        <button type="button" className="btn-ghost btn-sm !px-2" title="Убрать столбец" onClick={() => setCells((c) => (c[0].length > 1 ? c.map((r) => r.slice(0, -1)) : c))}><Columns3 size={14} />−</button>
        <button type="button" className="btn-brand btn-sm ml-auto" onClick={() => onDone(o, { cells })}>Готово</button>
      </div>
    </div>
  );
}

/** Общий таймер на задание: запускает любой участник, время одинаковое у всех. */
function TimerView({ o, cls, style, onAction }) {
  const [, tick] = useState(0);
  useEffect(() => { if (!o.started) return undefined; const t = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(t); }, [o.started]);
  const left = o.started ? Math.max(0, o.left - Math.floor((Date.now() - o.started) / 1000)) : o.left;
  const done = o.started && left === 0;
  const fmt = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const act = (patch) => onAction?.({ ...o, ...patch });
  const stop = (e) => e.stopPropagation();
  return (
    <div data-oid={o.oid} className={`${cls} flex flex-col items-center justify-center rounded-2xl border-2 ${done ? "border-teach bg-teach-tint" : "border-ink bg-white"}`} style={style}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{o.label || "Таймер"}</span>
      <span className="num font-bold leading-none" style={{ fontSize: Math.min(o.w / 3.2, o.h / 2.2) }}>{done ? "Время!" : fmt}</span>
      <span className="mt-2 flex gap-1" data-play="1">
        {!o.started || done ? <button type="button" data-play="1" onPointerDown={stop} onClick={() => act({ started: Date.now(), left: done ? o.seconds : o.left })} className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white" aria-label="Старт"><Play size={14} /></button>
          : <button type="button" data-play="1" onPointerDown={stop} onClick={() => act({ started: null, left })} className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white" aria-label="Пауза"><Pause size={14} /></button>}
        <button type="button" data-play="1" onPointerDown={stop} onClick={() => act({ started: null, left: o.seconds })} className="grid h-8 w-8 place-items-center rounded-full bg-cream text-ink" aria-label="Сначала"><RotateCcw size={14} /></button>
        {[60, 180, 300].map((sec) => <button key={sec} type="button" data-play="1" onPointerDown={stop} onClick={() => act({ seconds: sec, left: sec, started: null })} className="h-8 rounded-full bg-cream px-2 text-xs font-semibold">{sec / 60}м</button>)}
      </span>
    </div>
  );
}

// -- сама доска --------------------------------------------------------------------------------------
export default function Board({ boardId = null, canClear = false, canUpload = false, height = "70vh" }) {
  const remote = !!boardId;
  const vp = useRef(null);
  const [objs, setObjs] = useState(() => new Map());
  const objsRef = useRef(objs);
  objsRef.current = objs;
  const [view, setView] = useState({ x: 80, y: 60, z: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  // На телефоне и планшете палец сразу рисует: иначе непонятно, почему доска только двигается
  const [cropping, setCropping] = useState(null);
  const picked = useRef(false); // инструмент выбран вручную
  const [tool, setTool] = useState(() => (window.matchMedia?.("(pointer: coarse)").matches ? "pen" : "select"));
  const [color, setColor] = useState(COLORS[0]);
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0]);
  const [width, setWidth] = useState(4);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null); // рисуемая линия или фигура
  const [live, setLive] = useState(null); // перемещаемый объект
  const [panel, setPanel] = useState(null); // stickers | materials | video
  const [pdfOpen, setPdfOpen] = useState(null); // PDF учебника: выбор страницы для доски
  const [activeVideo, setActiveVideo] = useState(null);
  const [status, setStatus] = useState("");
  const history = useRef([]);
  const lastId = useRef(0);
  const follow = useRef(true); // показывать новое на доске автоматически
  const seen = useRef(new Set());
  const mine = useRef(new Set()); // свои объекты: из-за них вид не прыгает, пока рисуешь у края
  const [offscreen, setOffscreen] = useState(false);
  const gesture = useRef(null);
  const pointers = useRef(new Map());
  const spaceDown = useRef(false);

  const say = useCallback((t) => { setStatus(t); clearTimeout(say.t); say.t = setTimeout(() => setStatus(""), 5000); }, []);

  // -- применение операций ---------------------------------------------------------------
  const applyOps = useCallback((items) => {
    setObjs((old) => {
      const m = new Map(old);
      for (const it of items) {
        if (it.kind === "obj") m.set(it.data.oid, it.data);
        else if (it.kind === "del") m.delete(it.data.oid);
        else if (it.kind === "clear") m.clear();
        else if (it.kind === "erase") it.data.ids.forEach((id) => m.delete(`v1-${id}`));
        else if (it.kind === "stroke") m.set(`v1-${it.id}`, { oid: `v1-${it.id}`, type: "stroke", x: 0, y: 0, w: 1, h: 1, z: it.id, color: it.data.color, width: it.data.width, points: it.data.points, marker: it.data.tool === "marker" });
        else if (it.kind === "text") m.set(`v1-${it.id}`, { oid: `v1-${it.id}`, type: "text", x: it.data.at[0], y: it.data.at[1] - it.data.size, w: it.data.text.length * it.data.size * 0.6 + 20, h: it.data.size * 1.4, z: it.id, color: it.data.color, size: it.data.size, text: it.data.text });
      }
      return m;
    });
  }, []);

  useEffect(() => {
    if (!remote) {
      try { applyOps(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]").map((d) => ({ kind: "obj", data: d }))); } catch { /* пусто */ }
      return undefined;
    }
    let stop = false, timer;
    const poll = async () => {
      try {
        const r = await request("GET", `/site/v1/boards/${boardId}/items?since=${lastId.current}`);
        if (stop) return;
        if (r.items.length) { lastId.current = r.last_id; applyOps(r.items); }
        timer = setTimeout(poll, document.hidden ? 4000 : 1000);
      } catch (e) {
        if (!stop) { say(`Нет связи: ${e.message}`); timer = setTimeout(poll, 3000); }
      }
    };
    poll();
    return () => { stop = true; clearTimeout(timer); };
  }, [boardId, remote, applyOps, say]);

  useEffect(() => {
    if (remote) return;
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify([...objs.values()].filter((o) => !o.oid.startsWith("v1-")))); } catch { /* нет места */ }
  }, [objs, remote]);

  const send = useCallback(async (kind, data, prev) => {
    if (data?.oid) mine.current.add(data.oid);
    applyOps([{ kind, data }]);
    if (kind !== "clear") history.current.push({ oid: data.oid, prev });
    if (!remote) return;
    try {
      const r = await request("POST", `/site/v1/boards/${boardId}/items`, { kind, data });
      if (r.warning) say(r.warning);
    } catch (e) {
      say(`⛔ ${e.message}`);
      applyOps([prev ? { kind: "obj", data: prev } : { kind: "del", data: { oid: data.oid } }]);
    }
  }, [applyOps, boardId, remote, say]);

  const put = useCallback((o) => send("obj", o, objsRef.current.get(o.oid) || null), [send]);
  const remove = useCallback((oid) => { const prev = objsRef.current.get(oid); if (prev) send("del", { oid }, prev); }, [send]);

  const undo = () => {
    const h = history.current.pop();
    if (!h) { say("Отменять нечего"); return; }
    if (h.prev) send("obj", h.prev, objsRef.current.get(h.oid) || null);
    else send("del", { oid: h.oid }, objsRef.current.get(h.oid) || null);
    history.current.pop(); // сама отмена в историю не пишется
  };

  // -- координаты ---------------------------------------------------------------------------
  const toWorld = (e) => {
    const r = vp.current.getBoundingClientRect(), v = viewRef.current;
    return [(e.clientX - r.left - v.x) / v.z, (e.clientY - r.top - v.y) / v.z];
  };
  const center = () => {
    const r = vp.current.getBoundingClientRect(), v = viewRef.current;
    return [(r.width / 2 - v.x) / v.z, (r.height / 2 - v.y) / v.z];
  };
  // Видимая часть холста без полей под панелями (в координатах доски)
  const visibleRect = () => {
    const r = vp.current.getBoundingClientRect(), v = viewRef.current;
    return [(76 - v.x) / v.z, (64 - v.y) / v.z, (r.width - 24 - v.x) / v.z, (r.height - 56 - v.y) / v.z];
  };
  // Свободное место рядом с центром экрана: новые объекты не ложатся друг на друга и не прячутся под панели
  const freeSpot = (w, h) => {
    const [cx, cy] = center();
    const [vx1, vy1, vx2, vy2] = visibleRect();
    const boxes = [...objsRef.current.values()].filter((o) => o.type !== "stroke");
    const hits = (x, y) => boxes.some((o) => x < o.x + o.w + 16 && x + w + 16 > o.x && y < o.y + o.h + 16 && y + h + 16 > o.y);
    const inView = (x, y) => x >= vx1 && y >= vy1 && x + w <= vx2 && y + h <= vy2;
    const cands = [];
    for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) cands.push([cx - w / 2 + i * (w + 24) / 2, cy - h / 2 + j * (h + 24) / 2]);
    cands.sort((a, b) => Math.hypot(a[0] + w / 2 - cx, a[1] + h / 2 - cy) - Math.hypot(b[0] + w / 2 - cx, b[1] + h / 2 - cy));
    const spot = cands.find(([x, y]) => inView(x, y) && !hits(x, y)) || cands.find(([x, y]) => !hits(x, y));
    return spot || [cx - w / 2, cy - h / 2];
  };
  const zoomAt = (factor, cx, cy) => setView((v) => {
    const z = Math.min(4, Math.max(0.15, v.z * factor));
    return { z, x: cx - ((cx - v.x) / v.z) * z, y: cy - ((cy - v.y) / v.z) * z };
  });
  const topZ = () => Date.now() - 1_700_000_000_000; // растёт со временем, укладывается в лимит сервера

  // -- жесты ------------------------------------------------------------------------------------
  const onWheel = (e) => {
    e.preventDefault();
    const r = vp.current.getBoundingClientRect();
    manual();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
    else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
  };
  useEffect(() => {
    const el = vp.current;
    el.addEventListener("wheel", onWheel, { passive: false }); // passive: false – чтобы колесо не листало страницу
    return () => el.removeEventListener("wheel", onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = (e) => {
    if (editing) return;
    if (e.target.closest?.("[data-play]")) return;
    vp.current.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.current.size === 2) { // два пальца – масштаб и сдвиг
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", d: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      setDraft(null);
      return;
    }
    const p = toWorld(e);
    const hitEl = e.target.closest?.("[data-oid]");
    const hit = hitEl ? objsRef.current.get(hitEl.dataset.oid) : null;
    // Палец на пустом месте, а инструмент ещё не выбирали – рисуем: так ожидают на телефоне
    if (e.pointerType === "touch" && !picked.current && tool === "select" && !hit) {
      picked.current = true;
      setTool("pen");
      gesture.current = { kind: "draw" };
      setDraft({ type: "stroke", pts: [p], color, width, marker: false });
      return;
    }
    const pan = tool === "hand" || spaceDown.current || e.button === 1;
    if (pan) { gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, v: viewRef.current }; return; }
    if (e.target.classList?.contains("board-handle") && selected) {
      const o = objsRef.current.get(selected);
      gesture.current = { kind: "resize", o, p };
      return;
    }
    if (tool === "eraser") { if (hit) remove(hit.oid); gesture.current = { kind: "erase" }; return; }
    if (tool === "select") {
      if (hit) {
        setSelected(hit.oid);
        gesture.current = { kind: "move", o: hit, p, moved: false };
      } else {
        setSelected(null); setActiveVideo(null);
        gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, v: viewRef.current };
      }
      return;
    }
    if (tool === "pen" || tool === "marker") {
      gesture.current = { kind: "draw" };
      setDraft({ type: "stroke", pts: [p], color, width: tool === "marker" ? width * 4 : width, marker: tool === "marker" });
      return;
    }
    if (["rect", "ellipse", "arrow", "line"].includes(tool)) {
      gesture.current = { kind: "shape" };
      setDraft({ type: "shape", shape: tool, a: p, b: p, color, width });
      return;
    }
    if (tool === "text" || tool === "note") {
      const o = tool === "note"
        ? { oid: oidGen(), type: "note", x: p[0] - 90, y: p[1] - 60, w: 200, h: 160, z: topZ(), color: noteColor, size: 20, text: "" }
        : { oid: oidGen(), type: "text", x: p[0], y: p[1] - 18, w: 320, h: 60, z: topZ(), color, size: 28, text: "" };
      applyOps([{ kind: "obj", data: o }]);
      setSelected(o.oid); setEditing(o.oid); setTool("select");
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch" && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const r = vp.current.getBoundingClientRect();
      manual();
      setView((v) => ({ ...v, x: v.x + mid[0] - g.mid[0], y: v.y + mid[1] - g.mid[1] }));
      zoomAt(d / g.d, mid[0] - r.left, mid[1] - r.top);
      g.d = d; g.mid = mid;
      return;
    }
    if (g.kind === "pan") { manual(); setView({ ...g.v, x: g.v.x + e.clientX - g.sx, y: g.v.y + e.clientY - g.sy }); return; }
    const p = toWorld(e);
    if (g.kind === "erase") {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-oid]");
      if (el) remove(el.dataset.oid);
      return;
    }
    if (g.kind === "draw") { setDraft((d) => (d && d.pts.length < 5000 ? { ...d, pts: [...d.pts, p] } : d)); return; }
    if (g.kind === "shape") { setDraft((d) => d && { ...d, b: p }); return; }
    if (g.kind === "move") {
      const dx = p[0] - g.p[0], dy = p[1] - g.p[1];
      if (Math.abs(dx) + Math.abs(dy) > 2) g.moved = true;
      setLive({ ...g.o, x: g.o.x + dx, y: g.o.y + dy });
      return;
    }
    if (g.kind === "resize") {
      const o = g.o;
      let w = Math.max(30, o.w + p[0] - g.p[0]), h = Math.max(24, o.h + p[1] - g.p[1]);
      if (["image", "sticker", "video"].includes(o.type)) h = w * (o.h / o.w); // пропорции
      setLive({ ...o, w, h, size: o.type === "text" ? Math.max(10, Math.round(o.size * (h / o.h))) : o.size });
    }
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if ((g.kind === "move" && g.moved) || g.kind === "resize") {
      setLive((l) => { if (l) put({ ...l, z: g.kind === "move" ? topZ() : l.z }); return null; });
      return;
    }
    if (g.kind === "draw") {
      setDraft((d) => {
        if (d && d.pts.length) {
          const xs = d.pts.map((q) => q[0]), ys = d.pts.map((q) => q[1]);
          const x = Math.min(...xs), y = Math.min(...ys);
          put({ oid: oidGen(), type: "stroke", x, y, w: Math.max(1, Math.max(...xs) - x), h: Math.max(1, Math.max(...ys) - y),
            z: topZ(), color: d.color, width: d.width, marker: d.marker, points: d.pts.map((q) => [Math.round((q[0] - x) * 10) / 10, Math.round((q[1] - y) * 10) / 10]) });
        }
        return null;
      });
      return;
    }
    if (g.kind === "shape") {
      setDraft((d) => {
        if (d && Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) > 6) {
          const x = Math.min(d.a[0], d.b[0]), y = Math.min(d.a[1], d.b[1]);
          const o = { oid: oidGen(), type: "shape", shape: d.shape, x, y, w: Math.max(1, Math.abs(d.b[0] - d.a[0])), h: Math.max(1, Math.abs(d.b[1] - d.a[1])), z: topZ(), color: d.color, width: d.width };
          if (d.shape === "arrow" || d.shape === "line") o.points = [[d.a[0] - x, d.a[1] - y], [d.b[0] - x, d.b[1] - y]];
          put(o);
        }
        return null;
      });
    }
  };

  const onDoubleClick = (e) => {
    const el = e.target.closest?.("[data-oid]");
    const o = el && objsRef.current.get(el.dataset.oid);
    if (o && ["text", "note", "card", "table"].includes(o.type)) { setSelected(o.oid); setEditing(o.oid); }
  };

  const onEditDone = useCallback((o, value) => {
    setEditing(null);
    if (typeof value === "object") { put({ ...o, ...value }); return; } // карточка или таблица
    const text = value;
    if (!text.trim() && !objsRef.current.get(o.oid)?.text) { applyOps([{ kind: "del", data: { oid: o.oid } }]); return; }
    if (text !== o.text || !history.current.some((h) => h.oid === o.oid)) put({ ...o, text });
  }, [applyOps, put]);

  // -- клавиатура ---------------------------------------------------------------------------------
  useEffect(() => {
    const down = (e) => {
      if (e.target.closest?.("input, textarea, [contenteditable]")) return;
      if (e.code === "Space") { spaceDown.current = true; e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) { remove(selected); setSelected(null); }
      const keys = { v: "select", h: "hand", p: "pen", e: "eraser", t: "text", n: "note" };
      if (!e.ctrlKey && !e.metaKey && keys[e.key.toLowerCase()]) setTool(keys[e.key.toLowerCase()]);
    };
    const up = (e) => { if (e.code === "Space") spaceDown.current = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  });

  // -- вставка ------------------------------------------------------------------------------------
  const place = (o) => { const [x, y] = freeSpot(o.w, o.h); put({ oid: oidGen(), z: topZ(), x, y, ...o }); setTool("select"); };
  // Карточка и таблица сразу уходят ученику, а после «Готово» обновляются
  const placeAndEdit = (o) => {
    const [x, y] = freeSpot(o.w, o.h);
    const obj = { oid: oidGen(), z: topZ(), x, y, ...o };
    put(obj); setSelected(obj.oid); setEditing(obj.oid); setTool("select");
  };
  const addSticker = (s) => { place({ type: "sticker", sticker: s.id, w: 130, h: 130 }); setPanel(null); };
  const addCard = () => placeAndEdit({ type: "card", w: 220, h: 140, front: "", back: "", flipped: false, color: "#FFF4C7" });
  const addTable = () => placeAndEdit({ type: "table", w: 400, h: 160, head: true, cells: [["I", "you", "he / she"], ["am", "are", "is"], ["", "", ""]] });
  const addTimer = () => place({ type: "timer", w: 240, h: 150, seconds: 120, left: 120, started: null, label: "Время на задание" });
  const pagePicked = async (blob, page) => {
    const name = `${pdfOpen.title.replace(/\.pdf$/i, "")}, стр. ${page}.jpg`;
    const r = await fetch("/site/v1/materials/upload", { method: "POST", body: blob, headers: {
      "Content-Type": "image/jpeg", "X-File-Name": encodeURIComponent(name), "X-Folder": encodeURIComponent("Страницы учебников"), "X-Access-Token": getToken() || "" } });
    const m = await r.json();
    if (!r.ok) throw new Error(m.error || "не получилось");
    placeImage(m.url, m.title, 720);
    setPdfOpen(null);
  };
  const addMaterial = (m) => {
    if (m.kind === "video") place({ type: "video", url: m.url, title: m.title, w: 480, h: 310 });
    else if (m.kind === "link") place({ type: "link", url: m.url, title: m.title, w: 300, h: 84 });
    else if (m.mime?.startsWith("image/")) placeImage(m.url, m.title);
    else if (m.mime === "application/pdf") { setPdfOpen(m); setPanel(null); return; } // учебник: выбрать страницу
    else place({ type: "file", src: m.url, title: m.title, w: 300, h: 84 });
    setPanel(null);
  };
  const placeImage = (src, title, max = 520) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      place({ type: "image", src, title, w: Math.round(img.width * k), h: Math.round(img.height * k) });
    };
    img.src = src;
  };
  const uploadImage = async (file) => {
    if (!file) return;
    say("Загружаем…");
    try {
      const r = await fetch("/site/v1/materials/upload", { method: "POST", body: file, headers: {
        "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name), "X-Folder": encodeURIComponent("С доски"),
        "X-Access-Token": getToken() || "" } });
      const m = await r.json();
      if (!r.ok) throw new Error(m.error || "ошибка загрузки");
      addMaterial(m); say("");
    } catch (e) { say(`⛔ ${e.message}`); }
  };
  const fit = (list = [...objsRef.current.values()]) => {
    if (!list.length) { setView({ x: 80, y: 60, z: 1 }); return; }
    const r = vp.current.getBoundingClientRect();
    // Поля: слева панель инструментов, сверху палитра – содержимое не должно уходить под них
    const pl = 76, pt = 64, pr = 24, pb = 56;
    const x1 = Math.min(...list.map((o) => o.x)), y1 = Math.min(...list.map((o) => o.y));
    const x2 = Math.max(...list.map((o) => o.x + o.w)), y2 = Math.max(...list.map((o) => o.y + o.h));
    const aw = r.width - pl - pr, ah = r.height - pt - pb;
    const z = Math.min(2, Math.max(0.15, Math.min(aw / (x2 - x1 || 1), ah / (y2 - y1 || 1))));
    setView({ z, x: pl - x1 * z + (aw - (x2 - x1) * z) / 2, y: pt - y1 * z + (ah - (y2 - y1) * z) / 2 });
  };

  // Пока человек сам не двигал холст, доска показывает всё, что на ней появилось: ученик с телефона
  // видит заметку преподавателя, даже если она легла за краем его маленького экрана.
  useEffect(() => {
    const before = seen.current;
    seen.current = new Set(objs.keys());
    if (!vp.current || !objs.size) return;
    const [vx1, vy1, vx2, vy2] = visibleRect();
    const fresh = [...objs.values()].filter((o) => !before.has(o.oid) && !mine.current.has(o.oid));
    const outside = fresh.some((o) => o.x < vx1 || o.y < vy1 || o.x + o.w > vx2 || o.y + o.h > vy2);
    if (!outside) return;
    if (follow.current) fit([...objs.values()]);
    else setOffscreen(true);
  }, [objs]); // eslint-disable-line react-hooks/exhaustive-deps
  const manual = () => { follow.current = false; };
  const showAll = () => { follow.current = true; setOffscreen(false); fit(); };

  const ordered = useMemo(() => [...objs.values()].sort((a, b) => (a.z || 0) - (b.z || 0)), [objs]);
  const sel = selected && (live?.oid === selected ? live : objs.get(selected));
  const cursor = tool === "hand" ? "grab" : tool === "select" ? "default" : tool === "text" ? "text" : "crosshair";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-white shadow-soft" style={{ height }}>
      <div ref={vp} className="board-viewport h-full w-full" style={{ cursor, backgroundSize: `${22 * view.z}px ${22 * view.z}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}>
        <div className="board-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
          {ordered.map((o) => (live?.oid === o.oid ? null : (
            <ObjView key={o.oid} o={o} selected={selected === o.oid} editing={editing === o.oid} onEditDone={onEditDone}
              activeVideo={activeVideo} setActiveVideo={setActiveVideo} onAction={put} />
          )))}
          {live && <ObjView o={live} selected activeVideo={activeVideo} setActiveVideo={setActiveVideo} />}
          {sel && tool === "select" && !editing && sel.type !== "stroke" && !(sel.type === "shape" && sel.points) && (
            <div className="pointer-events-none absolute" style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h, zIndex: 2147483647 }}>
              <span className="board-handle pointer-events-auto" />
            </div>
          )}
          {draft?.type === "stroke" && (
            <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" style={{ zIndex: 2147483647 }}>
              <path d={draft.pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ")} fill="none" stroke={draft.color}
                strokeWidth={draft.width} strokeLinecap="round" strokeLinejoin="round" opacity={draft.marker ? 0.35 : 1} />
            </svg>
          )}
          {draft?.type === "shape" && (
            <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" style={{ zIndex: 2147483647 }}>
              {draft.shape === "rect" && <rect x={Math.min(draft.a[0], draft.b[0])} y={Math.min(draft.a[1], draft.b[1])} width={Math.abs(draft.b[0] - draft.a[0])} height={Math.abs(draft.b[1] - draft.a[1])} rx="10" fill="none" stroke={draft.color} strokeWidth={draft.width} />}
              {draft.shape === "ellipse" && <ellipse cx={(draft.a[0] + draft.b[0]) / 2} cy={(draft.a[1] + draft.b[1]) / 2} rx={Math.abs(draft.b[0] - draft.a[0]) / 2} ry={Math.abs(draft.b[1] - draft.a[1]) / 2} fill="none" stroke={draft.color} strokeWidth={draft.width} />}
              {(draft.shape === "line" || draft.shape === "arrow") && <path d={`M${draft.a[0]} ${draft.a[1]}L${draft.b[0]} ${draft.b[1]}`} stroke={draft.color} strokeWidth={draft.width} strokeLinecap="round" />}
            </svg>
          )}
        </div>
      </div>

      {/* Инструменты – слева, как в Miro */}
      <div className="glass absolute left-2 top-1/2 flex max-h-[calc(100%-1.5rem)] -translate-y-1/2 flex-col gap-1 overflow-y-auto rounded-2xl p-1.5 sm:left-3" style={{ touchAction: "pan-y" }} role="toolbar" aria-label="Инструменты доски">
        {TOOLS.map(([id, Icon, title]) => (
          <button key={id} type="button" title={title} aria-label={title} aria-pressed={tool === id} onClick={() => { picked.current = true; setTool(id); }}
            className={`grid h-9 w-9 place-items-center rounded-xl transition ${tool === id ? "bg-ink text-white" : "text-ink-soft hover:bg-cream"}`}>
            <Icon size={18} />
          </button>
        ))}
        <span className="mx-2 my-1 h-px bg-line" />
        <button type="button" title="Карточка слова" aria-label="Карточка слова" onClick={addCard} className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft hover:bg-cream"><Layers size={18} /></button>
        <button type="button" title="Таблица" aria-label="Таблица" onClick={addTable} className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft hover:bg-cream"><Table size={18} /></button>
        <button type="button" title="Таймер" aria-label="Таймер" onClick={addTimer} className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft hover:bg-cream"><Timer size={18} /></button>
        <button type="button" title="Стикеры" aria-label="Стикеры" onClick={() => setPanel(panel === "stickers" ? null : "stickers")} className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft hover:bg-cream"><Smile size={18} /></button>
        {canUpload && (
          <>
            <label title="Картинка с компьютера" className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl text-ink-soft hover:bg-cream">
              <ImagePlus size={18} /><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0])} />
            </label>
            <button type="button" title="Из материалов" aria-label="Из материалов" onClick={() => setPanel("materials")} className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft hover:bg-cream"><FolderOpen size={18} /></button>
          </>
        )}
        <button type="button" title="Видео VK, YouTube, Rutube" aria-label="Видео" onClick={() => setPanel("video")} className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft hover:bg-cream"><Film size={18} /></button>
        <button type="button" title="Отменить (Ctrl+Z)" aria-label="Отменить" onClick={undo} className="grid h-9 w-9 place-items-center rounded-xl text-ink-soft hover:bg-cream"><Undo2 size={18} /></button>
      </div>

      {/* Цвет и толщина – сверху */}
      <div className="glass absolute left-16 right-3 top-3 flex items-center gap-1.5 overflow-x-auto rounded-full px-2 py-1.5 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
        {(tool === "note" ? NOTE_COLORS : COLORS).map((c) => (
          <button key={c} type="button" aria-label={`Цвет ${c}`} onClick={() => (tool === "note" ? setNoteColor(c) : setColor(c))}
            className={`h-6 w-6 rounded-full border-2 transition ${(tool === "note" ? noteColor : color) === c ? "scale-110 border-ink" : "border-white"}`} style={{ background: c }} />
        ))}
        <input type="range" min="1" max="24" value={width} onChange={(e) => setWidth(Number(e.target.value))} aria-label="Толщина" className="ml-1 w-20 accent-[rgb(var(--brand))]" />
        {sel && tool === "select" && (
          <>
            <span className="mx-1 h-5 w-px bg-line" />
            {sel.type === "image" && <button type="button" className="btn-ghost btn-sm !px-2" title="Обрезать" aria-label="Обрезать картинку" onClick={() => setCropping(sel)}><CropIcon size={15} /></button>}
            <button type="button" className="btn-ghost btn-sm !px-2" title="Удалить" onClick={() => { remove(sel.oid); setSelected(null); }}><Trash2 size={15} /></button>
          </>
        )}
        {canClear && <button type="button" className="btn-ghost btn-sm" onClick={() => { if (window.confirm("Очистить доску для всех?")) send("clear", {}, null); }}>Очистить</button>}
      </div>

      {/* Масштаб – справа снизу */}
      <div className="glass absolute bottom-3 right-3 flex items-center gap-1 rounded-full px-1.5 py-1">
        <button type="button" aria-label="Уменьшить" className="grid h-8 w-8 place-items-center rounded-full hover:bg-cream" onClick={() => { manual(); const r = vp.current.getBoundingClientRect(); zoomAt(1 / 1.2, r.width / 2, r.height / 2); }}><Minus size={16} /></button>
        <span className="num w-12 text-center text-xs font-semibold">{Math.round(view.z * 100)}%</span>
        <button type="button" aria-label="Увеличить" className="grid h-8 w-8 place-items-center rounded-full hover:bg-cream" onClick={() => { manual(); const r = vp.current.getBoundingClientRect(); zoomAt(1.2, r.width / 2, r.height / 2); }}><Plus size={16} /></button>
        <button type="button" aria-label="Показать всё" title="Показать всё" className="grid h-8 w-8 place-items-center rounded-full hover:bg-cream" onClick={showAll}><Maximize size={15} /></button>
      </div>
      {offscreen && (
        <button type="button" onClick={showAll} className="absolute bottom-16 right-3 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-lift">
          Новое на доске за краем экрана · Показать
        </button>
      )}
      {status && <div className="glass absolute bottom-3 left-16 rounded-full px-4 py-1.5 text-xs font-semibold text-ink-soft">{status}</div>}

      {panel === "stickers" && <StickerPanel onPick={addSticker} onClose={() => setPanel(null)} />}
      <MaterialsPicker open={panel === "materials"} onClose={() => setPanel(null)} onPick={addMaterial} />
      <Modal open={!!pdfOpen} onClose={() => setPdfOpen(null)} title={pdfOpen?.title || ""} wide>
        {pdfOpen && <Suspense fallback={<p className="muted">Открываем…</p>}><PdfPages url={pdfOpen.url} title={pdfOpen.title} onPick={pagePicked} height="62vh" /></Suspense>}
      </Modal>
      <VideoDialog open={panel === "video"} onClose={() => setPanel(null)} onAdd={(url, title) => { place({ type: "video", url, title, w: 480, h: 310 }); setPanel(null); }} />
      {cropping && (
        <CropDialog src={cropping.src} crop={cropping.crop} onClose={() => setCropping(null)} onApply={(crop) => {
          const o = cropping;
          const [, , ow, oh] = o.crop || [0, 0, 1, 1];
          const [, , nw, nh] = crop || [0, 0, 1, 1];
          // масштаб на доске сохраняется: тот же размер одного пикселя исходника
          put({ ...o, crop: crop || undefined, w: Math.max(30, (o.w / ow) * nw), h: Math.max(24, (o.h / oh) * nh) });
          setCropping(null);
        }} />
      )}
    </div>
  );
}

function StickerPanel({ onPick, onClose }) {
  const packs = Object.keys(PACKS);
  const [pack, setPack] = useState(packs[0]);
  return (
    <div className="glass absolute left-16 top-16 z-10 w-[min(420px,calc(100%-5rem))] rounded-3xl p-3" onPointerDown={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold">Стикеры</span><button type="button" className="btn-ghost btn-sm" onClick={onClose}>Закрыть</button></div>
      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {packs.map((p) => (
          <button key={p} type="button" onClick={() => setPack(p)} className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${pack === p ? "bg-ink text-white" : "bg-white text-ink-soft"}`}>{p}</button>
        ))}
      </div>
      <div className="grid max-h-64 grid-cols-5 gap-2 overflow-y-auto">
        {PACKS[pack].map((s) => (
          <button key={s.id} type="button" onClick={() => onPick(s)} title="Добавить на доску"
            className="grid aspect-square place-items-center rounded-2xl bg-white/80 p-1.5 transition hover:-translate-y-0.5 hover:bg-cream hover:shadow-soft">
            {s.emoji ? <span className="text-3xl leading-none">{s.emoji}</span> : <img alt="" src={s.src} className="h-full w-full object-contain" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function MaterialsPicker({ open, onClose, onPick }) {
  const [list, setList] = useState(null);
  useEffect(() => { if (open) request("GET", "/site/v1/materials").then((d) => setList(d.materials)).catch(() => setList([])); }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Материалы на доску" wide>
      {!list ? <p className="muted">Загружаем…</p> : !list.length ? <p className="muted">Материалов пока нет – добавьте их в разделе «Материалы».</p> : (
        <div className="grid gap-2 sm:grid-cols-2">
          {list.map((m) => (
            <button key={m.id} type="button" onClick={() => onPick(m)} className="flex items-center gap-3 rounded-2xl border border-line p-3 text-left transition hover:border-brand hover:bg-brand-tint">
              {m.mime?.startsWith("image/") ? <img alt="" src={m.url} className="h-12 w-12 rounded-xl object-cover" /> :
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand">{m.kind === "video" ? <Film size={20} /> : m.kind === "link" ? <Link2 size={20} /> : <FileText size={20} />}</span>}
              <span className="min-w-0"><span className="block truncate font-semibold">{m.title}</span><span className="text-xs text-ink-mute">{m.folder || (m.shared ? "материалы школы" : "мои материалы")}</span></span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function VideoDialog({ open, onClose, onAdd }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  return (
    <Modal open={open} onClose={onClose} title="Видео на доску">
      <p className="mb-4 text-sm text-ink-mute">Вставьте ссылку на VK Видео, YouTube или Rutube – видео встанет на доску, и ученик посмотрит его вместе с вами без демонстрации экрана.</p>
      <div className="grid gap-3">
        <input className="field" placeholder="https://vkvideo.ru/video-…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Ссылка на видео" />
        <input className="field" placeholder="Название (необязательно)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Название" />
        <button type="button" className="btn-brand" disabled={!url.startsWith("http")} onClick={() => { onAdd(url.trim(), title.trim()); setUrl(""); setTitle(""); }}>Добавить</button>
      </div>
    </Modal>
  );
}
