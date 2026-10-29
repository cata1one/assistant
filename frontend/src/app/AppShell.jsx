import {
  Activity, BookOpen, Building2, CreditCard, FileStack, GraduationCap, Home, Layers, LogOut, Menu, MessagesSquare, NotebookPen, Search,
  Settings, ShieldAlert, Shield, Sparkles, Users, Wallet, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "../lib/session.js";
import Help from "../site/Help.jsx";
import { Loading } from "../ui/kit.jsx";
import Logo from "../ui/Logo.jsx";
import BoardPage from "./BoardPage.jsx";
import { LessonsHub, MessagesPage, ProfilePage } from "./common.jsx";
import { ProfileAvatar, THEMES } from "./decor.jsx";
import { HomeworkPage } from "./homework.jsx";
import Lesson from "./Lesson.jsx";
import { LessonPayPage } from "./lessonpay.jsx";
import { MaterialsHub } from "./materials.jsx";
import Room from "./Room.jsx";
import { AdminPage, SchoolHome, SchoolLessonsPage, SignalsPage, SystemPage, TutorsPage } from "./school.jsx";
import { SparkPage } from "./spark.jsx";
import { ParentHome, StudentHome, WordsHub } from "./student.jsx";
import { BillingStatus, PlanPage, StudentsPage, TutorHome } from "./tutor.jsx";
import { CoursesPage, DoUnit, UnitEditor } from "./units.jsx";

/*
 * Разделы кабинета по ролям: [id, название, иконка, страница, место в нижней панели телефона (0 – только в «Ещё»), ссылка].
 * Порядок – по частоте использования: то, что нужно каждый день, наверху.
 */
const NAV = {
  tutor: [
    ["home", "Сегодня", Home, TutorHome, 1],
    ["students", "Ученики", Users, StudentsPage, 2],
    ["lessons", "Уроки и доски", BookOpen, LessonsHub, 3],
    ["messages", "Сообщения", MessagesSquare, MessagesPage, 4],
    ["materials", "Материалы", FileStack, MaterialsHub, 0],
    ["homework", "Домашка", NotebookPen, HomeworkPage, 0],
    ["spark", "Искорка", Sparkles, SparkPage, 0],
    ["pay", "Оплата занятий", Wallet, LessonPayPage, 0],
    ["find", "Заявки учеников", Search, null, 0, "#/market?tab=students"],
    ["plan", "Тариф", CreditCard, PlanPage, 0],
    ["profile", "Профиль", Settings, ProfilePage, 0],
  ],
  student: [
    ["home", "Сегодня", Home, StudentHome, 1],
    ["lessons", "Уроки", BookOpen, LessonsHub, 2],
    ["words", "Слова", Layers, WordsHub, 3],
    ["messages", "Сообщения", MessagesSquare, MessagesPage, 4],
    ["homework", "Домашка", NotebookPen, HomeworkPage, 0],
    ["courses", "Курсы Bright", GraduationCap, CoursesPage, 0],
    ["spark", "Искорка", Sparkles, SparkPage, 0],
    ["find", "Найти преподавателя", Search, null, 0, "#/market"],
    ["profile", "Профиль и оформление", Settings, ProfilePage, 0],
  ],
  parent: [
    ["home", "Обзор", Home, ParentHome, 1],
    ["lessons", "Отчёты", BookOpen, LessonsHub, 2],
    ["homework", "Домашка", NotebookPen, HomeworkPage, 3],
    ["messages", "Сообщения", MessagesSquare, MessagesPage, 4],
    ["spark", "Искорка", Sparkles, SparkPage, 0],
    ["profile", "Профиль", Settings, ProfilePage, 0],
  ],
  school: [
    ["home", "Обзор", Building2, SchoolHome, 1],
    ["tutors", "Преподаватели", Users, TutorsPage, 2],
    ["signals", "Сигналы", ShieldAlert, SignalsPage, 3],
    ["messages", "Сообщения", MessagesSquare, MessagesPage, 4],
    ["lessons", "Уроки", BookOpen, SchoolLessonsPage, 0],
    ["materials", "Материалы школы", FileStack, MaterialsHub, 0],
    ["pay", "Оплата занятий", Wallet, LessonPayPage, 0],
    ["spark", "Искорка", Sparkles, SparkPage, 0],
    ["plan", "Тариф", CreditCard, PlanPage, 0],
    ["profile", "Профиль", Settings, ProfilePage, 0],
  ],
  admin: [
    ["home", "Модерация", Shield, AdminPage, 1],
    ["system", "Система", Activity, SystemPage, 2],
    ["lessons", "Уроки", BookOpen, LessonsHub, 3],
    ["messages", "Переписки", MessagesSquare, MessagesPage, 4],
    ["profile", "Профиль", Settings, ProfilePage, 0],
  ],
};
// Старые адреса разделов ведут в новые
const ALIAS = { boards: "lessons", units: "materials", cards: "words", do: "homework" };
const ROLE_TITLE = { tutor: "Преподаватель", student: "Ученик", parent: "Родитель", school: "Онлайн-школа", admin: "Администратор" };

const hrefOf = (id, href) => href || `#/app/${id === "home" ? "" : id}`;

function Badge({ n }) {
  return n > 0 ? <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-md bg-ink px-1 text-[11px] font-semibold text-white">{n}</span> : null;
}

function Sidebar({ items, current, session }) {
  const unread = session.me?.unread || 0;
  const b = session.account?.billing;
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-white px-3 py-5 lg:flex">
      <a href="#/" className="px-2.5" aria-label="На сайт"><Logo size={28} school={session.role === "school"} /></a>
      <nav aria-label="Кабинет" className="mt-7 grid gap-0.5">
        {items.map(([id, title, Icon, , , href]) => (
          <a key={id} href={hrefOf(id, href)} aria-current={current === id ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-[14px] font-medium transition ${current === id ? "bg-cream text-ink" : "text-ink-soft hover:bg-cream/70 hover:text-ink"}`}>
            <Icon size={18} strokeWidth={current === id ? 2.2 : 1.8} className={current === id ? "text-brand" : ""} />{title}
            {id === "messages" && <Badge n={unread} />}
          </a>
        ))}
      </nav>
      <div className="mt-auto grid gap-2">
        {["tutor", "school"].includes(session.role) && b?.state && b.state !== "free" && !b.by_school && (
          <a href="#/app/plan" className={`rounded-xl px-3 py-2.5 text-[13px] font-medium ${b.state === "expired" ? "bg-teach-tint text-teach-deep" : "bg-cream text-ink-soft"}`}>
            {{ trial: `Пробный период: ${b.days_left + 1} дн.`, active: `Тариф до ${new Date(b.until).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`, expired: "Тариф закончился. Продлить" }[b.state]}
          </a>
        )}
        <a href="#/app/profile" className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-cream">
          <ProfileAvatar prefs={session.account?.prefs} name={session.account?.name || "?"} size={34} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{session.account?.name || "Вход через Telegram"}</span>
            <span className="block truncate text-xs text-ink-mute">{session.account?.org?.name || ROLE_TITLE[session.role]}</span>
          </span>
        </a>
        <button type="button" onClick={() => { session.logout(); window.location.hash = "#/"; }} className="flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-ink-mute hover:text-ink"><LogOut size={13} /> Выйти</button>
      </div>
    </aside>
  );
}

/** Нижняя панель на телефоне: четыре главных раздела и «Ещё» со всем остальным. */
function TabBar({ items, current, unread }) {
  const [open, setOpen] = useState(false);
  const tabs = items.filter((x) => x[4]).sort((a, b) => a[4] - b[4]);
  const more = items.filter((x) => !x[4]);
  useEffect(() => setOpen(false), [current]);
  const moreActive = more.some(([id]) => id === current);
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden" onClick={() => setOpen(false)}>
          <div className="safe-bottom absolute inset-x-0 bottom-0 rounded-t-4xl bg-white px-3 pb-20 pt-3 animate-fadeup" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <nav aria-label="Ещё" className="grid grid-cols-3 gap-1.5">
              {more.map(([id, title, Icon, , , href]) => (
                <a key={id} href={hrefOf(id, href)} className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center text-[12px] font-medium ${current === id ? "bg-cream text-ink" : "text-ink-soft"}`}>
                  <Icon size={21} strokeWidth={1.8} />{title}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}
      <nav aria-label="Кабинет" className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white/95 px-1 pt-1 backdrop-blur lg:hidden">
        {tabs.map(([id, title, Icon, , , href]) => (
          <a key={id} href={hrefOf(id, href)} aria-current={current === id ? "page" : undefined}
            className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-medium ${current === id ? "text-ink" : "text-ink-mute"}`}>
            <Icon size={22} strokeWidth={current === id ? 2.2 : 1.7} />
            <span className="w-full truncate text-center">{title.split(" ")[0]}</span>
            {id === "messages" && unread > 0 && <span className="absolute right-[22%] top-0.5 h-2 w-2 rounded-full bg-teach" />}
          </a>
        ))}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-medium ${open || moreActive ? "text-ink" : "text-ink-mute"}`}>
          {open ? <X size={22} /> : <Menu size={22} strokeWidth={1.7} />}<span>Ещё</span>
        </button>
      </nav>
    </>
  );
}

function MobileTop({ session, title }) {
  return (
    <header className="safe-top sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
      <a href="#/app" aria-label="Сегодня"><Logo size={26} school={session.role === "school"} /></a>
      <span className="ml-1 min-w-0 flex-1 truncate text-sm font-semibold text-ink-mute">{title}</span>
      <a href="#/app/profile" aria-label="Профиль"><ProfileAvatar prefs={session.account?.prefs} name={session.account?.name || "?"} size={30} /></a>
    </header>
  );
}

export default function AppShell({ route }) {
  const session = useSession();
  const [area, rawSub] = route.parts;
  const needLogin = !session.loading && !session.role;
  useEffect(() => { if (needLogin) window.location.replace("#/login"); }, [needLogin]);
  // Начатый преподавателем урок и новые сообщения появляются без перезагрузки страницы
  useEffect(() => {
    if (!session.role || area === "room") return undefined;
    const t = setInterval(() => { if (document.visibilityState === "visible") session.reload(); }, 15000);
    return () => clearInterval(t);
  }, [session.role, area]); // eslint-disable-line react-hooks/exhaustive-deps
  if (session.loading || needLogin) return <div className="grid min-h-screen place-items-center"><Loading /></div>;

  if (area === "room" && rawSub) return <Room id={rawSub} />;
  const items = NAV[session.role] || NAV.student;
  const third = route.parts[2];
  const sub = ALIAS[rawSub] && !(rawSub === "units" && third) && !(rawSub === "do" && third) ? ALIAS[rawSub] : rawSub;
  let current = area === "app" ? (rawSub === "do" ? "homework" : rawSub === "units" && third ? "materials" : sub || "home") : area === "board" ? "lessons" : "lessons";
  let Page = items.find(([id]) => id === current)?.[3];
  if (!Page && area === "app") { current = "home"; Page = items[0][3]; }
  const title = items.find(([id]) => id === current)?.[1] || "";
  const student = session.role === "student";
  return (
    <div className="flex min-h-screen bg-cream" style={student ? { background: (THEMES[session.account?.prefs?.theme] || THEMES.default).bg } : undefined}>
      <Sidebar items={items} current={current} session={session} />
      <div className="min-w-0 flex-1">
        <MobileTop session={session} title={title} />
        <main className={`mx-auto px-4 pb-28 pt-5 md:px-8 md:pt-8 lg:pb-12 ${area === "board" ? "max-w-none" : "max-w-[1120px]"}`}>
          {["tutor", "school"].includes(session.role) && session.account?.billing?.state === "expired" && area === "app" && sub !== "plan" && <BillingStatus billing={session.account?.billing} compact />}
          {area === "lesson" && rawSub ? <Lesson id={rawSub} /> : area === "board" ? <BoardPage params={route.params} />
            : rawSub === "units" && third ? <UnitEditor id={third} /> : rawSub === "do" && third ? <DoUnit hwId={third} /> : <Page route={route} />}
        </main>
      </div>
      <TabBar items={items} current={current} unread={session.me?.unread || 0} />
      {area !== "board" && <Help className="hidden lg:block" />}
    </div>
  );
}
