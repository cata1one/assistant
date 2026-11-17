import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import Board from "../board/Board.jsx";
import { request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { ErrorBox, Loading } from "../ui/kit.jsx";
import { useApi } from "./common.jsx";

export default function BoardPage({ params }) {
  const { role } = useSession();
  const id = params.get("id");
  const { data, error } = useApi(id ? `/site/v1/boards/${id}/items?since=0` : null, [id]);
  const staff = data?.role === "tutor" || data?.role === "admin";
  const miro = useApi(id ? `/site/v1/boards/${id}/miro` : null, [id]);
  const [tab, setTab] = useState("bright");
  const [url, setUrl] = useState("");
  const [miroError, setMiroError] = useState(null);
  const [saving, setSaving] = useState(false);
  const saveMiro = async (event, value = url) => {
    event?.preventDefault(); setSaving(true); setMiroError(null);
    try { await request("POST", `/site/v1/boards/${id}/miro`, { url: value }); setUrl(""); await miro.reload(); }
    catch (err) { setMiroError(err); } finally { setSaving(false); }
  };
  return (
    <div className="flex h-[calc(100dvh-12rem)] flex-col gap-3 lg:h-[calc(100dvh-2rem)]">
      <div className="flex flex-wrap items-center gap-3">
        <a href="#/app/boards" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-mute hover:text-ink"><ArrowLeft size={14} /> Доски</a>
        <h1 className="text-xl">{id ? data?.board.title || "Доска" : "Личная доска"}</h1>
        <span className="text-sm text-ink-mute">{id ? "Изменения видны всем участникам." : "Сохраняется в этом браузере."}</span>
      </div>
      <ErrorBox error={error} />
      {id && <div className="flex flex-wrap gap-2"><button type="button" className={tab === "bright" ? "btn-brand btn-sm" : "btn-light btn-sm"} onClick={() => setTab("bright")}>Доска Bright</button><button type="button" className={tab === "miro" ? "btn-brand btn-sm" : "btn-light btn-sm"} onClick={() => setTab("miro")}>Доска Miro</button></div>}
      <div className="min-h-0 flex-1">
        {tab === "miro" && id ? <div className="flex h-full min-h-0 flex-col gap-3">
          <p className="text-sm text-ink-soft">Miro управляет доступом к доске. Настройте разрешения в Miro для каждого участника; ссылка будет доступна участникам этой доски Bright.</p>
          {staff && <form onSubmit={saveMiro} className="flex flex-wrap gap-2"><input className="field min-w-0 flex-1" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Ссылка на доску https://miro.com/app/board/…" aria-label="Ссылка на доску Miro" /><button className="btn-brand" disabled={saving || !url}>Подключить</button>{miro.data?.miro_id && <button type="button" className="btn-light" onClick={() => saveMiro(null, "")} disabled={saving}>Убрать</button>}</form>}
          <ErrorBox error={miroError || miro.error} />
          {miro.data?.miro_id ? <iframe title="Доска Miro" src={`https://miro.com/app/live-embed/${miro.data.miro_id}/`} className="min-h-[360px] w-full flex-1 rounded-2xl border border-line bg-white" allow="fullscreen; clipboard-read; clipboard-write" /> : <p className="text-sm text-ink-mute">{staff ? "Добавьте ссылку на доску Miro." : "Преподаватель ещё не подключил доску Miro."}</p>}
        </div> : id && !data ? (error ? null : <Loading />) : (
          <Board boardId={id} canClear={staff} canUpload={id ? staff : role === "tutor" || role === "school"} height="100%" />
        )}
      </div>
    </div>
  );
}
