import { useEffect, useRef, useState } from "react";
import { request } from "../lib/api.js";
import { LANGS, langById } from "../lib/langs.js";
import { ErrorBox } from "../ui/kit.jsx";

const englishPrompts = [
  "Describe a place you would like to visit and explain why.",
  "What skill would you like to learn? Ask someone a follow-up question.",
  "Two truths and a lie: say three things about yourself. Let others guess.",
  "Choose an object in your room and describe it without naming it.",
];
const promptsByLanguage = {
  en: englishPrompts,
  zh: ["介绍一个你喜欢的地方。", "你想学习什么新技能？为什么？", "描述一件东西，让大家猜一猜。"],
  es: ["Describe un lugar que te gusta.", "¿Qué habilidad nueva te gustaría aprender y por qué?", "Describe un objeto sin decir su nombre."],
  fr: ["Décrivez un endroit que vous aimez.", "Quelle nouvelle compétence aimeriez-vous apprendre et pourquoi ?", "Décrivez un objet sans dire son nom."],
  it: ["Descrivi un posto che ti piace.", "Quale nuova abilità vorresti imparare e perché?", "Descrivi un oggetto senza dire il suo nome."],
  pt: ["Descreva um lugar de que você gosta.", "Que habilidade nova você gostaria de aprender e por quê?", "Descreva um objeto sem dizer o nome."],
  ar: ["صِف مكاناً تحبه.", "ما المهارة الجديدة التي تريد تعلمها ولماذا؟", "صِف شيئاً دون أن تذكر اسمه."],
  sr: ["Опиши место које волиш.", "Коју нову вештину желиш да научиш и зашто?", "Опиши предмет без његовог имена."],
  hi: ["अपनी पसंद की किसी जगह का वर्णन करें।", "आप कौन सा नया कौशल सीखना चाहते हैं और क्यों?", "किसी वस्तु का नाम लिए बिना उसका वर्णन करें।"],
  el: ["Περιγράψτε ένα μέρος που σας αρέσει.", "Ποια νέα δεξιότητα θέλετε να μάθετε και γιατί;", "Περιγράψτε ένα αντικείμενο χωρίς να πείτε το όνομά του."],
};


function Video({ stream, muted = false, name }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <div className="overflow-hidden rounded-xl bg-ink"><video ref={ref} autoPlay playsInline muted={muted} className="aspect-video w-full object-cover" /><p className="p-2 text-sm text-white">{name}</p></div>;
}

function LiveRoom({ id, onExit }) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [local, setLocal] = useState(null);
  const [remote, setRemote] = useState({});
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  useEffect(() => {
    let alive = true, timer, stream, cursor = 0, polling = false;
    const peers = new Map();
    const api = `/site/v1/practice/${id}`;
    const send = (to, kind, data) => request("POST", api + "/signal", { to, kind, data });
    const peer = (pid, ice) => {
      if (peers.has(pid)) return peers.get(pid);
      const pc = new RTCPeerConnection({ iceServers: ice });
      const entry = { pc, pending: [] };
      peers.set(pid, entry);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.onicecandidate = (e) => { if (e.candidate) send(pid, "ice", e.candidate.toJSON()).catch(setError); };
      pc.ontrack = (e) => { if (alive && e.streams[0]) setRemote((old) => ({ ...old, [pid]: e.streams[0] })); };
      return entry;
    };
    const tick = async () => {
      if (!alive || polling) return;
      polling = true;
      try {
        const s = await request("GET", api + `?since=${cursor}`);
        if (!alive) return;
        setRoom(s);
        const present = new Set(s.peers.map((p) => p.id));
        for (const [pid, entry] of peers) if (!present.has(pid)) {
          entry.pc.close(); peers.delete(pid);
          setRemote((old) => { const next = { ...old }; delete next[pid]; return next; });
        }
        for (const p of s.peers) if (p.id !== s.me && !peers.has(p.id) && s.me < p.id) {
          const entry = peer(p.id, s.ice_servers);
          await entry.pc.setLocalDescription(await entry.pc.createOffer());
          await send(p.id, "offer", entry.pc.localDescription.toJSON());
        }
        for (const sig of s.signals) {
          cursor = Math.max(cursor, sig.id);
          if (!present.has(sig.from)) continue;
          const entry = peer(sig.from, s.ice_servers), pc = entry.pc;
          if (sig.kind === "offer") {
            await pc.setRemoteDescription(sig.data);
            for (const candidate of entry.pending.splice(0)) await pc.addIceCandidate(candidate);
            await pc.setLocalDescription(await pc.createAnswer());
            await send(sig.from, "answer", pc.localDescription.toJSON());
          } else if (sig.kind === "answer") {
            await pc.setRemoteDescription(sig.data);
            for (const candidate of entry.pending.splice(0)) await pc.addIceCandidate(candidate);
          } else if (sig.kind === "ice") {
            if (pc.remoteDescription) await pc.addIceCandidate(sig.data); else entry.pending.push(sig.data);
          }
        }
      } catch (e) { if (alive) setError(e); }
      finally { polling = false; }
    };
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        setLocal(stream);
        await request("POST", api + "/join", {});
        if (!alive) { request("POST", api + "/leave", {}).catch(() => {}); return; }
        await tick();
        timer = setInterval(tick, 1500);
      } catch (e) { if (alive) setError(e); }
    })();
    return () => {
      alive = false; clearInterval(timer);
      for (const entry of peers.values()) entry.pc.close();
      stream?.getTracks().forEach((track) => track.stop());
      request("POST", api + "/leave", {}).catch(() => {});
    };
  }, [id]);
  return <div className="grid gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1>{room?.title || "Комната"}</h1><p className="text-ink-mute">{room?.topic}</p></div><button className="btn-light" onClick={onExit}>Выйти</button></div>
    <ErrorBox error={error} />
    {room && <p className="text-sm text-ink-soft">В комнате: {room.peers.map((p) => p.name).join(", ")} · {langById(room.language).flag} {langById(room.language).title}</p>}
    {local && <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-light btn-sm" aria-pressed={audioOn} onClick={() => { const next = !audioOn; local.getAudioTracks().forEach((track) => { track.enabled = next; }); setAudioOn(next); }}>{audioOn ? "Выключить микрофон" : "Включить микрофон"}</button>
      <button type="button" className="btn-light btn-sm" aria-pressed={videoOn} onClick={() => { const next = !videoOn; local.getVideoTracks().forEach((track) => { track.enabled = next; }); setVideoOn(next); }}>{videoOn ? "Выключить камеру" : "Включить камеру"}</button>
    </div>}
    <div className="grid gap-3 sm:grid-cols-2">{local && <Video stream={local} name="Вы" muted />}{Object.entries(remote).map(([pid, stream]) => <Video key={pid} stream={stream} name={room?.peers.find((p) => p.id === pid)?.name || "Участник"} />)}</div>
    <div className="card"><p className="font-semibold">Игра для разговора</p><p className="my-3">{(promptsByLanguage[room?.language] || englishPrompts)[(room?.prompt || 0) % (promptsByLanguage[room?.language] || englishPrompts).length]}</p><button className="btn-light btn-sm" onClick={() => request("POST", `/site/v1/practice/${id}/prompt`, {}).catch(setError)}>Другая тема</button></div>
  </div>;
}

export default function PracticePage() {
  const [filters, setFilters] = useState({ q: "", language: "", level: "" });
  const [form, setForm] = useState({ title: "", topic: "", language: "en", level: "any" });
  const [rooms, setRooms] = useState([]);
  const [active, setActive] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (active) return undefined;
    let alive = true;
    const load = () => request("GET", "/site/v1/practice?" + new URLSearchParams(filters)).then((data) => { if (alive) setRooms(data.rooms); }).catch((e) => { if (alive) setError(e); });
    load(); const timer = setInterval(load, 8000);
    return () => { alive = false; clearInterval(timer); };
  }, [active, filters]);
  const create = async (event) => {
    event.preventDefault(); setError(null);
    try { const result = await request("POST", "/site/v1/practice", form); setActive(result.id); setCreating(false); }
    catch (e) { setError(e); }
  };
  if (active) return <LiveRoom id={active} onExit={() => setActive(null)} />;
  return <div className="grid gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1>Разговорные комнаты</h1><p className="text-ink-mute">Найдите собеседников по языку, уровню и теме.</p></div><button className="btn-brand" onClick={() => setCreating(!creating)}>Создать комнату</button></div>
    <ErrorBox error={error} />
    {creating && <form className="card grid gap-3" onSubmit={create}>
      <label className="label">Название<input className="field" required maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
      <label className="label">Тема разговора<input className="field" maxLength={160} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></label>
      <select className="field" aria-label="Язык" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.flag} {l.title}</option>)}</select>
      <select className="field" aria-label="Уровень" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{["any","A1","A2","B1","B2","C1","C2"].map((l) => <option key={l} value={l}>{l === "any" ? "Любой уровень" : l}</option>)}</select>
      <button className="btn-brand w-fit">Создать и войти</button>
    </form>}
    <div className="grid gap-2 sm:grid-cols-3">
      <input className="field" placeholder="Название или тема" aria-label="Поиск" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
      <select className="field" aria-label="Язык" value={filters.language} onChange={(e) => setFilters({ ...filters, language: e.target.value })}><option value="">Все языки</option>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.flag} {l.title}</option>)}</select>
      <select className="field" aria-label="Уровень" value={filters.level} onChange={(e) => setFilters({ ...filters, level: e.target.value })}><option value="">Все уровни</option>{["any","A1","A2","B1","B2","C1","C2"].map((l) => <option key={l} value={l}>{l === "any" ? "Любой уровень" : l}</option>)}</select>
    </div>
    {!rooms.length && <p className="text-ink-mute">Комнат пока нет. Создайте первую.</p>}
    <div className="grid gap-3 sm:grid-cols-2">{rooms.map((r) => <div className="card" key={r.id}><p className="text-lg font-semibold">{r.title}</p><p className="text-sm text-ink-mute">{langById(r.language).flag} {langById(r.language).title} · {r.level === "any" ? "Любой уровень" : r.level} · {r.count}/{r.capacity}</p><p className="my-3">{r.topic}</p><button className="btn-light btn-sm" disabled={r.count >= r.capacity} onClick={() => setActive(r.id)}>Войти</button></div>)}</div>
  </div>;
}
