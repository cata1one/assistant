import { Palette } from "lucide-react";
import { useState } from "react";
import { PACKS, stickerById } from "../board/stickers.js";
import { currentHoliday } from "../lib/holidays.js";
import { request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { Avatar, ErrorBox, Notice } from "../ui/kit.jsx";

// Фоны кабинета ученика: мягкие, чтобы текст оставался читаемым
export const THEMES = {
  default: { title: "Обычный", bg: "#FBF8F3" },
  sunset: { title: "Закат", bg: "linear-gradient(160deg,#FFE8D6 0%,#FFD1DC 55%,#FBF8F3 100%)" },
  ocean: { title: "Океан", bg: "linear-gradient(160deg,#D8F0FF 0%,#E3E9FF 60%,#FBF8F3 100%)" },
  forest: { title: "Лес", bg: "linear-gradient(160deg,#DFF5E6 0%,#EEF7D9 60%,#FBF8F3 100%)" },
  lavender: { title: "Лаванда", bg: "linear-gradient(160deg,#ECE6FF 0%,#F7E6FF 60%,#FBF8F3 100%)" },
  candy: { title: "Конфеты", bg: "radial-gradient(circle at 20% 20%,#FFD6E7 0 12%,transparent 13%),radial-gradient(circle at 80% 30%,#D6F0FF 0 10%,transparent 11%),radial-gradient(circle at 60% 80%,#FFF1C2 0 12%,transparent 13%),#FFF7FB" },
  space: { title: "Космос", bg: "radial-gradient(circle at 15% 20%,#fff 0 1px,transparent 2px),radial-gradient(circle at 70% 40%,#fff 0 1px,transparent 2px),radial-gradient(circle at 40% 75%,#fff 0 1.5px,transparent 2.5px),linear-gradient(160deg,#E4E0FF 0%,#D9E8FF 100%)" },
  notebook: { title: "Тетрадь", bg: "linear-gradient(#FBF8F3 23px,#DCE6F7 24px) 0 0/100% 24px,#FBF8F3" },
  // Праздничные
  newyear: { title: "Новый год", bg: "radial-gradient(circle at 12% 18%,#fff 0 2px,transparent 3px),radial-gradient(circle at 42% 8%,#fff 0 3px,transparent 4px),radial-gradient(circle at 78% 22%,#fff 0 2px,transparent 3px),radial-gradient(circle at 60% 60%,#fff 0 2px,transparent 3px),radial-gradient(circle at 25% 75%,#fff 0 3px,transparent 4px),linear-gradient(170deg,#CFE6FF 0%,#E8F1FF 55%,#F7FBFF 100%)" },
  valentine: { title: "Валентин", bg: "radial-gradient(circle at 15% 25%,#FFC2D1 0 9%,transparent 10%),radial-gradient(circle at 85% 15%,#FFD6E0 0 7%,transparent 8%),radial-gradient(circle at 70% 80%,#FFC2D1 0 8%,transparent 9%),#FFF1F4" },
  spring8: { title: "8 Марта", bg: "linear-gradient(160deg,#FFE3F0 0%,#F3E6FF 55%,#FFF7E0 100%)" },
  easter: { title: "Пасха", bg: "linear-gradient(160deg,#FFF6D6 0%,#E4F6DE 50%,#EDE6FF 100%)" },
  summer: { title: "Лето", bg: "linear-gradient(160deg,#FFF3C2 0%,#CDEFFF 60%,#E6FFF1 100%)" },
  autumn: { title: "Осень", bg: "linear-gradient(160deg,#FFE2B8 0%,#FFD0A6 50%,#F7EBD9 100%)" },
  halloween: { title: "Хэллоуин", bg: "radial-gradient(circle at 80% 12%,#FFE9A8 0 6%,transparent 7%),linear-gradient(165deg,#E4DAFF 0%,#FFD9B8 100%)" },
  birthday: { title: "День рождения", bg: "radial-gradient(circle at 10% 20%,#FFB8D1 0 5%,transparent 6%),radial-gradient(circle at 90% 30%,#B8E3FF 0 5%,transparent 6%),radial-gradient(circle at 50% 85%,#FFE08A 0 6%,transparent 7%),radial-gradient(circle at 30% 60%,#C8F2D6 0 4%,transparent 5%),#FFFDF5" },
};

const PICKABLE = Object.keys(PACKS);

export function Sticker({ id, size = 48, className = "" }) {
  const s = stickerById(id);
  if (!s) return null;
  return s.src ? <img src={s.src} alt="" width={size} height={size} className={className} style={{ width: size, height: size, objectFit: "contain" }} />
    : <span className={className} style={{ fontSize: size * 0.8, lineHeight: 1 }}>{s.emoji}</span>;
}

/** Круглый аватар: своя картинка, иначе стикер, иначе буквы имени. */
export function ProfileAvatar({ prefs, photo, name, size = 40 }) {
  const url = photo || (prefs?.photo ? `/site/v1/files/${prefs.photo}` : null);
  if (url) return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  if (prefs?.avatar) return <span className="grid shrink-0 place-items-center rounded-full bg-white shadow-soft" style={{ width: size, height: size }}><Sticker id={prefs.avatar} size={size * 0.75} /></span>;
  return <Avatar name={name} size={size} />;
}

/** Шапка главной ученика: аватар-стикер, девиз и наклейки. */
export function DecorHeader({ prefs, name }) {
  if (!prefs?.avatar && !prefs?.photo && !prefs?.stickers?.length && !prefs?.motto) {
    return <a href="#/app/profile#decor" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-brand"><Palette size={16} /> Украсить свой кабинет</a>;
  }
  return (
    <div className="card mb-5 flex flex-wrap items-center gap-4 !p-5">
      {(prefs.photo || prefs.avatar) && (prefs.photo ? <ProfileAvatar prefs={prefs} name={name} size={72} /> : <Sticker id={prefs.avatar} size={72} className="drop-shadow" />)}
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl font-extrabold">{name}</p>
        {prefs.motto && <p className="text-ink-soft">{prefs.motto}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">{(prefs.stickers || []).map((id, i) => <Sticker key={i} id={id} size={40} className={i % 2 ? "rotate-6" : "-rotate-6"} />)}</div>
      <a href="#/app/profile#decor" className="btn-ghost btn-sm" aria-label="Изменить оформление"><Palette size={15} /></a>
    </div>
  );
}

/** Настройки оформления в профиле. */
export function DecorSettings() {
  const session = useSession();
  const prefs = session.account?.prefs || {};
  const [f, setF] = useState({ theme: prefs.theme || "default", avatar: prefs.avatar || "", stickers: prefs.stickers || [], motto: prefs.motto || "" });
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [pack, setPack] = useState(() => currentHoliday()?.pack || "Животные");
  const [mode, setMode] = useState("avatar");
  const toggle = (id) => setF({ ...f, stickers: f.stickers.includes(id) ? f.stickers.filter((x) => x !== id) : [...f.stickers, id].slice(0, 8) });
  const save = async () => {
    setError(null);
    try { await request("POST", "/site/v1/account/prefs", f); setMsg("Сохранено. Загляните на главную"); session.reload(); } catch (x) { setError(x); }
  };
  return (
    <div id="decor" className="card grid gap-4">
      <h2 className="flex items-center gap-2 text-lg"><Palette size={18} className="text-brand" /> Оформление кабинета</h2>
      <div>
        <p className="mb-2 text-sm font-semibold">Фон</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(THEMES).map(([id, t]) => (
            <button key={id} type="button" onClick={() => setF({ ...f, theme: id })} aria-pressed={f.theme === id} title={t.title}
              className={`h-14 w-20 rounded-2xl border-2 text-[11px] font-bold text-ink-soft transition ${f.theme === id ? "border-brand" : "border-line"}`} style={{ background: t.bg }}>{t.title}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">Выбираю:</p>
          {[["avatar", "Аватар"], ["stickers", "Наклейки на главную (до 8)"]].map(([m, t]) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={`chip !text-sm ${mode === m ? "chip-brand" : ""}`}>{t}</button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap gap-1">
          {PICKABLE.map((p) => (
            <button key={p} type="button" onClick={() => setPack(p)} className={`chip ${pack === p ? "chip-brand" : ""}`}>{p}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(PACKS[pack] || []).map((x) => (
            <button key={x.id} type="button" onClick={() => (mode === "avatar" ? setF({ ...f, avatar: x.id }) : toggle(x.id))} aria-label="Стикер"
              className={`relative grid h-14 w-14 place-items-center rounded-2xl border-2 bg-white ${f.stickers.includes(x.id) ? "border-brand" : "border-line"} ${f.avatar === x.id ? "ring-4 ring-sun" : ""}`}>
              {x.src ? <img src={x.src} alt="" className="h-10 w-10 object-contain" /> : <span className="text-3xl leading-none">{x.emoji}</span>}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-mute">Аватар:</span>{f.avatar ? <Sticker id={f.avatar} size={32} /> : "–"}
          {f.stickers.length > 0 && <><span className="ml-3 text-ink-mute">Наклейки:</span>{f.stickers.map((id) => <Sticker key={id} id={id} size={28} />)}</>}
          {(f.avatar || f.stickers.length > 0) && <button type="button" className="link" onClick={() => setF({ ...f, avatar: "", stickers: [] })}>сбросить</button>}
        </div>
      </div>
      <label className="label">Девиз или цель<input className="field" maxLength={80} value={f.motto} onChange={(e) => setF({ ...f, motto: e.target.value })} placeholder="Например: «Сдам IELTS на 7.0!»" /></label>
      {msg && <Notice tone="ok">{msg}</Notice>}
      <ErrorBox error={error} />
      <button type="button" className="btn-brand w-fit" onClick={save}>Сохранить оформление</button>
    </div>
  );
}
