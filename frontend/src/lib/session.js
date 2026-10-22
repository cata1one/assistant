import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getToken, request, setToken } from "./api.js";

// Сессия: аккаунт сайта (почта и пароль) или старый вход по ссылке из Telegram-бота.
export const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);

export const brandOf = (role) => (role === "tutor" || role === "school" || role === "admin" ? "teach" : "study");

function legacyRole(me) {
  if (me.admin) return "admin";
  const roles = new Set(me.chats.map((c) => c.role));
  if (roles.has("tutor")) return "tutor";
  if (roles.has("student")) return "student";
  if (roles.has("parent")) return "parent";
  return "student";
}

export function useSessionState() {
  const [state, setState] = useState({ loading: !!getToken(), account: null, me: null, role: null });
  const load = useCallback(async () => {
    if (!getToken()) { setState({ loading: false, account: null, me: null, role: null }); return; }
    try {
      const [acc, me] = await Promise.all([
        request("GET", "/site/v1/account").catch((e) => (e.status === 403 ? null : Promise.reject(e))),
        request("GET", "/site/v1/me"),
      ]);
      const account = acc?.account || null;
      setState({ loading: false, account, plans: acc?.plans, me, role: account ? account.role : legacyRole(me) });
    } catch (e) {
      if (e.status === 401) setToken(null);
      setState({ loading: false, account: null, me: null, role: null, error: e.status === 401 ? null : e });
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const logout = useCallback(async () => {
    await request("POST", "/site/v1/logout", {}).catch(() => {});
    setToken(null);
    setState({ loading: false, account: null, me: null, role: null });
  }, []);
  const signIn = useCallback(async (token) => { setToken(token); await load(); }, [load]);
  return { ...state, reload: load, logout, signIn };
}
