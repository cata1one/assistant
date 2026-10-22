import { ArrowRight, Building2, GraduationCap, PenTool, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { request } from "../lib/api.js";
import { brandOf, useSession } from "../lib/session.js";
import { ErrorBox, Loading, Notice } from "../ui/kit.jsx";
import Logo from "../ui/Logo.jsx";

const ROLES = [
  { id: "tutor", title: "Преподаватель", text: "Веду уроки сам или в школе", icon: PenTool, brand: "teach" },
  { id: "student", title: "Ученик", text: "Учусь у преподавателя", icon: GraduationCap, brand: "study" },
  { id: "parent", title: "Родитель", text: "Слежу за занятиями ребёнка", icon: Users, brand: "study" },
  { id: "school", title: "Онлайн-школа", text: "Подключаю команду", icon: Building2, brand: "teach" },
];

const INVITE_TEXT = {
  student: (i) => `${i.tutor} приглашает вас на занятия. После регистрации вы окажетесь в одном кабинете.`,
  parent: (i) => `Отчёты об уроках${i.student ? ` ученика ${i.student}` : ""}${i.tutor ? ` у преподавателя ${i.tutor}` : ""} будут приходить сюда.`,
  tutor: (i) => `Школа «${i.school}» приглашает вас преподавать на платформе.`,
};

function useInvite(code) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!code) { setInfo(null); return; }
    request("GET", `/site/v1/invites/${encodeURIComponent(code)}`).then(setInfo).catch(setError);
  }, [code]);
  return { info, error };
}

function Shell({ children, wide, brand = "study" }) {
  return (
    <div className="grid min-h-[80vh] place-items-center pb-16 pt-28">
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="mb-6 flex justify-center"><Logo brand={brand} size={36} /></div>
        <div className="glass rounded-[2rem] p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}

export default function Auth({ route }) {
  const session = useSession();
  const mode = route.parts[0]; // login | register | join
  const code = route.params.get("code") || "";
  const { info, error: inviteError } = useInvite(code);
  const [role, setRole] = useState(route.params.get("role") || "");
  const [f, setF] = useState({ name: "", email: "", password: "", school_name: "", consent: false });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  useEffect(() => { if (info?.role) setRole(info.role); }, [info]);
  const brand = ROLES.find((r) => r.id === role)?.brand || (session.role ? brandOf(session.role) : "study");
  useEffect(() => { document.documentElement.dataset.brand = brand; }, [brand]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const body = mode === "login" ? { email: f.email, password: f.password }
        : { ...f, role, school_name: role === "school" ? f.school_name : undefined };
      if (code) body.invite = code;
      const res = await request("POST", mode === "login" ? "/site/v1/auth/login" : "/site/v1/auth/register", body);
      await session.signIn(res.token);
      window.location.hash = "#/app";
    } catch (err) { setError(err); setBusy(false); }
  };

  const joinNow = async () => {
    setBusy(true); setError(null);
    try {
      setJoined(await request("POST", `/site/v1/invites/${encodeURIComponent(code)}/join`, {}));
      await session.reload();
    } catch (err) { setError(err); }
    setBusy(false);
  };

  // Уже вошли и открыли приглашение — присоединяемся одной кнопкой
  if (mode === "join" && session.account) {
    return (
      <Shell brand={brand}>
        <h1 className="text-2xl">Приглашение</h1>
        {inviteError ? <div className="mt-4"><ErrorBox error={inviteError} /></div> : !info ? <Loading /> : (
          <>
            <p className="mt-3 text-ink-soft">{INVITE_TEXT[info.kind]?.(info)}</p>
            {joined ? (
              <div className="mt-5 grid gap-3"><Notice tone="ok">Готово! Вы подключены.</Notice><a href="#/app" className="btn-brand">В кабинет</a></div>
            ) : (
              <>
                {error && <div className="mt-4"><ErrorBox error={error} /></div>}
                <button type="button" className="btn-brand mt-6 w-full" disabled={busy} onClick={joinNow}>Принять приглашение</button>
                <p className="mt-3 text-center text-sm text-ink-mute">Вы вошли как {session.account.name}. <button type="button" className="link" onClick={session.logout}>Другой аккаунт</button></p>
              </>
            )}
          </>
        )}
      </Shell>
    );
  }

  const login = mode === "login";
  const invited = !!info;
  const q = code ? `?code=${encodeURIComponent(code)}` : "";
  return (
    <Shell wide={!login && !role} brand={brand}>
      <h1 className="text-center text-2xl md:text-3xl">{login ? "Вход" : invited ? "Регистрация по приглашению" : "Регистрация"}</h1>
      {invited && <div className="mt-4"><Notice>{INVITE_TEXT[info.kind]?.(info)}</Notice></div>}
      {inviteError && <div className="mt-4"><ErrorBox error={inviteError} /></div>}
      {code && invited && !login && <p className="mt-3 text-center text-sm text-ink-mute">Уже есть аккаунт? <a className="link" href={`#/login${q}`}>Войдите</a> — приглашение примется само.</p>}

      {!login && !role ? (
        <>
          <p className="mt-2 text-center text-ink-mute">Кто вы?</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {ROLES.map((r) => (
              <button key={r.id} type="button" data-brand={r.brand} onClick={() => setRole(r.id)}
                className="card card-hover flex items-center gap-4 !p-4 text-left">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><r.icon size={20} /></span>
                <span><span className="block font-bold">{r.title}</span><span className="text-sm text-ink-mute">{r.text}</span></span>
              </button>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-ink-mute">Уже есть аккаунт? <a className="link" href={`#/login${q}`}>Войти</a></p>
        </>
      ) : (
        <form onSubmit={submit} className="mt-6 grid gap-4">
          {!login && (
            <div className="flex items-center justify-between rounded-2xl bg-cream px-4 py-2.5 text-sm">
              <span>Вы — <b>{ROLES.find((r) => r.id === role)?.title.toLowerCase()}</b></span>
              {!invited && <button type="button" className="link" onClick={() => setRole("")}>изменить</button>}
            </div>
          )}
          {!login && (
            <label className="label">{role === "school" ? "Ваше имя" : "Имя"}
              <input className="field" required maxLength={60} autoComplete="name" value={f.name} onChange={set("name")}
                placeholder={role === "student" || role === "parent" ? "Другие увидят только имя" : "Ученики увидят только имя"} />
            </label>
          )}
          {role === "school" && !login && (
            <label className="label">Название школы<input className="field" required maxLength={80} value={f.school_name} onChange={set("school_name")} /></label>
          )}
          <label className="label">Почта<input className="field" type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></label>
          <label className="label">Пароль
            <input className="field" type="password" required minLength={login ? 1 : 8} autoComplete={login ? "current-password" : "new-password"}
              value={f.password} onChange={set("password")} placeholder={login ? "" : "Не меньше 8 символов"} />
          </label>
          {!login && (
            <label className="flex items-start gap-3 text-sm text-ink-soft">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]" checked={f.consent} onChange={set("consent")} required />
              Согласен на обработку персональных данных
            </label>
          )}
          {error && <ErrorBox error={error} />}
          <button type="submit" className="btn-brand btn-lg w-full" disabled={busy}>
            {busy ? "Секунду…" : login ? "Войти" : "Создать аккаунт"} {!busy && <ArrowRight size={18} />}
          </button>
          <p className="text-center text-sm text-ink-mute">
            {login ? <>Нет аккаунта? <a className="link" href={`#/register${q}`}>Зарегистрироваться</a></>
              : <>Уже есть аккаунт? <a className="link" href={`#/login${q}`}>Войти</a></>}
          </p>
          {login && <p className="text-center text-xs text-ink-mute">Вход по ссылке из Telegram-бота тоже работает: отправьте боту /cabinet.</p>}
        </form>
      )}
    </Shell>
  );
}
