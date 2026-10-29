import { BookOpen, Clapperboard, File, FileText, FolderOpen, Image, Link2, Plus, Search, Trash2, Upload } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { getToken, request } from "../lib/api.js";
import { useSession } from "../lib/session.js";
import { Empty, ErrorBox, Loading, Modal, Notice, PageTitle, Tabs } from "../ui/kit.jsx";
import { shortDate, useApi } from "./common.jsx";
import { UnitsPage } from "./units.jsx";

const PdfPages = lazy(() => import("../board/PdfPages.jsx"));

export async function uploadFile(file, { shared, folder } = {}) {
  const headers = { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name || "file"), Accept: "application/json" };
  const token = getToken();
  if (token) headers["X-Access-Token"] = token;
  if (shared) headers["X-Shared"] = "1";
  if (folder) headers["X-Folder"] = encodeURIComponent(folder);
  const r = await fetch("/site/v1/materials/upload", { method: "POST", headers, body: file, credentials: "same-origin" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(`${file.name || "файл"}: ${data.error || r.status}`); e.status = r.status; throw e; }
  return data;
}

const fmtSize = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`);
const kindOf = (m) => (m.kind === "video" ? "video" : m.kind === "link" ? "link" : m.mime === "application/pdf" ? "pdf" : m.mime?.startsWith("image/") ? "image" : "file");
const ICON = { video: Clapperboard, link: Link2, pdf: BookOpen, image: Image, file: File };
const KIND_TITLE = { pdf: "Учебники и PDF", image: "Картинки", video: "Видео", link: "Ссылки", file: "Документы и аудио" };

/** Материалы: свои файлы и учебники, интерактивные занятия и готовые курсы Bright – в одном разделе. */
export function MaterialsHub({ route }) {
  const { role } = useSession();
  const initial = route?.parts?.[1] === "units" ? "units" : "files";
  const [tab, setTab] = useState(initial);
  return (
    <>
      <PageTitle title={role === "school" ? "Материалы школы" : "Материалы"}
        text={tab === "files" ? "Учебники, картинки, аудио и видео. Откройте PDF, листайте и кладите нужную страницу на доску прямо на уроке."
          : tab === "units" ? "Интерактивные задания с автопроверкой: выдайте их как домашку, слова сами попадут в карточки."
            : "Готовые уроки Bright по уровням и экзаменам. Возьмите себе, поменяйте под ученика и выдайте."}
        actions={<Tabs label="Раздел" value={tab} onChange={setTab}
          items={[{ id: "files", title: "Файлы и учебники" }, { id: "units", title: "Мои занятия" }, { id: "library", title: "Курсы Bright" }]} />} />
      {tab === "files" ? <Files /> : <UnitsPage embedded tab={tab === "units" ? "mine" : "library"} />}
    </>
  );
}

function Files() {
  const { account, role } = useSession();
  const { data, error, reload } = useApi("/site/v1/materials");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [folder, setFolder] = useState("");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(null);
  const [errors, setErrors] = useState([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState({ url: "", title: "" });
  const [newFolder, setNewFolder] = useState("");
  const [open, setOpen] = useState(null);
  const input = useRef(null);
  const inSchool = !!account?.org && role === "tutor";
  const [shared, setShared] = useState(false);

  const upload = async (files) => {
    const list = [...files];
    const errs = [];
    for (let i = 0; i < list.length; i += 1) {
      setProgress(`Загружаем ${i + 1} из ${list.length}: ${list[i].name}`);
      try { await uploadFile(list[i], { shared, folder: newFolder || folder || undefined }); } catch (e) { errs.push(e.message); }
    }
    setProgress(null); setErrors(errs); reload();
  };
  const addLink = async (e) => {
    e.preventDefault();
    try { await request("POST", "/site/v1/materials", { ...link, shared, folder: folder || undefined }); setLink({ url: "", title: "" }); setLinkOpen(false); reload(); } catch (x) { setErrors([x.message]); }
  };
  const remove = async (m) => {
    if (!window.confirm(`Удалить «${m.title}»?`)) return;
    await request("POST", `/site/v1/materials/${m.id}/delete`, {}).catch((x) => setErrors([x.message]));
    reload();
  };
  const all = data?.materials || [];
  const folders = [...new Set(all.map((m) => m.folder).filter(Boolean))].sort();
  const needle = q.trim().toLowerCase();
  const list = all.filter((m) => (!needle || m.title.toLowerCase().includes(needle)) && (kind === "all" || kindOf(m) === kind) && (!folder || m.folder === folder));
  const kinds = [...new Set(all.map(kindOf))];
  return (
    <>
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        className={`panel flex flex-wrap items-center gap-4 border-dashed p-4 transition ${drag ? "border-ink bg-sun-soft" : ""}`}>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cream"><Upload size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Перетащите файлы сюда или выберите</p>
          <p className="text-[13px] text-ink-mute">PDF учебников, картинки, презентации, аудио и видео до 25 МБ. Можно сразу пачкой.</p>
          {progress && <p className="mt-1 text-[13px] font-medium text-ink">{progress}</p>}
        </div>
        <input ref={input} type="file" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        <button type="button" className="btn-light" onClick={() => setLinkOpen(true)}><Link2 size={16} /> Ссылка или видео</button>
        <button type="button" className="btn-brand" onClick={() => input.current?.click()}><Plus size={16} /> Загрузить</button>
        {inSchool && <label className="flex w-full items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Загружать в общую базу школы</label>}
      </div>
      {errors.length > 0 && <Notice tone="bad" className="mt-3">{errors.map((x) => <div key={x}>{x}</div>)}</Notice>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-64"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute" /><input className="field !pl-10" placeholder="Поиск по названию" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск материалов" /></label>
        <div className="flex flex-wrap gap-1.5">
          {["all", ...kinds].map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`chip !px-2.5 !py-1 !text-[13px] ${kind === k ? "!bg-ink !text-white" : ""}`}>{k === "all" ? `Все ${all.length}` : KIND_TITLE[k]}</button>
          ))}
        </div>
      </div>
      {(folders.length > 0 || all.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px]">
          <FolderOpen size={15} className="text-ink-mute" />
          <button type="button" onClick={() => setFolder("")} className={`rounded-lg px-2 py-1 font-medium ${!folder ? "bg-white text-ink shadow-soft" : "text-ink-mute hover:text-ink"}`}>Все папки</button>
          {folders.map((f) => <button key={f} type="button" onClick={() => setFolder(f)} className={`rounded-lg px-2 py-1 font-medium ${folder === f ? "bg-white text-ink shadow-soft" : "text-ink-mute hover:text-ink"}`}>{f}</button>)}
          <input className="ml-1 w-40 rounded-lg border border-dashed border-line bg-transparent px-2 py-1 text-[13px] outline-none focus:border-ink/40" placeholder="+ папка для загрузки" value={newFolder} onChange={(e) => setNewFolder(e.target.value.slice(0, 60))} aria-label="Новая папка" />
        </div>
      )}

      <div className="mt-4"><ErrorBox error={error} /></div>
      {!data ? <Loading /> : !list.length ? (
        <Empty icon={FileText} title={needle || kind !== "all" || folder ? "Ничего не нашлось" : "Здесь будут ваши учебники и файлы"}
          text="Загрузите PDF учебника, который вы используете: на уроке его страницы кладутся на доску одним нажатием." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((m) => {
            const k = kindOf(m);
            const I = ICON[k];
            return (
              <div key={m.id} className="panel group flex flex-col overflow-hidden transition hover:border-ink/25">
                <button type="button" onClick={() => setOpen(m)} className="relative grid h-32 place-items-center bg-cream">
                  {k === "image" ? <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <span className="flex flex-col items-center gap-1.5 text-ink-soft"><I size={28} strokeWidth={1.6} /><span className="text-[11px] font-semibold uppercase tracking-wide">{k === "pdf" ? "PDF" : k === "video" ? "видео" : k === "link" ? "ссылка" : (m.title.split(".").pop() || "файл").slice(0, 5)}</span></span>}
                </button>
                <div className="flex flex-1 flex-col p-3.5">
                  <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{m.title}</p>
                  <p className="mt-1 text-xs text-ink-mute">{m.folder ? `${m.folder} · ` : ""}{m.kind === "file" ? fmtSize(m.size) : KIND_TITLE[k]}{m.shared ? " · школа" : ""}</p>
                  <div className="mt-auto flex items-center gap-1 pt-2">
                    <button type="button" className="btn-ghost btn-sm !px-2" onClick={() => setOpen(m)}>Открыть</button>
                    <span className="text-[11px] text-ink-mute">{shortDate(m.created_at).split(",")[0]}</span>
                    {(m.mine || role === "school") && <button type="button" className="btn-ghost btn-sm ml-auto !px-2 opacity-60 group-hover:opacity-100" onClick={() => remove(m)} aria-label={`Удалить ${m.title}`}><Trash2 size={14} /></button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Ссылка или видео">
        <form onSubmit={addLink} className="grid gap-3">
          <p className="text-sm text-ink-mute">VK Видео, YouTube и Rutube откроются прямо на доске: ученик смотрит вместе с вами без демонстрации экрана.</p>
          <input className="field" type="url" required placeholder="https://vkvideo.ru/video-…" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} aria-label="Ссылка" />
          <input className="field" maxLength={120} placeholder="Название (необязательно)" value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} aria-label="Название" />
          <button type="submit" className="btn-brand w-fit"><Plus size={16} /> Добавить</button>
        </form>
      </Modal>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title || ""} wide>
        {open && <Viewer m={open} />}
      </Modal>
    </>
  );
}

function Viewer({ m }) {
  const k = kindOf(m);
  if (k === "pdf") return <Suspense fallback={<Loading />}><PdfPages url={m.url} title={m.title} /></Suspense>;
  if (m.embed) return <iframe title={m.title} src={m.embed} className="aspect-video w-full rounded-2xl" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />;
  if (k === "image") return <img src={m.url} alt={m.title} className="max-h-[70vh] w-full rounded-2xl object-contain" />;
  if (m.mime?.startsWith("audio/")) return <audio controls src={m.url} className="w-full" />;
  if (m.mime?.startsWith("video/")) return <video controls src={m.url} className="max-h-[70vh] w-full rounded-2xl" />;
  return <a className="btn-brand" href={m.url} target="_blank" rel="noopener">Открыть файл</a>;
}
