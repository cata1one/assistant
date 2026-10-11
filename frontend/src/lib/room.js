// Клиент онлайн-класса: видеосвязь WebRTC, сигналинг через опрос сервера, запись своего микрофона.
import { getToken, request } from "./api.js";

const POLL_MS = 1000;
const CHUNK_MS = 15000; // длина фрагмента записи: столько же, сколько у программы записи для ProgressMe

function pickMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
}

export class RoomClient {
  constructor(lessonId, handlers) {
    this.lessonId = lessonId;
    this.h = handlers; // onState, onMessages, onRemoteStream, onPeer, onRecording, onFinished, onError
    this.sinceSignal = 0;
    this.sinceMessage = 0;
    this.pc = null;
    this.pendingIce = [];
    this.stopped = false;
    this.uploads = [];
    this.uploading = false;
  }

  path(p = "") { return `/site/v1/rooms/${encodeURIComponent(this.lessonId)}${p}`; }

  async join(localStream) {
    this.local = localStream;
    // Первый опрос: узнать роль и пропустить сигналы прошлых подключений
    const st = await request("GET", this.path());
    this.role = st.role;
    this.ice = st.ice_servers;
    this.sinceSignal = st.last_signal;
    this.h.onState?.(st);
    this.handleMessages(st.messages);
    if (st.status !== "active") { this.h.onFinished?.(); return; }
    if (this.role === "tutor" || this.role === "student") {
      await this.send("hello");
      if (this.role === "tutor" && st.peer.online) await this.makeOffer();
      this.startRecorder();
    }
    this.loop();
  }

  send(kind, data) { return request("POST", this.path("/signal"), { kind, data }).catch((e) => this.h.onError?.(e)); }

  async loop() {
    while (!this.stopped) {
      try {
        const st = await request("GET", this.path(`?since_signal=${this.sinceSignal}&since_message=${this.sinceMessage}`));
        this.h.onState?.(st);
        this.handleMessages(st.messages);
        for (const s of st.signals) { this.sinceSignal = Math.max(this.sinceSignal, s.id); await this.onSignal(s); }
        if (st.status !== "active") { this.h.onFinished?.(); this.leave(false); return; }
      } catch (e) {
        this.h.onError?.(e);
        if (e.status === 401 || e.status === 403 || e.status === 404) { this.leave(false); return; }
      }
      await new Promise((r) => setTimeout(r, document.hidden ? 2500 : POLL_MS));
    }
  }

  handleMessages(msgs) {
    if (!msgs?.length) return;
    this.sinceMessage = msgs[msgs.length - 1].id;
    this.h.onMessages?.(msgs);
  }

  // -- WebRTC: преподаватель всегда инициирует соединение ---------------------------------
  newPeer() {
    this.pc?.close();
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    this.pc = pc;
    this.pendingIce = [];
    this.local.getTracks().forEach((t) => pc.addTrack(t, this.local));
    pc.onicecandidate = (e) => e.candidate && this.send("ice", e.candidate.toJSON());
    pc.ontrack = (e) => this.h.onRemoteStream?.(e.streams[0]);
    pc.onconnectionstatechange = () => {
      this.h.onPeer?.(pc.connectionState);
      if (pc.connectionState === "failed" && this.role === "tutor") this.makeOffer(true);
    };
    return pc;
  }

  async makeOffer(iceRestart = false) {
    const pc = this.newPeer();
    const offer = await pc.createOffer({ iceRestart });
    await pc.setLocalDescription(offer);
    await this.send("offer", pc.localDescription.toJSON());
  }

  async onSignal(s) {
    try {
      if (s.kind === "hello" && this.role === "tutor") await this.makeOffer();
      else if (s.kind === "offer" && this.role === "student") {
        const pc = this.newPeer();
        await pc.setRemoteDescription(s.data);
        await this.flushIce();
        await pc.setLocalDescription(await pc.createAnswer());
        await this.send("answer", pc.localDescription.toJSON());
      } else if (s.kind === "answer" && this.pc && this.pc.signalingState === "have-local-offer") {
        await this.pc.setRemoteDescription(s.data);
        await this.flushIce();
      } else if (s.kind === "ice") {
        if (this.pc?.remoteDescription) await this.pc.addIceCandidate(s.data);
        else this.pendingIce.push(s.data);
      } else if (s.kind === "bye") {
        this.pc?.close();
        this.pc = null;
        this.h.onRemoteStream?.(null);
        this.h.onPeer?.("left");
        if (s.data?.finished) this.h.onFinished?.();
      }
    } catch (e) {
      this.h.onError?.(e);
    }
  }

  async flushIce() {
    for (const c of this.pendingIce.splice(0)) await this.pc.addIceCandidate(c).catch(() => {});
  }

  replaceVideo(track) {
    const sender = this.pc?.getSenders().find((x) => x.track?.kind === "video");
    if (sender) sender.replaceTrack(track);
  }

  // -- запись своего микрофона: самостоятельные файлы по 15 секунд ---------------------------
  startRecorder() {
    const audio = this.local.getAudioTracks()[0];
    if (!audio || !window.MediaRecorder) { this.h.onRecording?.({ ok: false, error: "браузер не поддерживает запись" }); return; }
    const stream = new MediaStream([audio]);
    const mime = pickMime();
    this.recording = true;
    const cycle = () => {
      if (!this.recording) return;
      // Новый MediaRecorder на каждый фрагмент: у каждого файла свой заголовок, и сервер расшифрует его отдельно
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
      const parts = [];
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
      rec.onstop = () => {
        if (parts.length) this.enqueue(new Blob(parts, { type: rec.mimeType || mime || "audio/webm" }));
        if (this.recording) cycle();
        else this.flushResolve?.();
      };
      rec.start();
      this.recorder = rec;
      this.recTimer = setTimeout(() => rec.state !== "inactive" && rec.stop(), CHUNK_MS);
    };
    cycle();
  }

  enqueue(blob) {
    this.uploads.push(blob);
    this.drain();
  }

  async drain() {
    if (this.uploading) return;
    this.uploading = true;
    while (this.uploads.length) {
      const blob = this.uploads[0];
      try {
        const r = await fetch(this.path("/audio"), { method: "POST", body: blob, credentials: "same-origin",
          headers: { "Content-Type": blob.type, "X-Access-Token": getToken() || "" } });
        const data = await r.json().catch(() => ({}));
        if (r.status === 409) { this.uploads = []; break; } // урок уже завершён
        if (!r.ok && r.status >= 500) throw new Error(data.error || `ошибка ${r.status}`);
        this.uploads.shift();
        this.h.onRecording?.({ ok: r.ok && data.checked !== false, ...data });
      } catch (e) {
        this.h.onRecording?.({ ok: false, error: `нет связи — фрагмент отправится позже (${e.message})` });
        await new Promise((res) => setTimeout(res, 3000));
        if (this.uploads.length > 40) this.uploads.shift(); // не копить бесконечно
      }
    }
    this.uploading = false;
  }

  // Остановить запись и дождаться отправки последнего фрагмента
  async stopRecorder() {
    this.recording = false;
    clearTimeout(this.recTimer);
    if (this.recorder && this.recorder.state !== "inactive") {
      await new Promise((res) => { this.flushResolve = res; this.recorder.stop(); setTimeout(res, 2000); });
    }
    for (let i = 0; i < 20 && (this.uploads.length || this.uploading); i++) await new Promise((r) => setTimeout(r, 250));
  }

  async leave(sayBye = true) {
    if (this.stopped) return;
    this.stopped = true;
    await this.stopRecorder();
    if (sayBye && (this.role === "tutor" || this.role === "student")) await this.send("bye");
    this.pc?.close();
    this.pc = null;
  }
}
