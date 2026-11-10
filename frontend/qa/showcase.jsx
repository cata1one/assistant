import React from "react";
import { createRoot } from "react-dom/client";
import "../src/index.css";
import Logo from "../src/ui/Logo.jsx";
import Board from "../src/board/Board.jsx";
import UnitPlayer from "../src/app/player.jsx";
import { BookShelf } from "../src/app/books.jsx";
import { SessionContext } from "../src/lib/session.js";
import demo from "./demo-data.json";
import { StudentHome, WordsHub } from "../src/app/student.jsx";
import { SparkPage } from "../src/app/spark.jsx";
import { MessagesPage } from "../src/app/common.jsx";

const mode = new URLSearchParams(location.search).get("mode") || "board";
const check = async () => ({ blocks: {}, score: 0, total: 0 });
const lesson = demo.unit;
const words = lesson.blocks.find(b => b.type === "words");
const practice = { ...lesson, blocks: lesson.blocks.filter(b => b.type === "choice").slice(0, 1) };
const unit = mode === "words" ? { ...lesson, blocks: [words] } : mode === "lesson" ? lesson : practice;
const board = ["board", "stickers"].includes(mode);
const student = ["home", "today", "words", "chat", "spark"].includes(mode);

function Showcase() {
 return <SessionContext.Provider value={{ role: student ? "student" : "tutor", account: { name: "Миша", prefs:{} }, me:{ chats:[{chat_id:"pair:demo",title:"Анна",role:"student",language:"en"}], lessons:[] } }}>
  <div style={{ minHeight:"100vh", background:"#FAFAF8" }}>
   <header className="flex items-center gap-5 border-b border-line bg-white px-5 py-3"><Logo size={32} /><span className="ml-auto text-xs text-ink-mute">Пример урока · English B1</span></header>
   <div className="flex" style={{ minHeight:"calc(100vh - 69px)" }}>
    <aside className="hidden w-44 shrink-0 border-r border-line bg-white px-5 py-7 text-sm md:block">
     <p className="mb-6 text-xs font-semibold uppercase tracking-wider text-ink-mute">Мой класс</p>
     {["Сегодня", "Ученики", "Уроки", "Материалы", "Сообщения"].map(t => <p key={t} className={`mb-2 rounded-xl px-3 py-2 ${(board ? t === "Уроки" : t === "Материалы") ? "bg-study-soft font-semibold text-study-deep" : "text-ink-soft"}`}>{t}</p>)}
     <p className="mt-10 text-xs leading-relaxed text-ink-mute">Идеи, практика<br />и немного открытий.</p>
    </aside>
    <main className="min-w-0 flex-1 p-4 sm:p-6">
     {!student && <><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">ENGLISH / B1</p>
     <h1 className="mb-2 text-2xl sm:text-3xl">{board ? "Making plans together" : mode === "courses" ? "Учебники Bright" : mode === "words" ? "Слова сегодняшнего урока" : "Making decisions"}</h1>
     <p className="mb-5 text-sm text-ink-mute">{board ? "Доска урока: обсуждаем поездку, собираем идеи и договариваемся." : mode === "courses" ? "От первого разговора до точной аргументации. Выберите свой следующий шаг." : "Планы на выходные: прочитайте ситуацию и найдите подходящий ответ."}</p></>}
     {mode === "home" || mode === "today" ? <StudentHome /> : mode === "words" ? <WordsHub route={{parts:["words"]}} /> : mode === "spark" ? <SparkPage /> : mode === "chat" ? <MessagesPage /> : board ? <Board boardId="showcase" height="620px" /> : mode === "courses" ? <BookShelf books={demo.books} onOpen={() => {}} /> : <UnitPlayer unit={unit} onSubmit={check} readOnly />}
    </main>
   </div>
  </div>
 </SessionContext.Provider>;
}
createRoot(document.getElementById("root")).render(<Showcase />);
