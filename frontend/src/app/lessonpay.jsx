import { Check, Wallet, X } from "lucide-react";
import { useEffect, useState } from "react";
import { plural, request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { Empty, ErrorBox, Loading, Notice, PageTitle } from "../ui/kit.jsx";
import { Panel, useApi } from "./common.jsx";

const PACKS = [1, 4, 5, 8, 10];
const REMIND = [["off", "Не напоминать"], ["before", "Когда начался урок, а занятий на балансе нет"], ["after", "Когда урок закончился, а занятий не осталось"]];
const lessons = (n) => plural(n, "занятие", "занятия", "занятий");
const rub = (n) => `${Number(n).toLocaleString("ru-RU")} ₽`;

// == Ученик: оплатить и сообщить =====================================================================
export function StudentPayCard() {
  const { data, error, reload } = useApi("/site/v1/lesson-pay");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  if (error || !data?.items?.length) return null;
  const declare = async (item, count) => {
    setBusy(true); setErr(null);
    try { await request("POST", "/site/v1/lesson-pay/declare", { pair_id: item.pair_id, count }); await reload(); } catch (x) { setErr(x); }
    setBusy(false);
  };
  return (
    <Panel title="Оплата занятий" icon={Wallet} className="lg:col-span-2">
      <div className="grid gap-4 md:grid-cols-2">
        {data.items.map((it) => (
          <div key={it.pair_id} className="rounded-2xl border border-line p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-bold">{it.tutor}</p>
              <p className="text-sm text-ink-mute">{rub(it.price)} за занятие</p>
            </div>
            <p className={`mt-2 text-sm font-semibold ${it.balance > 0 ? "text-mint" : "text-teach-deep"}`}>
              {it.balance > 0 ? `Оплачено: ${it.balance} ${lessons(it.balance)}` : it.balance < 0 ? `Не оплачено прошедших: ${-it.balance}` : "Оплаченных занятий нет"}
            </p>
            <div className="mt-3 whitespace-pre-line rounded-xl bg-cream px-3 py-2 text-sm text-ink-soft"><span className="text-xs font-bold uppercase tracking-wider text-ink-mute">Куда перевести</span><br />{it.requisites}</div>
            {it.pending.length > 0 ? (
              <Notice className="mt-3">Ждём, пока преподаватель подтвердит оплату: {it.pending.map((p) => `${p.count} ${lessons(p.count)}`).join(", ")}.</Notice>
            ) : (
              <>
                <p className="mt-3 text-xs text-ink-mute">Переведите деньги и нажмите, сколько занятий оплатили:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {it.packs.map((n) => <button key={n} type="button" className="btn-brand btn-sm" disabled={busy} onClick={() => declare(it, n)}>Я оплатил(а) {n} {lessons(n)}, {rub(n * it.price)}</button>)}
                </div>
              </>
            )}
            {it.require_prepay && it.balance <= 0 && <p className="mt-3 text-xs text-teach-deep">Преподаватель просит оплатить занятие заранее: без этого вход в урок закрыт.</p>}
          </div>
        ))}
      </div>
      <div className="mt-3"><ErrorBox error={err} /></div>
    </Panel>
  );
}

// == Преподаватель и школа: настройки, подтверждения, балансы ===========================================
function Settings() {
  const { data, error, reload } = useApi("/site/v1/lesson-pay/config");
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { if (data) setF(data.config); }, [data]);
  if (error) return <ErrorBox error={error} />;
  if (!f) return <Loading />;
  if (data.inherited) return <Notice>Оплату занятий настраивает школа: цена, реквизиты и правила одинаковы для всех преподавателей. Вы подтверждаете оплату своих учеников.</Notice>;
  const setField = (k, v) => setF({ ...f, [k]: v });
  const togglePack = (n) => setField("packs", f.packs.includes(n) ? f.packs.filter((x) => x !== n) : [...f.packs, n].sort((a, b) => a - b));
  const save = async (e) => {
    e.preventDefault(); setErr(null); setMsg(null);
    try { await request("POST", "/site/v1/lesson-pay/config", { ...f, price: Number(f.price) || 0 }); setMsg("Сохранено"); reload(); } catch (x) { setErr(x); }
  };
  return (
    <form onSubmit={save} className="card grid gap-4">
      <label className="flex items-center gap-3 font-semibold">
        <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={f.enabled} onChange={(e) => setField("enabled", e.target.checked)} />
        Включить оплату занятий через платформу
      </label>
      <p className="-mt-2 text-sm text-ink-mute">Необязательно. Деньги ученик переводит вам напрямую, платформа лишь напоминает и ведёт баланс занятий.</p>
      {f.enabled && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">Цена одного занятия, ₽<input className="field" type="number" min={1} max={100000} required value={f.price || ""} onChange={(e) => setField("price", e.target.value)} /></label>
            <div className="label">Пакеты, которые может оплатить ученик
              <div className="flex flex-wrap gap-1.5">{PACKS.map((n) => <button key={n} type="button" aria-pressed={f.packs.includes(n)} onClick={() => togglePack(n)} className={`chip !text-sm ${f.packs.includes(n) ? "chip-brand" : ""}`}>{n}</button>)}</div>
            </div>
          </div>
          <label className="label">Реквизиты: куда переводить
            <textarea className="field min-h-20" required maxLength={500} value={f.requisites} onChange={(e) => setField("requisites", e.target.value)} placeholder="Например: СБП на +7 900 000-00-00, Анна П. Или ссылка на оплату" />
          </label>
          <p className="-mt-2 text-xs text-ink-mute">Реквизиты увидят только ваши ученики, в своём кабинете и в письме с напоминанием.</p>
          <div className="label">Напоминать об оплате
            <div className="grid gap-1.5">{REMIND.map(([id, t]) => (
              <label key={id} className="flex items-center gap-3 font-normal"><input type="radio" name="remind" className="accent-[rgb(var(--brand))]" checked={f.remind === id} onChange={() => setField("remind", id)} />{t}</label>
            ))}</div>
          </div>
          <label className="flex items-start gap-3 text-sm text-ink-soft">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]" checked={f.require_prepay} onChange={(e) => setField("require_prepay", e.target.checked)} />
            <span>Не пускать ученика на урок, пока нет оплаченного занятия. Вы получите письмо, когда он нажмёт «Я оплатил(а)», и подтвердите оплату.</span>
          </label>
        </>
      )}
      {msg && <Notice tone="ok">{msg}</Notice>}
      <ErrorBox error={err} />
      <button type="submit" className="btn-brand w-fit">Сохранить</button>
    </form>
  );
}

export function LessonPayPage() {
  const session = useSession();
  const { data, reload } = useApi("/site/v1/lesson-pay");
  const [err, setErr] = useState(null);
  const act = async (path, body) => {
    setErr(null);
    try { await request("POST", path, body); reload(); session.reload(); } catch (x) { setErr(x); }
  };
  const items = data?.items || [];
  const pending = items.flatMap((it) => it.pending.map((p) => ({ ...p, student: it.student })));
  return (
    <>
      <PageTitle title="Оплата занятий" text="Напоминания об оплате, предоплата пакетами и баланс каждого ученика." />
      <Settings />
      <ErrorBox error={err} />
      {pending.length > 0 && (
        <Panel title="Ждут подтверждения" icon={Wallet} className="mt-4">
          <ul className="grid gap-2">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3">
                <span className="min-w-0 flex-1"><b>{p.student}</b> оплатил(а) {p.count} {lessons(p.count)} на {rub(p.amount)}</span>
                <button type="button" className="btn-brand btn-sm" onClick={() => act("/site/v1/lesson-pay/decide", { id: p.id, action: "confirm" })}><Check size={14} /> Деньги пришли</button>
                <button type="button" className="btn-light btn-sm" onClick={() => act("/site/v1/lesson-pay/decide", { id: p.id, action: "reject", note: "Перевод не найден" })}><X size={14} /> Не пришли</button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel title="Балансы учеников" icon={Wallet} className="mt-4">
        {!data ? <Loading /> : !items.length ? <Empty icon={Wallet} title="Оплата занятий выключена" text="Включите её выше, и здесь появятся балансы учеников." /> : (
          <ul className="grid gap-2">
            {items.map((it) => (
              <li key={it.pair_id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line px-4 py-3">
                <span className="min-w-0 flex-1 font-semibold">{it.student}</span>
                <span className={`text-sm font-semibold ${it.balance > 0 ? "text-mint" : "text-teach-deep"}`}>{it.balance} {lessons(it.balance)}</span>
                {[-1, 1, 4].map((d) => <button key={d} type="button" className="btn-light btn-sm" onClick={() => act("/site/v1/lesson-pay/adjust", { pair_id: it.pair_id, delta: d })}>{d > 0 ? `+${d}` : d}</button>)}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-mute">Занятие списывается, когда урок длится больше 5 минут. Оплатили наличными или перенесли урок? Поправьте баланс кнопками.</p>
      </Panel>
    </>
  );
}
