import { ArrowLeft } from "lucide-react";
import Board from "../board/Board.jsx";
import { useSession } from "../lib/session.js";
import { ErrorBox, Loading } from "../ui/kit.jsx";
import { useApi } from "./common.jsx";

export default function BoardPage({ params }) {
  const { role } = useSession();
  const id = params.get("id");
  const { data, error } = useApi(id ? `/site/v1/boards/${id}/items?since=0` : null, [id]);
  const staff = data?.role === "tutor" || data?.role === "admin";
  return (
    <div className="flex h-[calc(100dvh-12rem)] flex-col gap-3 lg:h-[calc(100dvh-2rem)]">
      <div className="flex flex-wrap items-center gap-3">
        <a href="#/app/boards" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-mute hover:text-ink"><ArrowLeft size={14} /> Доски</a>
        <h1 className="text-xl">{id ? data?.board.title || "Доска" : "Личная доска"}</h1>
        <span className="text-sm text-ink-mute">{id ? "Изменения видны всем участникам." : "Сохраняется в этом браузере."}</span>
      </div>
      <ErrorBox error={error} />
      <div className="min-h-0 flex-1">
        {id && !data ? (error ? null : <Loading />) : (
          <Board boardId={id} canClear={staff} canUpload={id ? staff : role === "tutor" || role === "school"} height="100%" />
        )}
      </div>
    </div>
  );
}
