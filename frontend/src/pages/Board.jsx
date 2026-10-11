import { ArrowLeft, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Reveal } from "../components/Reveal.jsx";
import { ErrorBox, PageHead } from "../components/ui.jsx";
import { getToken, request } from "../lib/api.js";

/** Обёртка над board.js (canvas-доска без зависимостей): монтируем в div и уничтожаем при уходе. */
function Canvas({ remote, canClear }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !window.SchoolBoard) return undefined;
    ref.current.textContent = "";
    const board = new window.SchoolBoard(ref.current, remote ? { remote, canClear } : {});
    return () => board.destroy();
  }, [remote?.boardId, canClear]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} data-lenis-prevent />;
}

export function BoardList({ data }) {
  const [chat, setChat] = useState(data.chats[0]?.chat_id || "");
  const [title, setTitle] = useState("");
  const [error, setError] = useState(null);
  const create = async () => {
    try {
      const b = await request("POST", "/site/v1/boards", { chat_id: chat, title });
      window.location.hash = `#/board?id=${b.id}`;
    } catch (err) { setError(err); }
  };
  return (
    <div className="card">
      <h3 className="text-2xl">Общие доски</h3>
      {data.boards.length ? (
        <ul className="mt-5 grid gap-2">
          {data.boards.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[.03] px-4 py-3 transition-all duration-300 hover:border-white/15">
              <span><span className="font-semibold text-white">{b.title}</span> <span className="text-sm text-zinc-500">с {b.with}</span></span>
              <a className="btn-primary btn-sm" href={`#/board?id=${b.id}`}>Открыть</a>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3">Досок пока нет.</p>}
      {data.chats.length > 0 && (
        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
          <select className="field" aria-label="С кем доска" value={chat} onChange={(e) => setChat(e.target.value)}>
            {data.chats.map((c) => <option key={c.chat_id} value={c.chat_id}>{c.title}</option>)}
          </select>
          <input className="field" aria-label="Название доски" maxLength={80} placeholder="Название, например «Present Perfect»"
            value={title} onChange={(e) => setTitle(e.target.value)} />
          <button type="button" className="btn-primary" onClick={create}><Plus size={16} /> Создать доску</button>
        </div>
      )}
      {error && <div className="mt-4"><ErrorBox error={error} /></div>}
    </div>
  );
}

export default function Board({ params }) {
  const id = params.get("id");
  const token = getToken();
  const [shared, setShared] = useState(null);
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null); setShared(null);
    if (id && token) request("GET", `/site/v1/boards/${id}/items?since=0`).then(setShared).catch(setError);
    else if (token) request("GET", "/site/v1/boards").then(setList).catch(() => {});
  }, [id, token]);

  if (id && token) {
    return (
      <>
        <PageHead eyebrow={<a href="#/board" className="inline-flex items-center gap-2 hover:text-white"><ArrowLeft size={14} /> Все доски</a>}
          title={shared?.board.title || "Доска"} text="Общая доска: изменения видны обоим участникам. Текст на доске проверяется — контакты оставлять нельзя." />
        {error && <ErrorBox error={error} />}
        {shared && <Canvas remote={{ boardId: id, request }} canClear={shared.role === "tutor" || shared.role === "admin"} />}
      </>
    );
  }
  return (
    <>
      <PageHead eyebrow="Инструменты" title="Доска"
        text={token ? "Личная доска для заметок — сохраняется в этом браузере. Общие доски с преподавателем — в списке ниже."
          : "Личная доска для заметок и объяснений — сохраняется в этом браузере. Общая доска с преподавателем открывается из личного кабинета."} />
      {list && <Reveal className="mb-6"><BoardList data={list} /></Reveal>}
      <Canvas />
    </>
  );
}
