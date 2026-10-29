import { BookOpen, ChevronRight, Layers, NotebookPen, PartyPopper, Repeat, TriangleAlert, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { plural, request } from "../lib/api.js";
import { ttsOf } from "../lib/langs.js";
import { useSession } from "../lib/session.js";
import { Bullets, Empty, ErrorBox, Loading, PageTitle, Stat, Tabs } from "../ui/kit.jsx";
import { LessonList, LiveBanner, NotConnected, Panel, useApi } from "./common.jsx";
import { DecorHeader } from "./decor.jsx";
import { SparkMark } from "./spark.jsx";
import { Vocab } from "./vocab.jsx";
import { HolidayBanner, MoodCard } from "./extras.jsx";
import { StudentPayCard } from "./lessonpay.jsx";
import { speak } from "./player.jsx";

// == Ученик: «Сегодня» ==========================================================================
export function StudentHome() {
  const { account, me } = useSession();
  const cards = useApi("/site/v1/cards").data;
  const hw = useApi("/site/v1/homework").data?.homework || [];
  const titles = Object.fromEntries((me?.chats || []).map((c) => [c.chat_id, c.title]));
  const lessons = (me?.lessons || []).map((l) => ({ ...l, with: titles[l.chat_id] }));
  const tutors = (me?.chats || []).filter((c) => c.role === "student");
  const open = hw.filter((h) => h.status === "open");
  const due = cards?.queue.length || 0;
  const name = (account?.name || "").split(" ")[0] || "друг";
  return (
    <>
      <HolidayBanner student />
      <DecorHeader prefs={account?.prefs} name={account?.name} greeting={`Привет, ${name}!`}
        sub={tutors.length ? `Преподаватель: ${tutors.map((t) => t.title).join(", ")}` : null} />
      {!tutors.length && <NotConnected />}
      <LiveBanner lessons={lessons} />
      {tutors.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid content-start gap-4">
            <a href="#/app/words" className={`panel flex items-center gap-4 p-5 transition hover:border-ink/25 ${due ? "!border-ink !bg-ink text-white" : ""}`}>
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${due ? "bg-sun text-ink" : "bg-cream"}`}><Repeat size={22} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold leading-tight">{due ? `${due} ${plural(due, "слово", "слова", "слов")} на повтор` : "Слова повторены"}</span>
                <span className={`mt-0.5 block text-sm ${due ? "text-white/60" : "text-ink-mute"}`}>{due ? "Пара минут, и слова запомнятся надолго" : cards?.stats.total ? "Следующие карточки появятся завтра" : "Слова с уроков появятся здесь сами"}</span>
              </span>
              {due > 0 && <span className="btn-accent btn-sm hidden sm:inline-flex">Начать</span>}
              {due > 0 && <ChevronRight size={20} className="shrink-0 text-white/70 sm:hidden" />}
            </a>
            <Panel title="Домашка" icon={NotebookPen} actions={<a href="#/app/homework" className="text-[13px] font-medium text-ink-mute hover:text-ink">Все</a>}>
              {open.length ? (
                <ul className="-mx-2 grid">{open.slice(0, 4).map((h) => (
                  <li key={h.id}><a href={h.unit ? `#/app/do/${h.id}` : "#/app/homework"} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-cream">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-teach" />
                    <span className="line-clamp-2 min-w-0 flex-1 text-[15px]">{h.text}</span>
                    {h.due && <span className="chip shrink-0">до {new Date(h.due).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>}
                  </a></li>))}
                </ul>
              ) : <p className="py-1 text-sm text-ink-mute">Все задания сделаны. Можно позаниматься в <a className="link" href="#/app/courses">курсах Bright</a>.</p>}
            </Panel>
            <StudentPayCard />
            <Panel title="Последние уроки" icon={BookOpen} actions={<a href="#/app/lessons" className="text-[13px] font-medium text-ink-mute hover:text-ink">Все</a>}><LessonList lessons={lessons} limit={4} /></Panel>
          </div>
          <div className="grid content-start gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat value={cards?.stats.learned ?? "–"} label="слов выучено" />
              <Stat value={lessons.filter((l) => l.status === "finished").length} label="уроков" />
            </div>
            <a href="#/app/spark" className="panel flex items-center gap-3 !border-sun/60 !bg-sun-soft/60 p-4 transition hover:!border-sun">
              <SparkMark size={58} still={false} />
              <span className="min-w-0"><span className="block font-semibold">Спросить Искорку</span><span className="text-[13px] text-ink-mute">Объяснит правило, проверит слова, поболтает на языке</span></span>
            </a>
            <MoodCard />
          </div>
        </div>
      )}
    </>
  );
}

/** Слова: повторение карточками и весь словарь – в одном разделе. */
export function WordsHub({ route }) {
  const [tab, setTab] = useState(route?.parts?.[1] === "cards" ? "cards" : route?.parts?.[1] === "words" && route?.parts?.[2] === "all" ? "all" : "cards");
  return (
    <>
      <PageTitle title="Слова" text={tab === "cards" ? "Трудные слова возвращаются чаще, лёгкие – реже. Пара минут в день." : "Слова с уроков, из домашки и от преподавателя. Можно добавить свои и убрать лишние."}
        actions={<Tabs label="Раздел" value={tab} onChange={setTab} items={[{ id: "cards", title: "Повторять" }, { id: "all", title: "Мой словарь" }]} />} />
      {tab === "cards" ? <CardsPage embedded onAdd={() => setTab("all")} /> : <Vocab />}
    </>
  );
}

const GRADES = [
  ["again", "Не помню", "bg-teach-soft text-teach-deep hover:bg-teach-tint"],
  ["hard", "Трудно", "bg-sun-soft text-[#7a5300] hover:brightness-95"],
  ["good", "Помню", "bg-mint-soft text-[#146b4c] hover:brightness-95"],
  ["easy", "Легко", "bg-study-soft text-study hover:brightness-95"],
];

// Язык слова: язык ученика у этого преподавателя, иначе – по алфавиту слова
function langOf(word, chatId, chats) {
  const byChat = chats?.find((c) => c.chat_id === chatId)?.language;
  if (byChat) return byChat;
  if (/[\u4e00-\u9fff]/.test(word)) return "zh";
  if (/[\u0600-\u06ff]/.test(word)) return "ar";
  if (/[\u0900-\u097f]/.test(word)) return "hi";
  if (/[\u0370-\u03ff]/.test(word)) return "el";
  return "en";
}

export function CardsPage({ embedded, onAdd }) {
  const { me } = useSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(0);
  const load = () => request("GET", "/site/v1/cards").then((d) => { setData(d); setI(0); setShown(false); }).catch(setError);
  useEffect(() => { load(); }, []);
  const card = data?.queue[i];
  const grade = async (g) => {
    try { await request("POST", "/site/v1/cards/review", { key: card.key, grade: g }); } catch (x) { setError(x); return; }
    setDone((n) => n + 1); setShown(false);
    if (g === "again") setData((d) => ({ ...d, queue: [...d.queue, card] })); // вернётся в конце сессии
    setI((n) => n + 1);
  };
  useEffect(() => {
    const on = (e) => {
      if (!card) return;
      if (e.code === "Space") { e.preventDefault(); setShown(true); }
      if (shown && ["1", "2", "3", "4"].includes(e.key)) grade(GRADES[Number(e.key) - 1][0]);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  });
  return (
    <>
      {!embedded && <PageTitle title="Карточки" />}
      <ErrorBox error={error} />
      {!data ? <Loading /> : !data.stats.total ? <Empty icon={Layers} title="Слов пока нет" text="Карточки пополняются сами: слова с уроков, из домашних заданий и занятий. Свои слова можно добавить в словаре." action={<button type="button" className="btn-light" onClick={onAdd}>Добавить слова</button>} /> : !card ? (
        <Empty icon={PartyPopper} title={done ? `Отлично! Повторено: ${done}` : "На сегодня всё"} text="Следующие карточки появятся, когда подойдёт время повторения." action={<button type="button" className="btn-light" onClick={onAdd}>Открыть словарь</button>} />
      ) : (
        <div className="mx-auto max-w-xl">
          <div className="mb-3 flex justify-between text-sm text-ink-mute"><span>Карточка {i + 1} из {data.queue.length}</span><span>{card.reps ? `повторений: ${card.reps}` : "новое слово"}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-ink transition-all" style={{ width: `${(i / data.queue.length) * 100}%` }} /></div>
          <button type="button" onClick={() => setShown(true)} className="panel mt-5 flex min-h-[280px] w-full flex-col items-center justify-center p-6 text-center">
            <span className="font-display text-4xl font-bold md:text-5xl">{card.word}</span>
            {card.transcription && <span className="mt-2 text-ink-mute">{card.transcription}</span>}
            {shown ? (
              <span className="mt-6 animate-fadeup">
                <span className="block text-2xl font-semibold">{card.translation || "–"}</span>
                {card.example && <span className="mt-2 block text-sm text-ink-soft">{card.example}</span>}
              </span>
            ) : <span className="mt-6 text-sm text-ink-mute">Вспомните перевод и нажмите, чтобы проверить (пробел)</span>}
          </button>
          <div className="mt-3 flex justify-center"><button type="button" className="btn-ghost btn-sm" onClick={() => speak(card.word.replace(/\s*\(.*\)$/, ""), ttsOf(langOf(card.word, card.chat_id, me?.chats)))}><Volume2 size={15} /> Произнести</button></div>
          {shown && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GRADES.map(([g, t, cls], n) => <button key={g} type="button" onClick={() => grade(g)} className={`rounded-2xl px-3 py-3.5 font-semibold transition ${cls}`}>{t}<span className="hidden text-[10px] font-medium opacity-60 sm:block">{n + 1}</span></button>)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// == Родитель =================================================================================
export function ParentHome() {
  const { account } = useSession();
  const { data, error } = useApi("/site/v1/parent");
  const hw = useApi("/site/v1/homework").data?.homework || [];
  return (
    <>
      <PageTitle title={`Здравствуйте, ${(account?.name || "").split(" ")[0] || ""}!`} text="Как идут занятия: отчёты, домашка и слова." />
      <ErrorBox error={error} />
      {!data ? <Loading /> : !data.children.length ? <NotConnected /> : (
        <div className="grid gap-6">
          {data.children.map((c) => {
            const mine = hw.filter((h) => h.chat_id === c.chat_id);
            return (
              <section key={c.chat_id} className="grid gap-4">
                <h2 className="text-xl">{c.name}</h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat value={c.lessons} label="уроков" />
                  <Stat value={c.words} label="слов в словаре" />
                  <Stat value={c.cards?.learned ?? 0} label="слов выучено" />
                  <Stat value={`${mine.filter((h) => h.status !== "open").length}/${mine.length}`} label="домашек сделано" />
                </div>
                {c.last ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Panel title={c.last.topic || "Последний урок"} icon={BookOpen}>
                      <p className="text-ink-soft">{c.last.summary}</p>
                      {c.last.achievements.length > 0 && <div className="mt-4"><p className="mb-2 text-sm font-semibold text-mint">Успехи</p><Bullets items={c.last.achievements} /></div>}
                      <a className="btn-brand btn-sm mt-5" href={`#/lesson/${c.last.lesson_id}`}>Полный отчёт</a>
                    </Panel>
                    <Panel title="Домашнее задание" icon={NotebookPen}>
                      {c.last.homework.length ? <Bullets items={c.last.homework} /> : <p className="text-sm text-ink-mute">Не задано.</p>}
                      {c.last.attention.length > 0 && <div className="mt-4"><p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#8A6400]"><TriangleAlert size={14} /> Обратить внимание</p><Bullets items={c.last.attention} /></div>}
                    </Panel>
                  </div>
                ) : <Panel><p className="text-ink-mute">Отчёт появится здесь после первого урока.</p></Panel>}
              </section>
            );
          })}
          <div className="flex flex-wrap gap-2"><a href="#/app/messages" className="btn-light">Написать преподавателю</a><a href="#/app/lessons" className="btn-ghost">Все отчёты</a></div>
        </div>
      )}
    </>
  );
}
