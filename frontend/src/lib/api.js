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

export async function request(method, path, body) {
  const headers = { Accept: "application/json" };
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
