import { Mic, Send, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { canRecord, startVoice } from "../lib/voice.js";

/**
 * Кнопка голосового: нажали – идёт запись, нажали «Отправить» – запись уходит.
 * Нажатие, а не удержание: на телефоне в дороге так надёжнее.
 */
export default function VoiceButton({ onSend, disabled, max = 180 }) {
  const [rec, setRec] = useState(null);
  const [sec, setSec] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const timer = useRef(null);
  const live = useRef(null); // идущая запись: отменяем её, только если окно закрыли посреди записи
  useEffect(() => () => { clearInterval(timer.current); live.current?.cancel(); }, []);
  if (!canRecord()) return null;
  const start = async () => {
    setErr(null);
    try {
      const r = await startVoice();
      live.current = r;
      setRec(r); setSec(0);
      timer.current = setInterval(() => setSec((s) => s + 1), 1000);
    } catch {
      setErr("Нет доступа к микрофону. Разрешите его в настройках браузера (нужен адрес https://).");
    }
  };
  const stop = async (send) => {
    clearInterval(timer.current);
    const r = rec;
    live.current = null;
    setRec(null);
    if (!send) { r.cancel(); return; }
    setBusy(true);
    try { await onSend(await r.stop()); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  useEffect(() => { if (rec && sec >= max) stop(true); }); // eslint-disable-line react-hooks/exhaustive-deps
  if (rec) {
    return (
      <div className="flex flex-1 items-center gap-2">
        <button type="button" className="btn-ghost !h-10 !w-10 !p-0" onClick={() => stop(false)} aria-label="Удалить запись"><Trash2 size={18} /></button>
        <span className="flex flex-1 items-center gap-2 rounded-xl bg-teach-tint px-3 text-sm font-semibold text-teach-deep" style={{ height: 40 }}>
          <span className="h-2 w-2 animate-pulse rounded-full bg-teach" />Запись {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}
        </span>
        <button type="button" className="btn-brand !h-10 !w-10 !p-0" onClick={() => stop(true)} aria-label="Отправить голосовое"><Send size={17} /></button>
      </div>
    );
  }
  return (
    <>
      <button type="button" className="btn-light !h-10 !w-10 shrink-0 !p-0" disabled={disabled || busy} onClick={start} aria-label="Записать голосовое" title="Голосовое">
        {busy ? <Square size={14} className="animate-pulse" /> : <Mic size={18} />}
      </button>
      {err && <p role="alert" className="absolute bottom-full left-0 right-0 mb-2 rounded-xl bg-teach-tint px-3 py-2 text-xs text-teach-deep">{err}</p>}
    </>
  );
}
