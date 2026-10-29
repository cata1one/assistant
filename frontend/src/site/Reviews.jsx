import { MessageSquareHeart, Quote, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { request } from "../lib/api.js";
import { Avatar, Tabs } from "../ui/kit.jsx";

const ROLE = { student: "Ученик", parent: "Родитель", teacher: "Преподаватель" };

export function Stars({ value, size = 15 }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Оценка ${value} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= value ? "fill-ink text-ink" : "text-line"} />)}
    </span>
  );
}

export default function Reviews({ limit, tabs = true, hideEmpty }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("all");
  useEffect(() => { request("GET", "/site/v1/reviews").then(setData).catch(() => setData({ reviews: [], count: 0 })); }, []);
  // На главной показываем только настоящие отзывы, без примеров
  const all = data ? data.reviews.filter((r) => !hideEmpty || !r.demo) : [];
  if (!data || (hideEmpty && !all.length)) return null;
  const list = all.filter((r) => tab === "all" || r.author_role === tab).slice(0, limit || 999);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {tabs && data.reviews.length > 0 && <Tabs label="Отзывы" value={tab} onChange={setTab}
          items={[{ id: "all", title: "Все" }, { id: "teacher", title: "Преподаватели" }, { id: "student", title: "Ученики" }, { id: "parent", title: "Родители" }]} />}
        {data.average && <div className="flex items-center gap-3"><span className="num font-display text-4xl font-extrabold">{data.average.toFixed(1)}</span><span><Stars value={Math.round(data.average)} /><span className="block text-xs text-ink-mute">{data.count} отзывов</span></span></div>}
      </div>
      {list.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => (
            <figure key={r.id} className="card card-hover relative flex flex-col">
              <Quote aria-hidden="true" size={38} className="absolute right-5 top-5 text-line" />
              <div className="flex items-center justify-between"><Stars value={r.rating} />{r.demo && <span className="chip">пример</span>}</div>
              <blockquote className="mt-3 flex-1 text-ink-soft">«{r.text}»</blockquote>
              <figcaption className="mt-5 flex items-center gap-3"><Avatar name={r.author_name.replace(/^Пример:\s*/, "")} size={38} />
                <span><span className="block text-sm font-bold">{r.author_name}</span><span className="text-xs text-ink-mute">{ROLE[r.author_role]}</span></span></figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="card flex flex-col items-center py-12 text-center">
          <MessageSquareHeart size={32} className="text-ink-mute" />
          <h3 className="mt-3 text-xl">Здесь будут отзывы</h3>
          <p className="mt-2 max-w-md text-sm text-ink-mute">Публикуем только настоящие отзывы преподавателей, учеников и родителей – после проверки. Оставить отзыв можно в кабинете.</p>
        </div>
      )}
    </div>
  );
}
