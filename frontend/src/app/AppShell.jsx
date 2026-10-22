import {
  BookOpen, Building2, CreditCard, FileStack, Home, Layers, LogOut, MessagesSquare, NotebookPen, PenTool, Search, Settings,
  ShieldAlert, Shield, Sparkles, Users,
} from "lucide-react";
import { useEffect } from "react";
import { brandOf, useSession } from "../lib/session.js";
import { Loading } from "../ui/kit.jsx";
import Logo from "../ui/Logo.jsx";
import BoardPage from "./BoardPage.jsx";
import { BoardsPage, LessonsPage, MessagesPage, ProfilePage } from "./common.jsx";
import Lesson from "./Lesson.jsx";
import Room from "./Room.jsx";
import { AdminPage, SchoolHome, SchoolLessonsPage, SignalsPage, TutorsPage } from "./school.jsx";
import { HomeworkPage } from "./homework.jsx";
import { CardsPage, ParentHome, StudentHome } from "./student.jsx";
import { MaterialsPage, PlanPage, StudentsPage, TutorHome } from "./tutor.jsx";
import { DoUnit, UnitEditor, UnitsPage } from "./units.jsx";
import { WordsPage } from "./vocab.jsx";

// Разделы кабинета по ролям: [id, название, иконка, страница, показывать в нижней панели на телефоне]
const NAV = {
  tutor: [
    ["home", "Главная", Home, TutorHome, true],
    ["students", "Ученики", Users, StudentsPage, true],
    ["lessons", "Уроки", BookOpen, LessonsPage],
    ["boards", "Доски", PenTool, BoardsPage, true],
    ["units", "Занятия", Layers, UnitsPage],
    ["materials", "Материалы", FileStack, MaterialsPage],
    ["homework", "Домашка", NotebookPen, HomeworkPage],
    ["messages", "Сообщения", MessagesSquare, MessagesPage, true],
    ["find", "Найти учеников", Search, null, false, "#/market?tab=students"],
    ["plan", "Тариф", CreditCard, PlanPage],
    ["profile", "Профиль", Settings, ProfilePage],
  ],
  student: [
    ["home", "Главная", Home, StudentHome, true],
    ["lessons", "Уроки и конспекты", BookOpen, () => <LessonsPage title="Уроки и конспекты" />],
    ["homework", "Домашка", NotebookPen, HomeworkPage, true],
    ["cards", "Карточки", Layers, CardsPage, true],
    ["words", "Словарь", Sparkles, WordsPage],
    ["boards", "Доски", PenTool, BoardsPage],
    ["messages", "Сообщения", MessagesSquare, MessagesPage, true],
    ["find", "Найти преподавателя", Search, null, false, "#/market"],
    ["profile", "Профиль", Settings, ProfilePage],
  ],
  parent: [
    ["home", "Обзор", Home, ParentHome, true],
    ["lessons", "Отчёты", BookOpen, () => <LessonsPage title="Отчёты об уроках" />, true],
    ["homework", "Домашка", NotebookPen, HomeworkPage, true],
    ["messages", "Сообщения", MessagesSquare, MessagesPage, true],
    ["profile", "Профиль", Settings, ProfilePage],
  ],
  school: [
    ["home", "Обзор", Building2, SchoolHome, true],
    ["tutors", "Преподаватели", Users, TutorsPage, true],
    ["signals", "Сигналы", ShieldAlert, SignalsPage, true],
    ["lessons", "Уроки", BookOpen, SchoolLessonsPage],
    ["units", "Занятия", Layers, UnitsPage],
    ["materials", "База материалов", FileStack, MaterialsPage],
    ["messages", "Сообщения", MessagesSquare, MessagesPage, true],
    ["profile", "Профиль", Settings, ProfilePage],
  ],
  admin: [
    ["home", "Модерация", Shield, AdminPage, true],
    ["lessons", "Уроки", BookOpen, LessonsPage, true],
    ["messages", "Переписки", MessagesSquare, MessagesPage, true],
    ["profile", "Профиль", Settings, ProfilePage],
  ],
};

function Sidebar({ items, current, session }) {
  const unread = session.me?.unread || 0;
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white/70 px-3 py-5 backdrop-blur lg:flex">
      <a href="#/" className="px-3" aria-label="На сайт"><Logo brand={brandOf(session.role)} size={28} /></a>
      <nav aria-label="Кабинет" className="mt-7 grid gap-0.5">
        {items.map(([id, title, Icon, , , href]) => (
          <a key={id} href={href || `#/app/${id === "home" ? "" : id}`} aria-current={current === id ? "page" : undefined}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${current === id ? "bg-brand-tint text-brand-deep" : "text-ink-soft hover:bg-cream hover:text-ink"}`}>
            <Icon size={18} />{title}
            {id === "messages" && unread > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] text-white">{unread}</span>}
          </a>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl bg-cream p-3 text-sm">
        <p className="truncate font-bold">{session.account?.name || "Вход через Telegram"}</p>
        <p className="truncate text-xs text-ink-mute">{session.account?.org?.name || { tutor: "Частный репетитор", student: "Ученик", parent: "Родитель", school: "Школа", admin: "Администратор" }[session.role]}</p>
        <button type="button" onClick={() => { session.logout(); window.location.hash = "#/"; }} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-mute hover:text-ink"><LogOut size={13} /> Выйти</button>
      </div>
    </aside>
  );
}

function TabBar({ items, current }) {
  const tabs = items.filter((x) => x[4]).slice(0, 5);
  return (
    <nav aria-label="Кабинет" className="glass fixed inset-x-2 bottom-2 z-40 flex justify-around rounded-3xl px-1 py-1.5 lg:hidden">
      {tabs.map(([id, title, Icon]) => (
        <a key={id} href={`#/app/${id === "home" ? "" : id}`} aria-current={current === id ? "page" : undefined}
          className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-semibold ${current === id ? "text-brand" : "text-ink-mute"}`}>
          <Icon size={20} /><span className="w-full truncate text-center">{title.split(" ")[0]}</span>
        </a>
      ))}
    </nav>
  );
}

function MobileHeader({ items, current, brand }) {
  const more = items.filter((x) => !x[4]);
  return (
    <header className="flex items-center gap-2 px-4 pt-4 lg:hidden">
      <a href="#/" aria-label="На сайт"><Logo brand={brand} size={26} /></a>
      <details className="relative ml-auto">
        <summary className="btn-light btn-sm list-none">Ещё</summary>
        <div className="absolute right-0 z-50 mt-2 grid w-56 gap-0.5 rounded-2xl border border-line bg-white p-2 shadow-lift">
          {more.map(([id, title, Icon, , , href]) => (
            <a key={id} href={href || `#/app/${id}`} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold ${current === id ? "bg-brand-tint text-brand-deep" : "text-ink-soft"}`}><Icon size={16} />{title}</a>
          ))}
        </div>
      </details>
    </header>
  );
}

export default function AppShell({ route }) {
  const session = useSession();
  const [area, sub] = route.parts;
  const needLogin = !session.loading && !session.role;
  useEffect(() => { if (needLogin) window.location.replace("#/login"); }, [needLogin]);
  // Начатый преподавателем урок и новые сообщения появляются без перезагрузки страницы
  useEffect(() => {
    if (!session.role || area === "room") return undefined;
    const t = setInterval(() => { if (document.visibilityState === "visible") session.reload(); }, 15000);
    return () => clearInterval(t);
  }, [session.role, area]); // eslint-disable-line react-hooks/exhaustive-deps
  if (session.loading || needLogin) return <div className="grid min-h-screen place-items-center"><Loading /></div>;

  if (area === "room" && sub) return <Room id={sub} />;
  const items = NAV[session.role] || NAV.student;
  const third = route.parts[2];
  let current = area === "app" ? (sub === "do" ? "homework" : sub || "home") : area === "board" ? "boards" : "lessons";
  let Page = items.find(([id]) => id === current)?.[3];
  if (!Page && area === "app") { current = "home"; Page = items[0][3]; }
  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar items={items} current={current} session={session} />
      <div className="min-w-0 flex-1">
        <MobileHeader items={items} current={current} brand={brandOf(session.role)} />
        <main className={`mx-auto px-4 pb-28 pt-6 md:px-8 lg:pb-10 ${area === "board" ? "max-w-none" : "max-w-6xl"}`}>
          {area === "lesson" && sub ? <Lesson id={sub} /> : area === "board" ? <BoardPage params={route.params} />
            : sub === "units" && third ? <UnitEditor id={third} /> : sub === "do" && third ? <DoUnit hwId={third} /> : <Page />}
        </main>
      </div>
      <TabBar items={items} current={current} />
    </div>
  );
}
