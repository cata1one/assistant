import { BookOpen, Layers, NotebookPen, PartyPopper, Repeat, TriangleAlert, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { request } from "../lib/api.js";
import { ttsOf } from "../lib/langs.js";
import { useSession } from "../lib/session.js";
import { Bullets, Empty, ErrorBox, Loading, PageTitle, Stat } from "../ui/kit.jsx";
import { LessonList, LiveBanner, NotConnected, Panel, useApi } from "./common.jsx";
import { DecorHeader } from "./decor.jsx";
import { HolidayBanner, MoodCard } from "./extras.jsx";
import { StudentPayCard } from "./lessonpay.jsx";
import { speak } from "./player.jsx";

// == Ученик ===================================================================================
export function StudentHome() {
  const { account, me } = useSession();
  const cards = useApi("/site/v1/cards").data;
  const hw = useApi("/site/v1/homework").data?.homework || [];
  const titles = Object.fromEntries((me?.chats || []).map((c) => [c.chat_id, c.title]));
  const lessons = (me?.lessons || []).map((l) => ({ ...l, with: titles[l.chat_id] }));
  const tutors = (me?.chats || []).filter((c) => c.role === "student");
  const open = hw.filter((h) => h.status === "open");
  return (
    <>
      <PageTitle title={`Привет, ${(account?.name || "").split(" ")[0] || "друг"}!`}
        text={tutors.length ? `Ваш преподаватель: ${tutors.map((t) => t.title).join(", ")}` : null} />
      <HolidayBanner student />
      <DecorHeader prefs={account?.prefs} name={account?.name} />
      {!tutors.length && <NotConnected />}
      <LiveBanner lessons={lessons} />
      {tutors.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat value={cards?.stats.due ?? "–"} label="карточек повторить" />
            <Stat value={cards?.stats.learned ?? "–"} label="слов выучено" tone="mint" />
            <Stat value={open.length} label="открытых ДЗ" tone="sun" />
            <Stat value={lessons.filter((l) => l.status === "finished").length} label="уроков" tone="lilac" />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Panel title="Слова на сегодня" icon={Repeat}>
              {cards?.queue.length ? (
                <>
                  <p className="text-ink-soft">В очереди {cards.queue.length} {cards.queue.length === 1 ? "карточка" : "карточек"} – это займёт пару минут.</p>
                  <a href="#/app/cards" className="btn-brand mt-4">Повторить слова</a>
                </>
              ) : <p className="text-sm text-ink-mute">{cards?.stats.total ? "На сегодня всё повторено. Возвращайтесь завтра!" : "Новые слова с уроков появятся здесь."}</p>}
            </Panel>
            <Panel title="Домашнее задание" icon={NotebookPen} actions={<a href="#/app/homework" className="link text-sm">Все</a>}>
              {open.length ? <ul className="grid gap-2">{open.slice(0, 3).map((h) => <li key={h.id} className="line-clamp-2 rounded-2xl bg-cream px-4 py-3 text-sm">{h.text}</li>)}</ul>
                : <p className="text-sm text-ink-mute">Открытых заданий нет.</p>}
            </Panel>
            <StudentPayCard />
            <Panel title="Последние уроки" icon={BookOpen} className="lg:col-span-2"><LessonList lessons={lessons} limit={5} /></Panel>
            <div className="lg:col-span-2 lg:max-w-md"><MoodCard /></div>
          </div>
        </>
      )}
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

export function CardsPage() {
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
      <PageTitle title="Карточки" text="Слова уроков, домашних заданий и занятий попадают сюда сами. Трудные слова возвращаются чаще, лёгкие – реже." />
      <ErrorBox error={error} />
      {!data ? <Loading /> : !data.stats.total ? <Empty icon={Layers} title="Слов пока нет" text="Карточки пополняются сами: слова с уроков, из домашних заданий и занятий. Свои слова можно добавить в словаре." action={<a href="#/app/words" className="btn-light">Добавить слова</a>} /> : !card ? (
        <Empty icon={PartyPopper} title={done ? `Отлично! Повторено: ${done}` : "На сегодня всё"} text="Следующие карточки появятся, когда подойдёт время повторения." action={<a href="#/app/words" className="btn-light">Открыть словарь</a>} />
      ) : (
        <div className="mx-auto max-w-xl">
          <div className="mb-3 flex justify-between text-sm text-ink-mute"><span>Карточка {i + 1} из {data.queue.length}</span><span>{card.reps ? `повторений: ${card.reps}` : "новое слово"}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(i / data.queue.length) * 100}%` }} /></div>
          <button type="button" onClick={() => setShown(true)} className="card mt-5 flex min-h-[280px] w-full flex-col items-center justify-center text-center">
            <span className="font-display text-4xl font-extrabold md:text-5xl">{card.word}</span>
            {card.transcription && <span className="mt-2 text-ink-mute">{card.transcription}</span>}
            {shown ? (
              <span className="mt-6 animate-fadeup">
                <span className="block text-2xl font-bold text-brand">{card.translation || "–"}</span>
                {card.example && <span className="mt-2 block text-sm text-ink-soft">{card.example}</span>}
              </span>
            ) : <span className="mt-6 text-sm text-ink-mute">Вспомните перевод и нажмите, чтобы проверить (пробел)</span>}
          </button>
          <div className="mt-3 flex justify-center"><button type="button" className="btn-ghost btn-sm" onClick={() => speak(card.word.replace(/\s*\(.*\)$/, ""), ttsOf(langOf(card.word, card.chat_id, me?.chats)))}><Volume2 size={15} /> Произнести</button></div>
          {shown && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GRADES.map(([g, t, cls], n) => <button key={g} type="button" onClick={() => grade(g)} className={`rounded-2xl px-3 py-3 font-bold transition ${cls}`}>{t}<span className="block text-[10px] font-medium opacity-70">{n + 1}</span></button>)}
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
      <PageTitle title={`Здравствуйте, ${(account?.name || "").split(" ")[0] || ""}!`} text="Как идут занятия – без Telegram, прямо здесь." />
      <ErrorBox error={error} />
      {!data ? <Loading /> : !data.children.length ? <NotConnected /> : (
        <div className="grid gap-6">
          {data.children.map((c) => {
            const mine = hw.filter((h) => h.chat_id === c.chat_id);
            return (
              <section key={c.chat_id} className="grid gap-4">
                <h2 className="text-2xl">{c.name}</h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Stat value={c.lessons} label="уроков" />
                  <Stat value={c.words} label="слов в словаре" tone="mint" />
                  <Stat value={c.cards?.learned ?? 0} label="слов выучено" tone="lilac" />
                  <Stat value={`${mine.filter((h) => h.status !== "open").length}/${mine.length}`} label="ДЗ выполнено" tone="sun" />
                </div>
                {c.last ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Panel title={c.last.topic || "Последний урок"} icon={BookOpen}>
                      <p className="text-ink-soft">{c.last.summary}</p>
                      {c.last.achievements.length > 0 && <div className="mt-4"><p className="mb-2 text-sm font-bold text-[#146b4c]">Успехи</p><Bullets items={c.last.achievements} /></div>}
                      <a className="btn-brand btn-sm mt-5" href={`#/lesson/${c.last.lesson_id}`}>Полный отчёт</a>
                    </Panel>
                    <Panel title="Домашнее задание" icon={NotebookPen}>
                      {c.last.homework.length ? <Bullets items={c.last.homework} /> : <p className="text-sm text-ink-mute">Не задано.</p>}
                      {c.last.attention.length > 0 && <div className="mt-4"><p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[#7a5300]"><TriangleAlert size={14} /> Обратить внимание</p><Bullets items={c.last.attention} /></div>}
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
