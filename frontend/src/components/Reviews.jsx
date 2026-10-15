import { motion } from "framer-motion";
import { MessageSquareHeart, Quote, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { request } from "../lib/api.js";
import { courseById, useCatalog } from "../lib/catalog.js";
import { Stagger, StaggerItem } from "./Reveal.jsx";
import { Segmented } from "./ui.jsx";

const ROLE = { student: "Ученик", parent: "Родитель", teacher: "Преподаватель" };
const TABS = [{ id: "all", title: "Все" }, { id: "student", title: "Ученики" }, { id: "parent", title: "Родители" },
  { id: "teacher", title: "Преподаватели" }];

export function Stars({ value, size = 15 }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Оценка ${value} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= value ? "fill-amber-300 text-amber-300" : "text-zinc-700"} />)}
    </span>
  );
}

function ReviewCard({ r }) {
  const catalog = useCatalog();
  const course = r.course_id ? courseById(catalog, r.course_id) : null;
  const initials = r.author_name.replace(/^Пример:\s*/, "").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  return (
    <motion.figure whileHover={{ y: -6 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="card card-hover relative flex h-full flex-col hover:shadow-glow-violet">
      <Quote aria-hidden="true" size={42} className="absolute right-6 top-6 text-white/5" />
      <div className="flex items-center justify-between gap-3">
        <Stars value={r.rating} />
        {r.demo && <span className="chip !border-amber-400/30 !text-amber-200">пример</span>}
      </div>
      <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-zinc-200">«{r.text}»</blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span className="num grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet/60 to-emerald/60 text-sm font-semibold text-white">{initials}</span>
        <span>
          <span className="block text-sm font-semibold text-white">{r.author_name}</span>
          <span className="block text-xs text-zinc-500">{ROLE[r.author_role] || ""}{course ? ` · ${course.title}` : ""}</span>
        </span>
      </figcaption>
    </motion.figure>
  );
}

export default function Reviews({ limit, showTabs = true }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("all");
  useEffect(() => { request("GET", "/site/v1/reviews").then(setData).catch(() => setData({ reviews: [], count: 0 })); }, []);
  if (!data) return null;
  const list = data.reviews.filter((r) => tab === "all" || r.author_role === tab).slice(0, limit || 999);
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        {showTabs && <Segmented label="Отзывы" items={TABS} value={tab} onChange={setTab} />}
        {data.average && (
          <div className="flex items-center gap-3">
            <span className="stat-num text-4xl">{data.average.toFixed(1)}</span>
            <span><Stars value={Math.round(data.average)} /><span className="block text-xs text-zinc-500">{data.count} отзывов</span></span>
          </div>
        )}
      </div>
      {list.length ? (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" gap={0.06}>
          {list.map((r) => <StaggerItem key={r.id}><ReviewCard r={r} /></StaggerItem>)}
        </Stagger>
      ) : (
        <div className="card flex flex-col items-center py-14 text-center">
          <MessageSquareHeart size={34} className="text-violet-soft" />
          <h3 className="mt-4 text-2xl">Здесь будут отзывы наших учеников</h3>
          <p className="mt-2 max-w-md">Публикуем только настоящие отзывы — от учеников, родителей и преподавателей школы. Оставить отзыв можно в личном кабинете.</p>
          <a href="#/cabinet?tab=review" className="btn-ghost btn-sm mt-6">Оставить отзыв</a>
        </div>
      )}
      {data.reviews.some((r) => r.demo) && (
        <p className="mt-5 text-xs text-zinc-600">Карточки с пометкой «пример» показывают, как будут выглядеть отзывы. Они исчезнут, как только появятся настоящие.</p>
      )}
    </div>
  );
}
