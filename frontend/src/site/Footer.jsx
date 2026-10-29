import { Mail, Send } from "lucide-react";
import { useConfig } from "../lib/config.js";
import Logo from "../ui/Logo.jsx";
import { LINKS } from "./Navbar.jsx";

export default function Footer() {
  const cfg = useConfig();
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-ink-mute">Рабочее место репетитора языков: урок с доской, конспект, домашка, слова, оплата занятий и заявки учеников. Ученики и родители видят только имя преподавателя.</p>
        </div>
        <nav aria-label="Разделы в подвале">
          <ul className="grid gap-2 text-sm text-ink-soft">
            <li><a className="hover:text-ink" href="#/">Преподавателям</a></li>
            {LINKS.map(([id, href, label]) => <li key={id}><a className="hover:text-ink" href={href}>{label}</a></li>)}
            <li><a className="hover:text-ink" href="#/login">Войти</a></li>
          </ul>
        </nav>
        <div className="grid content-start gap-2 text-sm text-ink-soft">
          <p className="font-semibold text-ink">Поддержка</p>
          <a className="inline-flex items-center gap-2 hover:text-ink" href={`mailto:${cfg.support_email}`}><Mail size={15} />{cfg.support_email}</a>
          {cfg.bot && <a className="inline-flex items-center gap-2 hover:text-ink" href={`https://t.me/${cfg.bot}`} target="_blank" rel="noreferrer"><Send size={15} />@{cfg.bot} в Telegram</a>}
          <p className="text-xs text-ink-mute">Отвечаем в течение дня. Или нажмите «?» в углу экрана.</p>
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-ink-mute">© {new Date().getFullYear()} Bright · <a className="hover:text-ink" href="#/privacy">Политика обработки персональных данных</a></p>
    </footer>
  );
}
