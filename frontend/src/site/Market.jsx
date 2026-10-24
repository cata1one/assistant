import {
  ArrowRight, CalendarClock, CheckCircle2, Copy, HandCoins, Lock, Search, Send, ShieldCheck, Sparkles, Target, UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fmtDate, request } from "../lib/api.js";
import { LANGS } from "../lib/langs.js";
import { useSession } from "../lib/session.js";
import { copy, Empty, ErrorBox, Loading, Notice, Tabs } from "../ui/kit.jsx";

// Ключи своих заявок хранятся в браузере: по ним открывается страница с откликами.
const MINE = "school-market-requests";
const loadMine = () => { try { return JSON.parse(localStorage.getItem(MINE) || "[]"); } catch { return []; } };
const saveMine = (list) => { try { localStorage.setItem(MINE, JSON.stringify(list.slice(-20))); } catch { /* нет хранилища */ } };
const myHref = (id, key) => `#/market/my?id=${id}&k=${encodeURIComponent(key)}`;

function Head({ eyebrow, title, text, children }) {
  return (
    <section className="pb-10 pt-28 md:pt-36">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="mt-2 max-w-3xl text-[clamp(2.1rem,5vw,3.6rem)]">{title}</h1>
      {text && <p className="mt-4 max-w-2xl text-lg text-ink-soft">{text}</p>}
      {children}
    </section>
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
    <form onSubmit={send} className="mt-4 grid gap-3 rounded-2xl bg-cream p-4">
      <textarea className="field min-h-[90px]" required maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)}
        placeholder="Как будете заниматься, опыт с похожими задачами. Без контактов – общение через платформу." aria-label="Сообщение ученику" />
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative">
          <input className="field num w-40 !pr-14" type="number" min={300} max={20000} step={50} required value={price}
            onChange={(e) => setPrice(e.target.value)} placeholder="Цена" aria-label="Цена за урок, рублей" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-mute">₽/урок</span>
        </label>
        <button type="submit" disabled={busy} className="btn-brand btn-sm"><Send size={14} /> Откликнуться</button>
      </div>
      <ErrorBox error={error} />
    </form>
  );
}

function RequestCard({ r, canRespond, highlight }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <article className={`card ${highlight ? "border-brand" : ""}`}>
      <div className="flex flex-wrap gap-2">
        <span className="chip chip-brand">{r.language_ru}</span>
        <span className="chip">{r.level_ru} уровень</span>
        <span className="chip">{r.audience === "kid" ? "ребёнок" : "взрослый"}{r.age ? `, ${r.age} лет` : ""}</span>
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <h3 className="text-xl">{r.name}</h3>
        <span className="text-right"><span className="num block font-display text-lg font-extrabold">{r.budget_ru}</span><span className="text-xs text-ink-mute">за урок</span></span>
      </div>
      <p className="mt-2 text-ink-soft"><Target size={14} className="mr-1.5 inline text-brand" />{r.goals}</p>
      {r.teacher_wishes && <p className="mt-1.5 text-sm text-ink-soft"><UserRound size={14} className="mr-1.5 inline" />Ищет: {r.teacher_wishes}</p>}
      {r.schedule && <p className="mt-1.5 text-sm text-ink-soft"><CalendarClock size={14} className="mr-1.5 inline" />{r.schedule}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <span className="text-xs text-ink-mute">{fmtDate(r.created_at)} · откликов: <span className="num">{r.proposals}</span></span>
        {sent ? <span className="chip !text-[#146b4c]"><CheckCircle2 size={13} /> Отклик отправлен</span>
          : canRespond ? <button type="button" className="btn-brand btn-sm" onClick={() => setOpen(!open)}>{open ? "Свернуть" : "Откликнуться"}</button> : null}
      </div>
      {open && !sent && <Respond r={r} onDone={() => { setSent(true); setOpen(false); }} />}
    </article>
  );
}

function Board({ params, canRespond, tutor }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lang, setLang] = useState("all");
  const [aud, setAud] = useState("all");
  useEffect(() => { request("GET", "/site/v1/market").then(setData).catch(setError); }, []);
  const list = (data?.requests || []).filter((r) => (lang === "all" || r.language === lang) && (aud === "all" || r.audience === aud));
  return (
    <section className="pb-16">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-3xl">Заявки учеников {data && <span className="num text-ink-mute">{data.open}</span>}</h2>
        <div className="flex flex-wrap gap-2">
          <select className="field !w-auto !rounded-full !py-2 text-sm" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Язык">
            <option value="all">Все языки</option>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.flag} {l.title}</option>)}
          </select>
          <Tabs label="Кто" items={[{ id: "all", title: "Все" }, { id: "adult", title: "Взрослые" }, { id: "kid", title: "Дети" }]} value={aud} onChange={setAud} />
        </div>
      </div>
      {!canRespond && tutor !== false && (
        <Notice className="mb-5">Откликаться могут преподаватели. <a className="link" href="#/register?role=tutor">Зарегистрируйтесь</a> или <a className="link" href="#/login">войдите</a> – это бесплатно.</Notice>
      )}
      <ErrorBox error={error} />
      {!data ? <Loading /> : list.length ? (
        <div className="grid gap-4 lg:grid-cols-2">{list.map((r) => <RequestCard key={r.id} r={r} canRespond={canRespond} highlight={params.get("r") === r.id} />)}</div>
      ) : <Empty icon={Sparkles} title="Открытых заявок пока нет" text="Новые заявки появляются здесь сразу после публикации." />}
    </section>
  );
}

export function MarketHome({ params }) {
  const session = useSession();
  const isTutor = session?.role === "tutor";
  const [tab, setTab] = useState(isTutor || params.get("tab") === "students" ? "students" : "teacher");
  useEffect(() => { if (isTutor) setTab("students"); }, [isTutor]);
  const mine = loadMine();
  const last = mine[mine.length - 1];
  return (
    <>
      <Head eyebrow="Поиск" title={tab === "students" ? <>Найдите <span className="text-brand">учеников</span></> : <>Найдите <span className="text-brand">своего</span> преподавателя</>}
        text={tab === "students" ? "Ученики описывают задачу и бюджет – вы откликаетесь со своей ценой. Без комиссии за поиск и без рекламы."
          : "Опишите цель и бюджет – преподаватели предложат свою цену и подход. Бесплатно, а ваш телефон преподаватели не видят."}>
        <div className="mt-6"><Tabs label="Кого ищу" value={tab} onChange={setTab}
          items={[{ id: "teacher", title: "Ищу преподавателя" }, { id: "students", title: "Ищу учеников" }]} /></div>
      </Head>
      {tab === "teacher" ? (
        <section className="pb-16">
          <div className="grid gap-4 md:grid-cols-3">
            {[[Target, "Опишите задачу", "Цель, уровень, возраст, расписание и бюджет. Две минуты."],
              [HandCoins, "Получите отклики", "Преподаватели предложат цену и расскажут, как будут заниматься."],
              [CheckCircle2, "Выберите", "Одна кнопка – и вы в общем кабинете: урок, доска, домашка, отчёты."]].map(([I, t, d], i) => (
              <div key={t} className="card">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-soft font-display font-extrabold text-brand">{i + 1}</span>
                <h3 className="mt-4 flex items-center gap-2 text-lg"><I size={18} className="text-brand" />{t}</h3>
                <p className="mt-1.5 text-sm text-ink-soft">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#/market/new" className="btn-brand btn-lg">Разместить заявку <ArrowRight size={18} /></a>
            {last && <a href={myHref(last.id, last.key)} className="btn-light btn-lg">Мои заявки и отклики</a>}
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-sm text-ink-mute"><ShieldCheck size={15} /> Контакт для связи видит только администрация платформы.</p>
        </section>
      ) : <Board params={params} canRespond={isTutor} tutor={session?.role ? isTutor : null} />}
    </>
  );
}

function Choice({ label, value, onChange, options }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(options).map(([k, v]) => (
          <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={value === k}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${value === k ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-soft hover:border-ink/20"}`}>{v}</button>
        ))}
      </div>
    </fieldset>
  );
}

export function MarketNew() {
  const [meta, setMeta] = useState(null);
  const [f, setF] = useState({ name: "", age: "", audience: "adult", language: "en", level: "", goals: "",
    teacher_wishes: "", comment: "", schedule: "", budget: "", contact: "", consent: false, website: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { request("GET", "/site/v1/market").then(setMeta).catch(setError); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await request("POST", "/site/v1/market", { ...f, age: f.age ? Number(f.age) : null });
      if (res.id) {
        saveMine([...loadMine(), { id: res.id, key: res.key, created: Date.now() }]);
        window.location.hash = `${myHref(res.id, res.key)}&new=1`;
      }
    } catch (err) { setError(err); setBusy(false); }
  };
  return (
    <>
      <Head eyebrow="Новая заявка" title="Расскажите о задаче" text="Чем точнее цель, тем точнее предложения преподавателей." />
      {!meta ? (error ? <ErrorBox error={error} /> : <Loading />) : (
        <form className="card mb-16 grid max-w-3xl gap-6" onSubmit={submit}>
          <div className="grid gap-5 md:grid-cols-[1fr_140px]">
            <label className="label">Имя<input className="field" required maxLength={40} value={f.name} onChange={set("name")} placeholder="Только имя – его увидят преподаватели" /></label>
            <label className="label">Возраст<input className="field num" type="number" min={4} max={99} value={f.age} onChange={set("age")} /></label>
          </div>
          <Choice label="Для кого занятия" value={f.audience} onChange={set("audience")} options={meta.audiences} />
          <Choice label="Язык" value={f.language} onChange={set("language")} options={meta.languages} />
          <Choice label="Примерный уровень" value={f.level} onChange={set("level")} options={meta.levels} />
          <label className="label">Цель<textarea className="field min-h-[100px]" required maxLength={800} value={f.goals} onChange={set("goals")}
            placeholder="Например: сдать IELTS на 7.0 к весне, подтянуть школьную программу, свободно говорить в поездках" /></label>
          <label className="label">Какого преподавателя ищете<input className="field" maxLength={500} value={f.teacher_wishes} onChange={set("teacher_wishes")} placeholder="Опыт с экзаменами, умеет работать с детьми…" /></label>
          <label className="label">Когда удобно<input className="field" maxLength={200} value={f.schedule} onChange={set("schedule")} placeholder="Будни после 19:00, 2 раза в неделю" /></label>
          <Choice label="Бюджет за урок" value={f.budget} onChange={set("budget")} options={meta.budgets} />
          <label className="label">Комментарий<textarea className="field min-h-[80px]" maxLength={800} value={f.comment} onChange={set("comment")} /></label>
          <label className="label">Телефон, почта или Telegram
            <input className="field" required maxLength={120} value={f.contact} onChange={set("contact")} />
            <span className="flex items-center gap-1.5 text-xs font-normal text-ink-mute"><Lock size={12} /> Преподавателям не показывается.</span>
          </label>
          <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} /></div>
          <label className="flex items-start gap-3 text-sm text-ink-soft">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={f.consent} onChange={set("consent")} />
            Согласен на обработку персональных данных и публикацию заявки без контактов
          </label>
          <ErrorBox error={error} />
          <div><button type="submit" className="btn-brand btn-lg" disabled={busy}>{busy ? "Публикуем…" : <>Опубликовать <ArrowRight size={16} /></>}</button></div>
        </form>
      )}
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
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [id, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = async (p) => {
    if (!window.confirm(`Выбрать преподавателя «${p.teacher}» за ${p.price} ₽ за урок?`)) return;
    try { const r = await request("POST", `/site/v1/market/${id}/choose`, { proposal_id: p.id }, hdr); setLinks(r.links); load(); }
    catch (err) { setError(err); }
  };
  const close = async () => {
    if (!window.confirm("Снять заявку?")) return;
    await request("POST", `/site/v1/market/${id}/close`, {}, hdr).catch(setError);
    load();
  };
  if (!id) return <Head title="Заявка не найдена"><a className="link mt-6 inline-block" href="#/market">К поиску</a></Head>;
  if (!data) return <><Head title="Моя заявка" />{error ? <ErrorBox error={error} /> : <Loading />}</>;
  return (
    <>
      <Head eyebrow="Моя заявка" title={`${data.name}, ${data.language_ru}`} text={data.goals}>
        {params.get("new") && (
          <Notice tone="ok" className="mt-6 max-w-2xl">
            Заявка опубликована! Сохраните эту страницу – здесь появятся отклики.
            <button type="button" onClick={() => { copy(`${window.location.origin}/${myHref(id, key)}`); setCopied(true); }} className="ml-2 inline-flex items-center gap-1 font-semibold underline"><Copy size={13} />{copied ? "скопировано" : "скопировать ссылку"}</button>
          </Notice>
        )}
      </Head>
      {links && (
        <div className="card mb-8 border-mint">
          <h3 className="flex items-center gap-2 text-xl"><CheckCircle2 className="text-mint" /> Преподаватель выбран</h3>
          <p className="mt-2 text-ink-soft">Зарегистрируйтесь по ссылке – и вы окажетесь в общем кабинете с преподавателем: уроки, доска, домашка, сообщения.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {links.site_student && <a className="btn-brand" href={links.site_student.replace(/^.*#/, "#")}>Подключиться на сайте</a>}
            {links.site_parent && <button type="button" className="btn-light" onClick={() => copy(links.site_parent)}>Скопировать ссылку для родителя</button>}
            {links.student && <a className="btn-ghost" href={links.student} target="_blank" rel="noopener">или в Telegram</a>}
          </div>
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl">Отклики <span className="num text-ink-mute">{data.proposals.length}</span></h2>
        {data.status === "open" && <button type="button" onClick={close} className="btn-ghost btn-sm">Снять заявку</button>}
      </div>
      <ErrorBox error={error} />
      {!data.proposals.length ? <Empty icon={Search} title="Откликов пока нет" text="Обычно первые приходят в течение суток. Страница обновляется сама." /> : (
        <div className="mb-16 grid gap-4 md:grid-cols-2">
          {data.proposals.map((p) => (
            <div key={p.id} className={`card ${p.status === "accepted" ? "border-mint" : p.status === "declined" ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="text-xl">{p.teacher}</h3>{p.specialties && <p className="mt-0.5 text-sm text-brand">{p.specialties}</p>}</div>
                <span className="text-right"><span className="num block font-display text-xl font-extrabold">{p.price.toLocaleString("ru-RU")} ₽</span><span className="text-xs text-ink-mute">за урок</span></span>
              </div>
              {p.bio && <p className="mt-2 text-sm text-ink-mute">{p.bio}</p>}
              <p className="mt-3 rounded-2xl bg-cream p-4 text-ink-soft">{p.message}</p>
              <div className="mt-4">
                {data.status === "open" ? <button type="button" className="btn-brand btn-sm" onClick={() => choose(p)}>Выбрать</button>
                  : <span className="chip">{p.status === "accepted" ? "выбран" : "не выбран"}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function Market({ route }) {
  const sub = route.parts[1];
  if (sub === "new") return <MarketNew />;
  if (sub === "my") return <MarketMy params={route.params} />;
  return <MarketHome params={route.params} />;
}
