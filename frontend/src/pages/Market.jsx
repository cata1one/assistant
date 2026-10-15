import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, BadgeCheck, CalendarClock, CheckCircle2, Copy, GraduationCap, HandCoins, Lock, Send, ShieldCheck, Sparkles, Target, UserRound, Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import MagneticButton from "../components/MagneticButton.jsx";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal.jsx";
import { ErrorBox, Loading, Notice, PageHead, Segmented } from "../components/ui.jsx";
import { fmtDate, getToken, request } from "../lib/api.js";
import { useCatalog } from "../lib/catalog.js";

// Ключи своих заявок хранятся в браузере ученика: по ним открывается страница с откликами.
const MINE = "school-market-requests";
const loadMine = () => { try { return JSON.parse(localStorage.getItem(MINE) || "[]"); } catch { return []; } };
const saveMine = (list) => { try { localStorage.setItem(MINE, JSON.stringify(list.slice(-20))); } catch { /* нет хранилища */ } };
const ownerLink = (id, key) => `${window.location.origin}/#/market/my?id=${id}&k=${encodeURIComponent(key)}`;

const LEVEL_TONE = { beginner: "from-emerald/40", intermediate: "from-violet/40", advanced: "from-fuchsia-500/40" };

function HowItWorks() {
  const steps = [
    [Target, "Опишите задачу", "Цель, уровень, возраст, какого преподавателя ищете и бюджет. Бесплатно, 2 минуты."],
    [HandCoins, "Получите отклики", "Проверенные преподаватели школы предложат свою цену и подход."],
    [BadgeCheck, "Выберите и начните", "Одна кнопка — и вы в анонимном чате с преподавателем, первый урок пробный."],
  ];
  return (
    <Stagger className="grid gap-4 md:grid-cols-3">
      {steps.map(([Icon, t, d], i) => (
        <StaggerItem key={t}>
          <div className="card card-hover h-full">
            <div className="flex items-center gap-3">
              <span className="num-badge h-9 w-9 text-sm">{i + 1}</span>
              <Icon size={20} className="text-violet-soft" />
            </div>
            <h3 className="mt-4 text-2xl">{t}</h3>
            <p className="mt-2 text-sm">{d}</p>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function Respond({ r, onDone }) {
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await request("POST", `/site/v1/market/${r.id}/proposals`, { message, price: Number(price) });
      onDone();
    } catch (err) { setError(err); }
    setBusy(false);
  };
  return (
    <form onSubmit={send} className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
      <textarea className="field min-h-[90px]" required maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)}
        placeholder="Как будете заниматься, опыт с похожими задачами. Контакты указывать нельзя — общение через платформу." aria-label="Сообщение ученику" />
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative">
          <input className="field num w-40 !pr-12" type="number" min={300} max={20000} step={50} required value={price}
            onChange={(e) => setPrice(e.target.value)} placeholder="Цена" aria-label="Цена за урок, рублей" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">₽/урок</span>
        </label>
        <button type="submit" disabled={busy} className="btn-primary btn-sm"><Send size={14} /> Откликнуться</button>
      </div>
      {error && <ErrorBox error={error} />}
    </form>
  );
}

function RequestCard({ r, canRespond, highlight }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <motion.article layout whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className={`card card-hover relative overflow-hidden ${highlight ? "!border-violet/50" : ""}`}>
      <div aria-hidden="true" className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br ${LEVEL_TONE[r.level]} to-transparent blur-2xl`} />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip chip-accent">{r.language_ru}</span>
          <span className="chip">{r.level_ru} уровень</span>
          <span className="chip">{r.audience === "kid" ? "ребёнок" : "взрослый"}{r.age ? `, ${r.age} лет` : ""}</span>
          {r.course && <span className="chip">{r.course}</span>}
        </div>
        <div className="mt-5 flex items-start justify-between gap-4">
          <h3 className="text-2xl">{r.name}</h3>
          <span className="text-right">
            <span className="stat-num block text-xl">{r.budget_ru}</span>
            <span className="text-xs text-zinc-500">бюджет за урок</span>
          </span>
        </div>
        <p className="mt-3 text-zinc-200"><Target size={14} className="mr-1.5 inline text-emerald-soft" />{r.goals}</p>
        {r.teacher_wishes && <p className="mt-2 text-sm"><UserRound size={14} className="mr-1.5 inline text-violet-soft" />Ищет: {r.teacher_wishes}</p>}
        {r.schedule && <p className="mt-2 text-sm"><CalendarClock size={14} className="mr-1.5 inline" />{r.schedule}</p>}
        {r.comment && <p className="mt-2 text-sm text-zinc-400">{r.comment}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
          <span className="text-xs text-zinc-500">{fmtDate(r.created_at)} · откликов: <span className="num">{r.proposals}</span></span>
          {sent ? <span className="chip !text-emerald-soft"><CheckCircle2 size={13} className="mr-1" /> Отклик отправлен</span>
            : canRespond ? <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(!open)}>{open ? "Свернуть" : "Откликнуться"}</button>
              : null}
        </div>
        <AnimatePresence>
          {open && !sent && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Respond r={r} onDone={() => { setSent(true); setOpen(false); }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

export function Market({ params }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [lang, setLang] = useState("all");
  const [aud, setAud] = useState("all");
  const mine = loadMine();
  useEffect(() => {
    request("GET", "/site/v1/market").then(setData).catch(setError);
    if (getToken()) request("GET", "/site/v1/teacher").then(setTeacher).catch(() => {});
  }, []);
  const canRespond = teacher?.status === "approved";
  const list = (data?.requests || []).filter((r) => (lang === "all" || r.language === lang) && (aud === "all" || r.audience === aud));
  return (
    <>
      <PageHead eyebrow="Биржа учеников" title={<>Найдите <span className="text-aurora italic">своего</span> преподавателя</>}
        text="Опишите задачу и бюджет — проверенные преподаватели школы откликнутся со своей ценой. Бесплатно, без звонков и без передачи контактов.">
        <div className="mt-8 flex flex-wrap gap-3">
          <MagneticButton href="#/market/new" className="!px-7 !py-3.5 text-base">Разместить заявку <ArrowRight size={18} /></MagneticButton>
          {mine.length > 0 && <a href={`#/market/my?id=${mine[mine.length - 1].id}&k=${encodeURIComponent(mine[mine.length - 1].key)}`} className="btn-ghost !py-3.5">Мои заявки и отклики</a>}
        </div>
      </PageHead>

      {data && (
        <Stagger className="glass mb-12 grid grid-cols-3 divide-x divide-white/10 overflow-hidden rounded-[28px]">
          {[[data.open, "открытых заявок"], [data.teachers, "проверенных преподавателей"], ["0 ₽", "для ученика"]].map(([n, t]) => (
            <StaggerItem key={t} className="flex flex-col items-center justify-center px-3 py-7 text-center">
              <span className="stat-num text-3xl md:text-4xl">{n}</span>
              <span className="mt-2 text-xs text-zinc-400 md:text-sm">{t}</span>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <section className="mb-14"><HowItWorks /></section>

      <section className="mb-14 grid gap-4 md:grid-cols-2">
        <Reveal className="card">
          <h3 className="flex items-center gap-3 text-2xl"><GraduationCap className="text-emerald-soft" /> Ученикам</h3>
          <ul className="mt-4 grid gap-2 text-sm">
            {["Размещение бесплатно, первый урок — пробный", "Сравните подход и цену нескольких преподавателей",
              "Все преподаватели проверены школой", "Ваш телефон видит только школа — не преподаватели"].map((x) => (
              <li key={x} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-soft" />{x}</li>))}
          </ul>
        </Reveal>
        <Reveal className="card">
          <h3 className="flex items-center gap-3 text-2xl"><Users className="text-violet-soft" /> Преподавателям</h3>
          <ul className="mt-4 grid gap-2 text-sm">
            {["Ученики с понятной задачей и бюджетом — без поиска и рекламы", "Свою цену назначаете вы",
              "Онлайн-класс, конспекты и отчёты родителям готовятся автоматически",
              `Комиссия школы — ${data?.fee_percent ?? 20}% с оплаченных уроков, без абонентской платы`].map((x) => (
              <li key={x} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-violet-soft" />{x}</li>))}
          </ul>
          {!canRespond && (
            <p className="mt-5 text-sm text-zinc-400">
              {teacher?.status === "pending" ? "Ваша анкета на проверке — школа сообщит в Telegram."
                : <>Чтобы откликаться, отправьте боту школы <b className="text-white">/teacher Имя Фамилия</b>, затем откройте кабинет командой /cabinet.</>}
            </p>
          )}
        </Reveal>
      </section>

      <section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-4xl">Заявки учеников</h2>
          <div className="flex flex-wrap gap-2">
            <Segmented label="Язык" items={[{ id: "all", title: "Все языки" }, { id: "en", title: "Английский" }, { id: "zh", title: "Китайский" }]} value={lang} onChange={setLang} />
            <Segmented label="Кто" items={[{ id: "all", title: "Все" }, { id: "adult", title: "Взрослые" }, { id: "kid", title: "Дети" }]} value={aud} onChange={setAud} />
          </div>
        </div>
        {error && <ErrorBox error={error} />}
        {!data ? <Loading /> : list.length ? (
          <div className="grid gap-4 lg:grid-cols-2">{list.map((r) => <RequestCard key={r.id} r={r} canRespond={canRespond} highlight={params.get("r") === r.id} />)}</div>
        ) : (
          <div className="card flex flex-col items-center py-12 text-center">
            <Sparkles className="text-violet-soft" />
            <h3 className="mt-3 text-2xl">Открытых заявок пока нет</h3>
            <p className="mt-2">Станьте первым — преподаватели увидят заявку сразу.</p>
            <a href="#/market/new" className="btn-primary btn-sm mt-5">Разместить заявку</a>
          </div>
        )}
      </section>
    </>
  );
}

function Choice({ label, value, onChange, options }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium text-zinc-200">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(options).map(([k, v]) => (
          <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k}
            className={`rounded-full border px-4 py-2 text-sm transition-all duration-300 ${value === k ? "border-white bg-white text-obsidian" : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/30"}`}>
            {v}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function MarketNew() {
  const catalog = useCatalog();
  const [meta, setMeta] = useState(null);
  const [f, setF] = useState({ name: "", age: "", audience: "adult", language: "en", course_id: "", level: "", goals: "",
    teacher_wishes: "", comment: "", schedule: "", budget: "", contact: "", consent: false, website: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { request("GET", "/site/v1/market").then(setMeta).catch(setError); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await request("POST", "/site/v1/market", { ...f, age: f.age ? Number(f.age) : null, course_id: f.course_id || null });
      if (res.id) {
        saveMine([...loadMine(), { id: res.id, key: res.key, created: Date.now() }]);
        window.location.hash = `#/market/my?id=${res.id}&k=${encodeURIComponent(res.key)}&new=1`;
      }
    } catch (err) { setError(err); setBusy(false); }
  };
  if (!meta) return <><PageHead title="Новая заявка" /><Loading /></>;
  const courses = catalog.courses.filter((c) => c.language === f.language);
  return (
    <>
      <PageHead eyebrow="Биржа учеников" title="Расскажите о задаче" text="Чем точнее цель, тем точнее предложения. Контакты в описании не нужны — их видит только школа." />
      <Reveal className="card max-w-3xl">
        <form className="grid gap-6" onSubmit={submit} noValidate>
          {error && <ErrorBox error={error} />}
          <div className="grid gap-5 md:grid-cols-[1fr_140px]">
            <label className="label">Имя<input className="field" required maxLength={40} value={f.name} onChange={set("name")} placeholder="Только имя — его увидят преподаватели" /></label>
            <label className="label">Возраст<input className="field num" type="number" min={4} max={99} value={f.age} onChange={set("age")} /></label>
          </div>
          <Choice label="Для кого занятия" value={f.audience} onChange={set("audience")} options={meta.audiences} />
          <Choice label="Язык" value={f.language} onChange={(v) => setF({ ...f, language: v, course_id: "" })} options={meta.languages} />
          <label className="label">Направление (если знаете)
            <select className="field" value={f.course_id} onChange={set("course_id")}>
              <option value="">Не знаю — посоветуйте</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <Choice label="Примерный уровень" value={f.level} onChange={set("level")} options={meta.levels} />
          <label className="label">Цели в изучении
            <textarea className="field min-h-[100px]" required maxLength={800} value={f.goals} onChange={set("goals")}
              placeholder="Например: сдать IELTS на 7.0 к весне, пройти собеседование в IT-компанию, подтянуть школьную программу" />
          </label>
          <label className="label">Какого преподавателя ищете
            <input className="field" maxLength={500} value={f.teacher_wishes} onChange={set("teacher_wishes")}
              placeholder="Опыт подготовки к экзаменам, носитель языка, умеет работать с детьми…" />
          </label>
          <label className="label">Когда удобно заниматься
            <input className="field" maxLength={200} value={f.schedule} onChange={set("schedule")} placeholder="Будни после 19:00, 2 раза в неделю" />
          </label>
          <Choice label="Бюджет за урок" value={f.budget} onChange={set("budget")} options={meta.budgets} />
          <label className="label">Комментарий
            <textarea className="field min-h-[80px]" maxLength={800} value={f.comment} onChange={set("comment")} />
          </label>
          <label className="label">Телефон, Telegram или почта
            <input className="field" required maxLength={120} value={f.contact} onChange={set("contact")} />
            <span className="flex items-center gap-1.5 text-xs font-normal text-zinc-500"><Lock size={12} /> Видит только школа — преподавателям контакт не передаётся.</span>
          </label>
          <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
            <input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />
          </div>
          <label className="flex items-start gap-3 text-sm text-zinc-300">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-violet" checked={f.consent} onChange={set("consent")} />
            Согласен на обработку персональных данных и публикацию заявки без контактов
          </label>
          <div><MagneticButton type="submit" className="!px-8 !py-3.5">{busy ? "Публикуем…" : <>Опубликовать заявку <ArrowRight size={16} /></>}</MagneticButton></div>
        </form>
      </Reveal>
    </>
  );
}

export function MarketMy({ params }) {
  const id = params.get("id");
  const key = params.get("k");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [links, setLinks] = useState(null);
  const [copied, setCopied] = useState(false);
  const hdr = { "X-Request-Key": key || "" };
  const load = () => request("GET", `/site/v1/market/${id}`, undefined, hdr).then((d) => { setData(d); if (d.links) setLinks(d.links); }).catch(setError);
  useEffect(() => {
    if (!id) return undefined;
    load();
    const t = setInterval(load, 15000); // новые отклики появляются без перезагрузки
    return () => clearInterval(t);
  }, [id, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = async (p) => {
    if (!window.confirm(`Выбрать преподавателя «${p.teacher}» за ${p.price} ₽ за урок?`)) return;
    try {
      const r = await request("POST", `/site/v1/market/${id}/choose`, { proposal_id: p.id }, hdr);
      setLinks(r.links); load();
    } catch (err) { setError(err); }
  };
  const close = async () => {
    if (!window.confirm("Снять заявку с биржи?")) return;
    await request("POST", `/site/v1/market/${id}/close`, {}, hdr).catch(setError);
    load();
  };
  const copy = () => { navigator.clipboard?.writeText(ownerLink(id, key)).then(() => setCopied(true)); };

  if (!id) return <PageHead title="Заявка не найдена"><a className="link mt-6 inline-block" href="#/market">На биржу</a></PageHead>;
  if (error) return <><PageHead title="Моя заявка" /><ErrorBox error={error} /></>;
  if (!data) return <><PageHead title="Моя заявка" /><Loading /></>;
  return (
    <>
      <PageHead eyebrow="Моя заявка" title={`${data.name}, ${data.language_ru}`} text={data.goals}>
        {params.get("new") && (
          <div className="mt-6 max-w-2xl"><Notice tone="ok">
            Заявка опубликована! Сохраните эту страницу — здесь появятся отклики преподавателей.
            <button type="button" onClick={copy} className="ml-2 inline-flex items-center gap-1 underline"><Copy size={13} />{copied ? "скопировано" : "скопировать ссылку"}</button>
          </Notice></div>
        )}
      </PageHead>

      {links && (
        <Reveal className="card mb-8 !border-emerald/40">
          <h3 className="flex items-center gap-2 text-2xl"><CheckCircle2 className="text-emerald-soft" /> Преподаватель выбран</h3>
          <p className="mt-2">Подключитесь к анонимному чату с преподавателем в Telegram — там договоритесь о пробном уроке.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {links.student ? <a className="btn-primary" href={links.student} target="_blank" rel="noopener">Открыть чат в Telegram</a>
              : <span className="text-sm">Школа свяжется с вами и пришлёт ссылку.</span>}
            {links.parent && <a className="btn-ghost" href={links.parent} target="_blank" rel="noopener">Ссылка для родителя (отчёты)</a>}
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500"><ShieldCheck size={13} /> Преподаватель не видит ваш номер и аккаунт — всё общение через бота школы.</p>
        </Reveal>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl">Отклики <span className="num text-zinc-500">{data.proposals.length}</span></h2>
        {data.status === "open" && <button type="button" onClick={close} className="btn-ghost btn-sm">Снять заявку</button>}
      </div>
      {!data.proposals.length ? (
        <div className="card py-10 text-center"><p>Откликов пока нет. Обычно первые приходят в течение суток — страница обновится сама.</p></div>
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2">
          {data.proposals.map((p) => (
            <StaggerItem key={p.id}>
              <div className={`card h-full ${p.status === "accepted" ? "!border-emerald/50" : p.status === "declined" ? "opacity-60" : "card-hover"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl">{p.teacher}</h3>
                    {p.specialties && <p className="mt-1 text-sm text-violet-soft">{p.specialties}</p>}
                  </div>
                  <span className="text-right"><span className="stat-num block text-2xl">{p.price.toLocaleString("ru-RU")} ₽</span><span className="text-xs text-zinc-500">за урок</span></span>
                </div>
                {p.bio && <p className="mt-3 text-sm text-zinc-400">{p.bio}</p>}
                <p className="mt-4 rounded-2xl bg-white/[.04] p-4 text-zinc-200">{p.message}</p>
                <div className="mt-5">
                  {data.status === "open" ? <button type="button" className="btn-primary btn-sm" onClick={() => choose(p)}>Выбрать преподавателя</button>
                    : <span className="chip">{p.status === "accepted" ? "выбран" : "не выбран"}</span>}
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}
