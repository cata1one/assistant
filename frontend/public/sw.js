// Bright: service worker приложения. Страница всегда берётся из сети (чтобы обновления приходили сразу),
// а без сети показывается последняя сохранённая. Файлы сборки с хешем в имени кэшируются навсегда.
// Запросы к API (/site/) не кэшируются никогда.
const CACHE = "bright-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/site/") || url.pathname === "/bright.apk") return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("/", copy)); }
      return res;
    }).catch(() => caches.match("/")));
    return;
  }
  if (url.pathname.startsWith("/static/")) {
    // Файлы с хешем в имени не меняются: берём из кэша. Остальные (app.js, app.css, картинки) – из сети,
    // а из кэша только без интернета, иначе после обновления сайта старый app.js искал бы удалённые куски.
    const hashed = /-[\w-]{8}\.js$/.test(url.pathname) || url.pathname.endsWith(".woff2");
    const save = (res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    };
    e.respondWith(hashed
      ? caches.match(req).then((hit) => hit || fetch(req).then(save))
      : fetch(req).then(save).catch(() => caches.match(req)));
  }
});
