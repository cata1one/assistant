import { ShieldCheck } from "lucide-react";
import Logo from "../ui/Logo.jsx";
import { LINKS } from "./Navbar.jsx";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-white/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.3fr_1fr_1fr] md:px-6">
        <div>
          <div className="flex flex-wrap gap-4"><span data-brand="teach"><Logo brand="teach" /></span><span data-brand="study"><Logo brand="study" /></span></div>
          <p className="mt-4 max-w-sm text-sm text-ink-mute">Платформа для уроков языков: созвон, доска, материалы, конспекты, домашние задания, карточки слов и отчёты родителям — в одном окне.</p>
        </div>
        <nav aria-label="Разделы в подвале">
          <ul className="grid gap-2 text-sm font-semibold text-ink-soft">
            {LINKS.map(([id, href, label]) => <li key={id}><a className="hover:text-ink" href={href}>{label}</a></li>)}
            <li><a className="hover:text-ink" href="#/login">Войти</a></li>
          </ul>
        </nav>
        <p className="flex gap-3 text-sm text-ink-mute">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-mint" />
          Ученики и родители видят только имя преподавателя. Аккаунты и контакты друг друга не раскрываются.
        </p>
      </div>
      <p className="pb-8 text-center text-xs text-ink-mute">© {new Date().getFullYear()} Better · BetterTeach и BetterStudy</p>
    </footer>
  );
}
