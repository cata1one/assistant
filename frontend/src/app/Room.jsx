import {
  ArrowLeft, Circle, LayoutPanelLeft, LogOut, MessageSquare, Mic, MicOff, MonitorUp, PenLine, Send, ShieldCheck, Square, Video, VideoOff,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { request } from "../lib/api.js";
import { RoomClient } from "../lib/room.js";
import { ErrorBox, Loading, Notice } from "../ui/kit.jsx";

const Board = lazy(() => import("../board/Board.jsx"));

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
      setMediaError(new Error("Браузер не даёт доступ к камере и микрофону. Нужен адрес https:// и браузер Chrome, Edge, Firefox или Safari."));
      return undefined;
    }
    getMedia().then((s) => { stream = s; setPreview(s); })
      .catch(() => setMediaError(new Error("Нет доступа к микрофону. Разрешите доступ в настройках браузера (значок замка в адресной строке) и обновите страницу.")));
    return () => { if (stream && !stream.__joined) stream.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (
    <div className="mx-auto grid max-w-5xl items-center gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="relative aspect-video overflow-hidden rounded-[2rem] bg-ink shadow-lift">
        {preview?.getVideoTracks().length ? <VideoView stream={preview} muted mirror className="h-full w-full object-cover" />
          : <div className="grid h-full place-items-center text-white/60">{preview ? "Камера выключена — урок пройдёт со звуком" : "Проверяем камеру и микрофон…"}</div>}
      </div>
      <div className="card">
        <h2 className="text-2xl">Готовы начать?</h2>
        <ul className="mt-4 grid gap-3 text-sm text-ink-soft">
          <li className="flex gap-3"><Circle size={16} className="mt-0.5 shrink-0 fill-teach text-teach" />Урок записывается и расшифровывается — так собирается конспект.</li>
          <li className="flex gap-3"><PenLine size={16} className="mt-0.5 shrink-0 text-brand" />Доска, материалы и видео — прямо в уроке, без демонстрации экрана.</li>
          <li className="flex gap-3"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-mint" />После урока конспект, слова и ДЗ появятся в кабинете.</li>
        </ul>
        <ErrorBox error={mediaError || error} />
        <button type="button" className="btn-brand btn-lg mt-6 w-full" disabled={!preview}
          onClick={() => { preview.__joined = true; onJoin(preview); }}>Войти в урок</button>
      </div>
    </div>
  );
}

function Control({ on = true, onClick, label, icon: Icon, offIcon: OffIcon }) {
  const I = on ? Icon : OffIcon || Icon;
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={!on}
      className={`grid h-11 w-11 place-items-center rounded-full transition ${on ? "bg-white text-ink shadow-soft hover:bg-cream" : "bg-teach-soft text-teach-deep"}`}>
      <I size={18} />
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
    else if (res?.moderation?.action === "block") setWarn(`Сообщение скрыто: ${res.moderation.summary}.`);
    else setWarn(res?.moderation?.warning || null);
    setText("");
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={box} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {!messages.length && <p className="text-sm text-ink-mute">Здесь появятся сообщения и расшифровка речи.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`rounded-2xl px-3 py-2 text-sm ${m.source === "speech" ? "bg-cream text-ink-mute" : "bg-brand-tint text-ink"}`}>
            <span className={`mr-1.5 text-xs font-bold ${m.role === "tutor" ? "text-teach" : "text-study"}`}>{m.source === "speech" && "🎙 "}{m.speaker_name}</span>{m.text}
          </div>
        ))}
      </div>
      {warn && <Notice tone="warn" className="mt-2">{warn}</Notice>}
      {canWrite && (
        <form onSubmit={submit} className="mt-2 flex gap-2">
          <input className="field !py-2" placeholder="Сообщение…" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Сообщение в чат урока" />
          <button type="submit" className="btn-brand !px-3" aria-label="Отправить"><Send size={16} /></button>
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
  const [view, setView] = useState("board");
  const [side, setSide] = useState(true);
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
    setLocal(stream); setError(null);
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
    try { await c.join(stream); setPhase((p) => (p === "finished" ? p : "live")); } catch (e) { setError(e); }
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
  const leave = async () => { await client.current?.leave(); window.location.hash = "#/app"; };
  const finish = async () => {
    if (!window.confirm("Завершить урок? Конспект и отчёты уйдут ученику и родителям.")) return;
    setBusy(true);
    try {
      await client.current?.stopRecorder(); // последний фрагмент речи попадёт в отчёт
      setResult(await request("POST", `/site/v1/rooms/${encodeURIComponent(id)}/finish`, {}));
      await client.current?.leave(false);
      setPhase("finished");
    } catch (e) { setError(e); }
    setBusy(false);
  };
  const sendChat = (text) => request("POST", `/site/v1/rooms/${encodeURIComponent(id)}/chat`, { text });
  const tutor = state?.role === "tutor";
  const participant = state && (state.role === "tutor" || state.role === "student");

  if (phase === "finished") {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-3xl">Спасибо за урок!</h1>
        <p className="mt-3 text-ink-soft">Конспект, новые слова, тест и домашнее задание готовятся по записи урока и появятся в кабинете.</p>
        {result?.violations ? <Notice tone="warn" className="mt-5">Нарушений на уроке: {result.violations}.</Notice> : null}
        <div className="mt-6 flex justify-center gap-3"><a className="btn-brand" href={`#/lesson/${id}`}>Материалы урока</a><a className="btn-light" href="#/app">В кабинет</a></div>
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <div className="px-4 py-6 md:px-8">
        <a href="#/app" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-mute hover:text-ink"><ArrowLeft size={14} /> В кабинет</a>
        <Lobby onJoin={join} error={error} />
      </div>
    );
  }

  const peer = state?.peer;
  const connected = peerState === "connected" && remote;
  const remoteTile = (cls) => (
    <div className={`relative overflow-hidden rounded-2xl bg-ink ${cls}`}>
      {connected ? <VideoView stream={remote} className="h-full w-full object-cover" />
        : <div className="grid h-full place-items-center p-3 text-center text-xs text-white/60">{peer?.online ? "Соединяемся…" : `Ждём: ${peer?.name || "собеседник"}`}</div>}
      <span className="absolute bottom-2 left-2 rounded-full bg-ink/60 px-2 py-0.5 text-[11px] font-semibold text-white">{peer?.name}</span>
    </div>
  );
  const localTile = (cls) => (
    <div className={`relative overflow-hidden rounded-2xl bg-ink-soft ${cls}`}>
      {cam && local?.getVideoTracks().length ? <VideoView stream={local} muted mirror={!sharing} className="h-full w-full object-cover" />
        : <div className="grid h-full place-items-center text-xs text-white/60">камера выключена</div>}
      <span className="absolute bottom-2 left-2 rounded-full bg-ink/60 px-2 py-0.5 text-[11px] font-semibold text-white">Вы</span>
    </div>
  );
  return (
    <div className="flex h-[100dvh] flex-col bg-cream">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-white/80 px-3 py-2 backdrop-blur md:px-5">
        <div className="min-w-[120px] flex-1">
          <h1 className="truncate text-lg">{state?.title || "Урок"}</h1>
          <p className="truncate text-xs text-ink-mute">{state?.me} · с вами {peer?.name}</p>
        </div>
        <span className="chip !border-teach/30 !bg-teach-tint !text-teach-deep"><span className="h-2 w-2 animate-pulse rounded-full bg-teach" /><span className="hidden sm:inline">Запись ·</span> <span className="num">{timer}</span></span>
        {rec && <span className="chip hidden sm:inline-flex" title={rec.error || ""}>{rec.blocked ? "⛔ контакты в речи" : rec.ok ? "речь распознаётся" : "речь не распознана"}</span>}
        <div className="inline-flex rounded-full border border-line bg-white p-1">
          {[["board", "Доска", PenLine], ["video", "Видео", Video], ["chat", "Чат", MessageSquare]].map(([k, t, I]) => (
            <button key={k} type="button" onClick={() => setView(k)} className={`items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${k === "chat" ? "flex md:hidden" : "flex"} ${view === k ? "bg-ink text-white" : "text-ink-soft"}`}><I size={14} /><span className="hidden sm:inline">{t}</span></button>
          ))}
        </div>
        <button type="button" className="btn-ghost hidden !p-2 md:inline-flex" onClick={() => setSide(!side)} aria-label={side ? "Скрыть панель" : "Показать панель"}><LayoutPanelLeft size={18} /></button>
      </header>
      {error && <div className="px-4 pt-3"><ErrorBox error={error} /></div>}
      {state && !state.speech_available && tutor && <div className="px-4 pt-3"><Notice tone="warn">Распознавание речи на сервере не установлено: урок записывается, но конспект будет собран только по чату и доске.</Notice></div>}

      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <main className="relative min-w-0 flex-1">
          {view === "chat" ? (
            <div className="card flex h-full flex-col !p-3"><Chat messages={messages} onSend={sendChat} canWrite={participant} /></div>
          ) : view === "board" ? (
            state?.board_id ? (
              <Suspense fallback={<Loading text="Открываем доску…" />}>
                <Board boardId={state.board_id} canClear={tutor} canUpload={tutor} height="100%" />
              </Suspense>
            ) : <Loading text="Доска урока появится через секунду…" />
          ) : (
            <div className="grid h-full place-items-center">
              {remoteTile("aspect-video w-full max-h-full")}
            </div>
          )}
          {view === "video" && <div className="absolute bottom-3 right-3 w-40 md:w-56">{localTile("aspect-video")}</div>}
        </main>
        {side && (
          <aside className="hidden w-[300px] shrink-0 flex-col gap-3 md:flex">
            {view === "board" && <div className="grid grid-cols-2 gap-2">{remoteTile("aspect-[4/3]")}{localTile("aspect-[4/3]")}</div>}
            <div className="card flex min-h-0 flex-1 flex-col !p-3">
              <h2 className="mb-2 flex items-center gap-2 text-sm"><MessageSquare size={14} /> Чат и расшифровка</h2>
              <Chat messages={messages} onSend={sendChat} canWrite={participant} />
            </div>
          </aside>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-line bg-white/80 px-3 py-2.5 backdrop-blur">
        {view === "board" && <div className="mr-auto flex gap-2 md:hidden">{remoteTile("h-12 w-16")}</div>}
        <Control on={mic} onClick={toggleMic} label={mic ? "Выключить микрофон" : "Включить микрофон"} icon={Mic} offIcon={MicOff} />
        <Control on={cam} onClick={toggleCam} label={cam ? "Выключить камеру" : "Включить камеру"} icon={Video} offIcon={VideoOff} />
        {tutor && navigator.mediaDevices?.getDisplayMedia && <Control on={!sharing} onClick={toggleShare} label={sharing ? "Остановить показ экрана" : "Показать экран"} icon={MonitorUp} />}
        <Control onClick={leave} label="Выйти" icon={LogOut} />
        {tutor && (
          <button type="button" disabled={busy} onClick={finish} className="btn ml-1 bg-teach text-white hover:bg-teach-deep">
            <Square size={14} className="fill-current" /> {busy ? "Готовлю отчёты…" : "Завершить урок"}
          </button>
        )}
      </footer>
    </div>
  );
}
