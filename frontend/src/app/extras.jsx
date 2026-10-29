import { Camera, PartyPopper, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { request, uploadRaw } from "../lib/api.js";
import { currentHoliday } from "../lib/holidays.js";
import { useSession } from "../lib/session.js";
import { ErrorBox, Notice } from "../ui/kit.jsx";
import { ProfileAvatar, Sticker } from "./decor.jsx";

// == Социальная батарейка ==========================================================================
const BATTERY = [
  [1, "Села", "🪫", "bg-teach-soft text-teach-deep"],
  [2, "Мало сил", "🔋", "bg-sun-soft text-[#7a5300]"],
  [3, "Нормально", "🔋", "bg-cream text-ink-soft"],
  [4, "Хорошо", "🔋", "bg-mint-soft text-[#146b4c]"],
  [5, "Полный заряд", "⚡", "bg-study-soft text-study-deep"],
];

/** Необязательная отметка заряда. Не отметили, значит ничего не показывается ни ученику, ни преподавателю. */
export function MoodCard() {
  const session = useSession();
  const today = session.account?.mood?.today ?? null;
  const priv = !!session.account?.prefs?.mood_private;
  const [error, setError] = useState(null);
  const set = async (level) => {
    setError(null);
    try { await request("POST", "/site/v1/account/mood", { level }); session.reload(); } catch (x) { setError(x); }
  };
  const togglePrivate = async () => {
    try { await request("POST", "/site/v1/account/prefs", { mood_private: !priv }); session.reload(); } catch (x) { setError(x); }
  };
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-normal">Как заряд сегодня?</h2>
        <span className="text-xs text-ink-mute">По желанию</span>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {BATTERY.map(([level, title, icon, tone]) => (
          <button key={level} type="button" onClick={() => set(today === level ? null : level)} aria-pressed={today === level} aria-label={title}
            className={`grid place-items-center gap-0.5 rounded-2xl border-2 px-1 py-2 text-xs font-semibold transition ${today === level ? "border-brand " + tone : "border-transparent bg-cream text-ink-mute hover:bg-white"}`}>
            <span className="text-xl leading-none" style={{ opacity: 0.35 + level * 0.13 }}>{icon}</span>
            <span className="hidden sm:block">{title}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-mute">
        {priv ? "Отметка видна только вам." : "Если отметите, преподаватель увидит это и подстроит урок."}{" "}
        <button type="button" className="link" onClick={togglePrivate}>{priv ? "Показывать преподавателю" : "Скрыть от преподавателя"}</button>
      </p>
      <ErrorBox error={error} />
    </div>
  );
}

export const MoodChip = ({ mood }) => {
  if (!mood) return null;
  const [, title, icon, tone] = BATTERY[mood.level - 1];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`} title="Заряд ученика, он отметил сам"><span style={{ opacity: 0.35 + mood.level * 0.13 }}>{icon}</span>{title}</span>;
};

// == Праздничный баннер =============================================================================
export function HolidayBanner({ student }) {
  const session = useSession();
  const h = currentHoliday();
  const key = h ? `bright-holiday-${h.id}` : "";
  const [hidden, setHidden] = useState(() => { try { return !!localStorage.getItem(key); } catch { return false; } });
  const [error, setError] = useState(null);
  if (!h || hidden) return null;
  const close = () => { setHidden(true); try { localStorage.setItem(key, "1"); } catch { /* нет хранилища */ } };
  const dress = async () => {
    try { await request("POST", "/site/v1/account/prefs", { theme: h.theme }); session.reload(); close(); } catch (x) { setError(x); }
  };
  const sticker = { newyear: "ny-tree", christmas: "ch-bell", valentine: "vd-rose", feb23: "f23-star", mar8: "m8-bouquet", maslenitsa: "ms-pancakes",
    easter: "ea-egg", knowledge: "kn-bell", teacher: "sc-apple", halloween: "hw-pumpkin", cny: "cny-lantern" }[h.id.split("-")[0]];
  return (
    <div className="panel relative mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 !border-sun !bg-sun-soft p-4 pr-12">
      {sticker ? <Sticker id={sticker} size={48} /> : <PartyPopper size={30} />}
      <div className="min-w-[180px] flex-1">
        <p className="text-[17px] font-semibold">{h.title}</p>
        <p className="text-sm text-ink-soft">{student ? h.text : `Праздничные стикеры «${h.pack}» уже на доске: нажмите «Стикеры».`}</p>
      </div>
      {student && <button type="button" className="btn-brand btn-sm" onClick={dress}>Нарядить кабинет</button>}
      <button type="button" className="btn-ghost absolute right-2 top-2 !h-8 !w-8 !p-0" onClick={close} aria-label="Скрыть"><X size={16} /></button>
      {error && <div className="w-full"><ErrorBox error={error} /></div>}
    </div>
  );
}

// == Своя картинка профиля ============================================================================
/** Браузер обрезает картинку по центру до квадрата и уменьшает: на сервер уходит лёгкий файл. */
async function squareJpeg(file, side = 360) {
  const bitmap = await createImageBitmap(file);
  const s = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = side;
  canvas.getContext("2d").drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, side, side);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("не удалось обработать картинку"))), "image/jpeg", 0.86));
}

export function PhotoSettings() {
  const session = useSession();
  const acc = session.account;
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const blob = await squareJpeg(file);
      await uploadRaw("/site/v1/account/photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      await session.reload();
    } catch (x) { setError(x); }
    setBusy(false);
  };
  const remove = async () => {
    try { await request("POST", "/site/v1/account/prefs", { photo: null }); await session.reload(); } catch (x) { setError(x); }
  };
  return (
    <div className="panel flex flex-wrap items-center gap-4 p-5">
      <ProfileAvatar prefs={acc?.prefs} name={acc?.name} size={72} />
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold tracking-normal">Моя картинка</h2>
        <p className="text-sm text-ink-mute">Любое фото или рисунок. Обрежем по центру в круг. Видна вам и вашему преподавателю или ученикам.</p>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pick} />
      <button type="button" className="btn-light" disabled={busy} onClick={() => input.current?.click()}><Camera size={16} /> {busy ? "Загружаем…" : acc?.prefs?.photo ? "Заменить" : "Загрузить"}</button>
      {acc?.prefs?.photo && <button type="button" className="btn-ghost !p-2" onClick={remove} aria-label="Убрать картинку"><Trash2 size={16} /></button>}
      {error && <div className="w-full"><ErrorBox error={error} /></div>}
    </div>
  );
}

// == Настройки конспекта (преподаватель) =================================================================
export function ReviewSetting() {
  const session = useSession();
  const on = !!session.account?.prefs?.review_reports;
  const [error, setError] = useState(null);
  const toggle = async () => {
    try { await request("POST", "/site/v1/account/prefs", { review_reports: !on }); session.reload(); } catch (x) { setError(x); }
  };
  return (
    <div className="panel p-5">
      <h2 className="text-[15px] font-semibold tracking-normal">Конспект после урока</h2>
      <label className="mt-3 flex items-start gap-3 text-sm text-ink-soft">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]" checked={on} onChange={toggle} />
        <span>Проверять конспект перед отправкой. Ученик и родители получат его, только когда вы нажмёте «Отправить». Пока он у вас, слова не попадают в карточки ученика.</span>
      </label>
      {on && <Notice className="mt-3">После урока откройте его в разделе «Уроки», поправьте текст и нажмите «Отправить ученику».</Notice>}
      <ErrorBox error={error} />
    </div>
  );
}
