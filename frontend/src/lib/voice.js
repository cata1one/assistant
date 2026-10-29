// Запись голосового сообщения в браузере: Chrome и Android – webm/opus, iPhone – mp4.
import { getToken } from "./api.js";

export function voiceMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
}

export const canRecord = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

/** Начать запись. Возвращает { stop(): Promise<Blob>, cancel() }. */
export async function startVoice() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const mime = voiceMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
  const parts = [];
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  rec.start(500);
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () => new Promise((resolve) => {
      rec.onstop = () => { release(); resolve(new Blob(parts, { type: (rec.mimeType || mime || "audio/webm").split(";")[0] })); };
      rec.stop();
    }),
    cancel: () => { rec.onstop = release; try { rec.stop(); } catch { release(); } },
  };
}

/** Отправить запись на сервер как есть (тело запроса – звук). */
export async function sendVoice(path, blob) {
  const headers = { "Content-Type": blob.type || "audio/webm", Accept: "application/json" };
  const token = getToken();
  if (token) headers["X-Access-Token"] = token;
  const r = await fetch(path, { method: "POST", headers, body: blob, credentials: "same-origin" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || `ошибка ${r.status}`); e.status = r.status; throw e; }
  return data;
}
