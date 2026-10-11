import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, Circle, LogOut, Mic, MicOff, MonitorUp, PenLine, Send, ShieldCheck, Square, Video, VideoOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorBox, Notice, PageHead } from "../components/ui.jsx";
import { getToken, request } from "../lib/api.js";
import { RoomClient } from "../lib/room.js";
import { Canvas } from "./Board.jsx";
import { CabinetLogin } from "./Cabinet.jsx";

/** Видео: srcObject нельзя задать атрибутом — ставим через ref. */
function VideoView({ stream, muted = false, mirror = false, className = "" }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream || null; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${className} ${mirror ? "-scale-x-100" : ""}`} />;
}

function useTimer(startIso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!startIso) return "00:00";
  const s = Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

async function getMedia() {
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  try {
    return await navigator.mediaDevices.getUserMedia({ audio, video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
  } catch {
    return navigator.mediaDevices.getUserMedia({ audio }); // без камеры урок возможен, без микрофона — нет
  }
}

function Lobby({ onJoin, error }) {
  const [preview, setPreview] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  useEffect(() => {
    let stream;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError(new Error("Браузер не даёт доступ к камере и микрофону. Откройте сайт по https:// в Chrome, Edge, Firefox или Safari."));
      return undefined;
    }
    getMedia().then((s) => { stream = s; setPreview(s); })
      .catch(() => setMediaError(new Error("Нет доступа к микрофону. Разрешите доступ в настройках браузера (значок замка в адресной строке) и обновите страницу.")));
    return () => { if (stream && !stream.__joined) stream.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
      <div className="relative aspect-video overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-glow-violet">
        {preview?.getVideoTracks().length ? <VideoView stream={preview} muted mirror className="h-full w-full object-cover" />
          : <div className="grid h-full place-items-center text-zinc-500">{preview ? "Камера выключена — урок пройдёт со звуком" : "Проверяем камеру и микрофон…"}</div>}
      </div>
      <div className="card">
        <h2 className="text-3xl">Готовы начать?</h2>
        <ul className="mt-5 grid gap-3 text-sm">
          <li className="flex gap-3"><Circle size={16} className="mt-0.5 shrink-0 fill-rose-500 text-rose-500" />Урок записывается и расшифровывается: по записи собирается конспект, а школа контролирует качество.</li>
          <li className="flex gap-3"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-soft" />Обмен личными контактами в речи, чате и на доске запрещён — нарушения автоматически передаются администратору.</li>
          <li className="flex gap-3"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-violet-soft" />После урока конспект, слова, тест и ДЗ придут в Telegram и появятся в кабинете.</li>
        </ul>
        {(mediaError || error) && <div className="mt-5"><ErrorBox error={mediaError || error} /></div>}
        <button type="button" className="btn-primary mt-7 w-full !py-3.5" disabled={!preview}
          onClick={() => { preview.__joined = true; onJoin(preview); }}>
          Войти в класс — я согласен с записью
        </button>
      </div>
    </div>
  );
}

function Control({ on = true, onClick, label, icon: Icon, offIcon: OffIcon, danger }) {
  const I = on ? Icon : OffIcon || Icon;
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={!on}
      className={`grid h-12 w-12 place-items-center rounded-full border transition-all duration-300 ease-out ${
        danger ? "border-rose-500/40 bg-rose-500/90 text-white hover:bg-rose-500"
          : on ? "border-white/10 bg-white/10 text-white hover:bg-white/20" : "border-rose-400/40 bg-rose-500/20 text-rose-200"}`}>
      <I size={19} />
    </button>
  );
}

function Chat({ messages, onSend, canWrite }) {
  const [text, setText] = useState("");
  const [warn, setWarn] = useState(null);
  const box = useRef(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [messages.length]);
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const res = await onSend(text).catch((err) => ({ error: err }));
    if (res?.error) setWarn(res.error.message);
    else if (res?.moderation?.action === "block") setWarn(`Сообщение скрыто: ${res.moderation.summary}. Нарушение передано администратору.`);
    else setWarn(res?.moderation?.warning || null);
    setText("");
  };
  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div ref={box} data-lenis-prevent className="flex-1 space-y-3 overflow-y-auto pr-1">
        {!messages.length && <p className="text-sm text-zinc-500">Здесь появятся сообщения и живая расшифровка речи.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`rounded-2xl px-3.5 py-2.5 text-sm ${m.source === "speech" ? "bg-white/[.03] text-zinc-400" : "bg-white/[.07] text-zinc-100"}`}>
            <span className={`mr-2 text-xs font-semibold ${m.role === "tutor" ? "text-violet-soft" : "text-emerald-soft"}`}>
              {m.source === "speech" && "🎙 "}{m.speaker_name}
            </span>
            {m.text}
          </div>
        ))}
      </div>
      {warn && <div className="mt-3"><Notice tone="warn">{warn}</Notice></div>}
      {canWrite && (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input className="field" placeholder="Сообщение…" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Сообщение в чат урока" />
          <button type="submit" className="btn-primary !px-4" aria-label="Отправить"><Send size={16} /></button>
        </form>
      )}
    </div>
  );
}

export default function Room({ id }) {
  const [phase, setPhase] = useState("lobby"); // lobby | live | finished
  const [state, setState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [local, setLocal] = useState(null);
  const [remote, setRemote] = useState(null);
  const [peerState, setPeerState] = useState("new");
  const [rec, setRec] = useState(null);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [view, setView] = useState("video");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const client = useRef(null);
  const screen = useRef(null);
  const timer = useTimer(state?.started_at);

  useEffect(() => () => { client.current?.leave(); }, []);
  useEffect(() => () => local?.getTracks().forEach((t) => t.stop()), [local]);
  useEffect(() => {
    const warn = (e) => { if (phase === "live") { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  const join = async (stream) => {
    setLocal(stream);
    setError(null);
    const c = new RoomClient(id, {
      onState: setState,
      onMessages: (m) => setMessages((old) => [...old, ...m.filter((x) => !old.some((o) => o.id === x.id))]),
      onRemoteStream: setRemote,
      onPeer: setPeerState,
      onRecording: setRec,
      onFinished: () => setPhase("finished"),
      onError: (e) => { if (e.status) setError(e); },
    });
    client.current = c;
    try {
      await c.join(stream);
      setPhase((p) => (p === "finished" ? p : "live"));
    } catch (e) { setError(e); }
  };

  const toggleMic = () => { local?.getAudioTracks().forEach((t) => { t.enabled = !mic; }); setMic(!mic); };
  const toggleCam = () => { local?.getVideoTracks().forEach((t) => { t.enabled = !cam; }); setCam(!cam); };
  const toggleShare = async () => {
    if (sharing) {
      screen.current?.getTracks().forEach((t) => t.stop());
      client.current?.replaceVideo(local.getVideoTracks()[0] || null);
      setSharing(false);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screen.current = s;
      const track = s.getVideoTracks()[0];
      client.current?.replaceVideo(track);
      track.onended = () => { client.current?.replaceVideo(local.getVideoTracks()[0] || null); setSharing(false); };
      setSharing(true);
    } catch { /* пользователь отменил выбор экрана */ }
  };
  const leave = async () => {
    await client.current?.leave();
    window.location.hash = "#/cabinet";
  };
  const finish = async () => {
    if (!window.confirm("Завершить урок? Конспект и отчёты уйдут ученику, родителям и вам в Telegram.")) return;
    setBusy(true);
    try {
      await client.current?.stopRecorder(); // последний фрагмент речи попадёт в отчёт
      const res = await request("POST", `/site/v1/rooms/${encodeURIComponent(id)}/finish`, {});
      setResult(res);
      await client.current?.leave(false);
      setPhase("finished");
    } catch (e) { setError(e); }
    setBusy(false);
  };

  const sendChat = (text) => request("POST", `/site/v1/rooms/${encodeURIComponent(id)}/chat`, { text });
  const participant = state && (state.role === "tutor" || state.role === "student");
  const remoteBoard = useMemo(() => (state?.board_id ? { boardId: state.board_id, request } : null), [state?.board_id]);

  if (!getToken()) return <CabinetLogin />;

  if (phase === "finished") {
    const d = result?.delivered;
    return (
      <PageHead eyebrow="Урок завершён" title="Спасибо за урок!"
        text={state?.role === "tutor" || result ? "Отчёты собраны по записи и переписке урока." : "Конспект, новые слова, тест и домашнее задание придут в Telegram и появятся в личном кабинете."}>
        {d && (
          <div className="mt-6 max-w-xl"><Notice tone="ok">
            Отправлено в Telegram: ученику — {d.student ? "✓" : "—"}, родителям — {d.parents}, вам — {d.tutor ? "✓" : "—"}.
            {result.violations ? ` Нарушений на уроке: ${result.violations} (подробности у администратора).` : ""}
          </Notice></div>
        )}
        <a className="btn-primary mt-7" href={`#/lesson/${id}`}>Открыть материалы урока</a>
      </PageHead>
    );
  }

  if (phase === "lobby") {
    return (
      <>
        <PageHead eyebrow={<a href="#/cabinet" className="inline-flex items-center gap-2 hover:text-white"><ArrowLeft size={14} /> Личный кабинет</a>} title="Онлайн-класс" />
        <Lobby onJoin={join} error={error} />
      </>
    );
  }

  const peer = state?.peer;
  const connected = peerState === "connected" && remote;
  return (
    <div className="pb-6 pt-28">
      {/* Верхняя строка: тема, таймер, индикатор записи и проверки речи */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl">{state?.title || "Урок"}</h1>
          <p className="text-sm text-zinc-500">{state?.me} · с вами {peer?.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip gap-2 !border-rose-500/30 !bg-rose-500/10 !text-rose-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" /> Запись · {timer}
          </span>
          {state && !state.speech_available && <span className="chip !text-amber-200">расшифровка на сервере не установлена</span>}
          {rec && <span className={`chip ${rec.ok ? "!text-emerald-soft" : "!text-amber-200"}`} title={rec.error || ""}>
            {rec.blocked ? "⛔ контакты в речи — нарушение зафиксировано" : rec.ok ? "речь проверена" : "речь не проверена"}
          </span>}
        </div>
      </div>
      {error && <div className="mb-4"><ErrorBox error={error} /></div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          <div className="glass inline-flex w-fit gap-1 rounded-full p-1">
            {[["video", "Видео"], ["board", "Доска"]].map(([k, t]) => (
              <button key={k} type="button" onClick={() => setView(k)}
                className={`rounded-full px-4 py-1.5 text-sm transition-all duration-300 ${view === k ? "bg-white text-obsidian" : "text-zinc-300 hover:text-white"}`}>
                {k === "board" ? <PenLine size={14} className="mr-1 inline" /> : <Video size={14} className="mr-1 inline" />}{t}
              </button>
            ))}
          </div>
          <div className="relative">
            {/* Сцена: видео собеседника и своё окошко; при открытой доске видео переезжает в боковую колонку */}
            {view === "video" && (
              <div className="relative aspect-video overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-glow-violet">
                {connected ? <VideoView stream={remote} className="h-full w-full object-cover" /> : (
                  <div className="grid h-full place-items-center p-4 text-center text-sm text-zinc-400">
                    {peer?.online ? "Соединяемся…" : `Ожидаем: ${peer?.name || "собеседник"}`}
                  </div>
                )}
                <div className="absolute bottom-4 right-4 h-28 w-44 overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 shadow-2xl md:h-36 md:w-56">
                  {cam && local?.getVideoTracks().length ? <VideoView stream={local} muted mirror={!sharing} className="h-full w-full object-cover" />
                    : <div className="grid h-full place-items-center text-xs text-zinc-500">камера выключена</div>}
                </div>
              </div>
            )}
            {view === "board" && (remoteBoard ? <Canvas remote={remoteBoard} canClear={state?.role === "tutor"} />
              : <Notice>Доска урока появится через секунду…</Notice>)}
          </div>

          {/* Панель управления */}
          <div className="glass flex flex-wrap items-center justify-center gap-3 rounded-full px-4 py-3">
            <Control on={mic} onClick={toggleMic} label={mic ? "Выключить микрофон" : "Включить микрофон"} icon={Mic} offIcon={MicOff} />
            <Control on={cam} onClick={toggleCam} label={cam ? "Выключить камеру" : "Включить камеру"} icon={Video} offIcon={VideoOff} />
            {navigator.mediaDevices?.getDisplayMedia && <Control on={!sharing} onClick={toggleShare} label={sharing ? "Остановить показ экрана" : "Показать экран"} icon={MonitorUp} />}
            <Control onClick={leave} label="Выйти из класса" icon={LogOut} />
            {state?.role === "tutor" && (
              <button type="button" disabled={busy} onClick={finish}
                className="btn ml-1 bg-rose-500 hover:bg-rose-400 hover:shadow-[0_10px_40px_-10px_rgba(244,63,94,.8)]">
                <Square size={14} className="fill-current" /> {busy ? "Готовлю отчёты…" : "Завершить урок"}
              </button>
            )}
          </div>
        </div>

        <aside className="card !p-4 md:!p-5">
          {view === "board" && (
            <div className="mb-4 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
              {connected ? <VideoView stream={remote} className="h-full w-full object-cover" />
                : <div className="grid h-full place-items-center text-xs text-zinc-500">{peer?.online ? "Соединяемся…" : `Ожидаем: ${peer?.name || ""}`}</div>}
            </div>
          )}
          <h2 className="mb-3 text-xl">Чат и расшифровка</h2>
          <Chat messages={messages} onSend={sendChat} canWrite={participant} />
        </aside>
      </div>
      <AnimatePresence>
        {state && !state.speech_available && state.role === "tutor" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 max-w-3xl">
            <Notice tone="warn">На сервере не установлено распознавание речи: запись сохраняется, но речь не расшифровывается и не проверяется. Установите requirements-speech.txt.</Notice>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
