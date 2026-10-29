import { ArrowLeft, Check, Copy, Eye, Play, Printer, Send } from "lucide-react";
import { useState } from "react";
import { fluentSrc } from "../board/stickers.js";
import { request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { ErrorBox, Loading, Modal } from "../ui/kit.jsx";
import { useApi } from "./common.jsx";
import UnitPlayer from "./player.jsx";
import Quest from "./quest.jsx";

// Пройденные главы учебника – в браузере ученика (курсы Bright он проходит сам, без оценки)
const DONE_KEY = "bright-book-done";
const loadDone = () => { try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || "[]")); } catch { return new Set(); } };
const markDone = (id) => { try { const s = loadDone(); s.add(id); localStorage.setItem(DONE_KEY, JSON.stringify([...s])); } catch { /* нет хранилища */ } };

/** Объёмная обложка: цветной фон, большая картинка, уровень. */
export function BookCover({ book, size = "md" }) {
  const art = fluentSrc(book.cover);
  const big = size === "lg";
  return (
    <div className={`relative overflow-hidden rounded-2xl ${big ? "h-56 w-40" : "h-40 w-full"}`} style={{ background: book.color }}>
      <div className="absolute inset-y-0 left-0 w-2.5 bg-black/10" />
      <span className="absolute left-5 top-3 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px] font-bold">{book.level}</span>
      {art ? <img src={art} alt="" className={`absolute drop-shadow-[0_10px_14px_rgba(0,0,0,.18)] ${big ? "bottom-6 right-3 h-24 w-24" : "bottom-3 right-3 h-20 w-20"} rotate-6`} />
        : <span className="absolute bottom-3 right-4 text-5xl">{book.cover}</span>}
      <span className={`absolute left-5 right-3 top-10 line-clamp-3 font-bold leading-tight ${big ? "text-lg" : "text-[15px]"}`}>{book.title.split(".")[0]}</span>
    </div>
  );
}

/** Полка учебников. */
export function BookShelf({ books, onOpen }) {
  const done = loadDone();
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {books.map((b) => {
        const n = b.units.filter((u) => done.has(u)).length;
        return (
          <button key={b.id} type="button" onClick={() => onOpen(b)} className="group text-left">
            <div className="transition group-hover:-translate-y-1 group-hover:drop-shadow-lg"><BookCover book={b} /></div>
            <p className="mt-2.5 text-[15px] font-semibold leading-snug">{b.title}</p>
            <p className="mt-0.5 text-[13px] text-ink-mute">{b.units.length} уроков{n ? ` · пройдено ${n}` : ""}</p>
            {n > 0 && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream"><div className="h-full rounded-full bg-mint" style={{ width: `${(n / b.units.length) * 100}%` }} /></div>}
          </button>
        );
      })}
    </div>
  );
}

/** Учебник: оглавление, прохождение глав, выдача ученику и печать. */
export function BookView({ bookId, onBack, onAssign }) {
  const { role } = useSession();
  const { data, error } = useApi(`/site/v1/library/book/${bookId}`, [bookId]);
  const [play, setPlay] = useState(null);
  const [look, setLook] = useState(null);
  const [err, setErr] = useState(null);
  const [, refresh] = useState(0);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const { book, units, teacher } = data;
  const done = loadDone();
  const studentView = (u) => (teacher ? null : u); // ученику сервер уже отдал без ответов
  const copy = async (u, assign) => {
    setErr(null);
    try {
      const c = await request("POST", `/site/v1/units/library/${u.id}`, {});
      if (assign) onAssign?.({ id: c.id, title: u.title }); else window.location.hash = `#/app/units/${c.id}`;
    } catch (x) { setErr(x); }
  };
  if (play) {
    return (
      <Quest unit={play.preview}
        onCheck={(answers) => request("POST", `/site/v1/library/${play.id}/check`, { answers })}
        onSubmit={async (answers) => { const r = await request("POST", `/site/v1/library/${play.id}/check`, { answers }); markDone(play.id); return r; }}
        onExit={() => { setPlay(null); refresh((x) => x + 1); }} />
    );
  }
  // Для «Пройти» нужен вид ученика: у преподавателя берём его из общей библиотеки
  const start = async (u) => {
    if (studentView(u)) { setPlay({ id: u.id, preview: u }); return; }
    try { const card = await request("GET", `/site/v1/library/unit/${u.id}`); setPlay({ id: u.id, preview: card.preview }); } catch (x) { setErr(x); }
  };
  const peek = async (u) => {
    try { const card = await request("GET", `/site/v1/library/unit/${u.id}`); setLook({ id: u.id, title: u.title, preview: card.preview }); } catch (x) { setErr(x); }
  };
  return (
    <>
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-ink-mute hover:text-ink"><ArrowLeft size={14} /> Все учебники</button>
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end">
        <BookCover book={book} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[1.7rem] leading-tight md:text-[2rem]">{book.title}</h1>
          <p className="mt-2 max-w-xl text-ink-soft">{book.about}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-brand" onClick={() => start(units.find((u) => !done.has(u.id)) || units[0])}><Play size={16} />{done.size && units.some((u) => done.has(u.id)) ? "Продолжить" : "Начать с первого урока"}</button>
            {role !== "student" && <a className="btn-light" href={`#/print/book/${book.id}`} target="_blank" rel="noreferrer"><Printer size={16} /> Печать и PDF</a>}
          </div>
        </div>
      </div>
      <ErrorBox error={err} />
      <ol className="grid gap-2.5">
        {units.map((u, k) => (
          <li key={u.id} className="panel flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[15px] font-bold ${done.has(u.id) ? "bg-mint text-white" : "bg-cream"}`}>{done.has(u.id) ? <Check size={18} /> : k + 1}</span>
            <span className="min-w-0 flex-1 basis-56">
              <span className="block font-semibold leading-snug">{u.title}</span>
              <span className="mt-0.5 block text-[13px] text-ink-mute">{u.summary}</span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              {role !== "student" && <button type="button" className="btn-ghost btn-sm" onClick={() => peek(u)}><Eye size={14} /> Смотреть</button>}
              {role !== "student" && <button type="button" className="btn-ghost btn-sm" onClick={() => copy(u, false)}><Copy size={14} /> Взять себе</button>}
              {role !== "student" && <button type="button" className="btn-light btn-sm" onClick={() => copy(u, true)}><Send size={14} /> Выдать</button>}
              <button type="button" className="btn-sm rounded-xl bg-mint px-3 font-semibold text-white shadow-[0_2px_0_#146b4c] active:translate-y-px" onClick={() => start(u)}><Play size={14} className="mr-1 inline" />{done.has(u.id) ? "Ещё раз" : "Пройти"}</button>
            </span>
          </li>
        ))}
      </ol>
      <Modal open={!!look} onClose={() => setLook(null)} title={look?.title || ""} wide>
        {look && <UnitPlayer unit={look.preview} submitLabel="Проверить себя" onSubmit={(answers) => request("POST", `/site/v1/library/${look.id}/check`, { answers })} />}
      </Modal>
    </>
  );
}

// == Печать учебника ===================================================================================
const blank = (text) => text.replace(/\[([^\]]+)\]/g, "________");
const firstAnswers = (text) => [...text.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].split("|")[0]);

/** Учебник одной страницей для печати или сохранения в PDF; в конце – ответы (для преподавателя). */
export function BookPrint({ id }) {
  const { data, error } = useApi(`/site/v1/library/book/${id}`, [id]);
  if (error) return <div className="p-10"><ErrorBox error={error} /></div>;
  if (!data) return <div className="p-10"><Loading /></div>;
  const { book, units, teacher } = data;
  // Сначала собираем страницы уроков и ключи к ним, потом рисуем
  const keys = [];
  const pages = units.map((u, k) => {
    const key = [];
    const body = u.blocks.map((b, i) => {
      const n = `${k + 1}.${i + 1}`;
      if (b.type === "text") return <div key={i} className="mt-5"><h3 className="text-base">{b.title}</h3><p className="mt-1 whitespace-pre-wrap">{b.body}</p></div>;
      if (b.type === "words") {
        return (
          <div key={i} className="mt-5"><h3 className="text-base">{b.title || "Слова"}</h3>
            <table className="mt-2 w-full border-collapse"><tbody>{b.items.map((w) => <tr key={w.word} className="border-b border-line"><td className="py-1 pr-4 font-semibold">{w.word}</td><td className="py-1 text-ink-soft">{w.translation}</td></tr>)}</tbody></table>
          </div>
        );
      }
      if (b.type === "gap" || (b.type === "listening" && (b.script || b.parts))) {
        const text = b.text || b.script;
        if (teacher && text) key.push([n, firstAnswers(text).join(", ")]);
        if (teacher && b.questions?.length) key.push([`${n} (вопросы)`, b.questions.map((q, j) => `${j + 1}) ${q.options[q.answer]}`).join("; ")]);
        const shown = text ? blank(text) : (b.parts || []).join("________");
        return (
          <div key={i} className="mt-5"><h3 className="text-base">{n}. {b.title}</h3>
            {b.type === "listening" && <p className="text-xs text-ink-mute">Аудирование: текст читает преподаватель или озвучка Bright.</p>}
            <p className="mt-1 whitespace-pre-wrap">{shown}</p>{b.questions?.length > 0 && <Qs qs={b.questions} />}
          </div>
        );
      }
      if (b.type === "choice") {
        if (teacher) key.push([n, b.questions.map((q, j) => `${j + 1}) ${q.options[q.answer]}`).join("; ")]);
        return <div key={i} className="mt-5"><h3 className="text-base">{n}. {b.title}</h3><Qs qs={b.questions} /></div>;
      }
      if (b.type === "match") {
        const left = b.pairs ? b.pairs.map((x) => x[0]) : b.left || [];
        const right = b.pairs ? b.pairs.map((x) => x[1]).sort() : b.right || [];
        if (teacher && b.pairs) key.push([n, b.pairs.map((x) => `${x[0]} – ${x[1]}`).join("; ")]);
        return (
          <div key={i} className="mt-5"><h3 className="text-base">{n}. {b.title}</h3>
            <div className="mt-1 grid grid-cols-2 gap-x-8">
              <ol className="list-decimal pl-5">{left.map((x) => <li key={x}>{x}</li>)}</ol>
              <ol className="list-[lower-alpha] pl-5">{right.map((x) => <li key={x}>{x}</li>)}</ol>
            </div>
          </div>
        );
      }
      if (b.type === "write") return <div key={i} className="mt-5"><h3 className="text-base">{n}. {b.title}</h3><p className="mt-1 whitespace-pre-wrap">{b.prompt}</p><div className="mt-2 h-28 rounded-lg border border-dashed border-line" /></div>;
      return null;
    });
    if (key.length) keys.push([k + 1, u.title, key]);
    return (
      <section key={u.id} className="mt-10 print:mt-0" style={{ breakBefore: "page" }}>
        <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Урок {k + 1}</p>
        <h2 className="mt-1 text-2xl">{u.title}</h2>
        <p className="mt-1 text-ink-soft">{u.summary}</p>
        {body}
      </section>
    );
  });
  return (
    <div className="mx-auto max-w-[800px] bg-white px-8 py-10 text-[14px] leading-relaxed text-ink print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <a href="#/app/materials" className="text-sm font-semibold text-ink-mute hover:text-ink">← Вернуться</a>
        <button type="button" className="btn-brand" onClick={() => window.print()}><Printer size={16} /> Печать / сохранить в PDF</button>
      </div>
      <section className="flex min-h-[60vh] flex-col justify-center print:min-h-[95vh]" style={{ breakAfter: "page" }}>
        <div className="w-fit"><BookCover book={book} size="lg" /></div>
        <h1 className="mt-6 text-4xl">{book.title}</h1>
        <p className="mt-2 text-lg text-ink-soft">{book.about}</p>
        <p className="mt-8 text-sm text-ink-mute">Bright · {units.length} уроков · материалы написаны для платформы Bright</p>
        <ol className="mt-8 grid gap-1">{units.map((u, k) => <li key={u.id}><b>{k + 1}.</b> {u.title}</li>)}</ol>
      </section>
      {pages}
      {teacher && keys.length > 0 && (
        <section className="mt-10" style={{ breakBefore: "page" }}>
          <h2 className="text-2xl">Ответы</h2>
          {keys.map(([k, t, key]) => (
            <div key={k} className="mt-4"><p className="font-semibold">Урок {k}. {t}</p>
              <ul className="mt-1 grid gap-0.5 text-[13px]">{key.map(([n, a]) => <li key={n}><b>{n}</b> {a}</li>)}</ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Qs({ qs }) {
  return (
    <ol className="mt-1 grid list-decimal gap-1.5 pl-5">
      {qs.map((q) => <li key={q.q}>{q.q}<span className="ml-2 text-ink-soft">{q.options.map((o, j) => `${"abcd"[j]}) ${o}`).join("   ")}</span></li>)}
    </ol>
  );
}

