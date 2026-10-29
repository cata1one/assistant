// Запросы к серверу школы и хранение ссылки-доступа в личный кабинет.
const TOKEN_KEY = "school-access-token";
let memoryToken = null;

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return memoryToken; }
}

export function setToken(t) {
  memoryToken = t;
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* хранилище недоступно */ }
}

export async function request(method, path, body, extra = {}) {
  const headers = { Accept: "application/json", ...extra };
  const token = getToken();
  if (token) headers["X-Access-Token"] = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(path, { method, headers, credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || `ошибка ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return data;
}

export const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso; }
};

/** Отправка файла как есть (тело запроса – сам файл). */
export async function uploadRaw(path, file, extra = {}) {
  const headers = { "Content-Type": file.type || "application/octet-stream", Accept: "application/json",
    "X-File-Name": encodeURIComponent(file.name || "file"), ...extra };
  const token = getToken();
  if (token) headers["X-Access-Token"] = token;
  const r = await fetch(path, { method: "POST", headers, body: file, credentials: "same-origin" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || `ошибка ${r.status}`); e.status = r.status; throw e; }
  return data;
}

/** Русское окончание по числу: plural(5, "слово", "слова", "слов"). */
export const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many);
