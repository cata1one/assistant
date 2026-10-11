import { useEffect, useState } from "react";

// Маршрутизация по хешу (#/courses?cat=…): сервер отдаёт одну страницу, а токен из ссылки не уходит в логи.
export function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const q = raw.indexOf("?");
  const path = q >= 0 ? raw.slice(0, q) : raw;
  return { parts: path.split("/").filter(Boolean), params: new URLSearchParams(q >= 0 ? raw.slice(q + 1) : "") };
}

export function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const replaceHash = (hash) => window.history.replaceState(null, "", hash);
