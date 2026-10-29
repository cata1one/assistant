import { useEffect, useState } from "react";

// Установка сайта как приложения. Chrome на Android присылает событие beforeinstallprompt один раз,
// поэтому ловим его сразу при загрузке и храним до нажатия кнопки «Установить».
let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener("appinstalled", () => { deferred = null; notify(); });
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
}

/** Открыто ли уже как приложение: установленный ярлык или Android-приложение Bright. */
export const isApp = () => typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches
  || window.navigator.standalone === true || /BrightApp/.test(navigator.userAgent));

export const platform = () => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
};

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((x) => x + 1); listeners.add(f); return () => listeners.delete(f); }, []);
  return {
    canPrompt: Boolean(deferred),
    prompt: async () => {
      if (!deferred) return false;
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null; notify();
      return outcome === "accepted";
    },
  };
}
