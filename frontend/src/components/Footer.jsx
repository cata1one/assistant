import { ShieldCheck } from "lucide-react";
import { useCatalog } from "../lib/catalog.js";
import CustomLogo from "./CustomLogo.jsx";
import { NAV } from "./Navbar.jsx";

export default function Footer() {
  const catalog = useCatalog();
  return (
    <footer className="relative mt-24 border-t border-white/10">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div>
          <CustomLogo />
          <p className="mt-4 max-w-sm text-sm">{catalog?.school_name && catalog.school_name !== "Better study"
            ? `${catalog.school_name}. ` : ""}Уроки — на платформе ProgressMe, переписка — в Telegram через бота школы.</p>
        </div>
        <nav aria-label="Разделы в подвале">
          <ul className="grid gap-2 text-sm">
            {NAV.map(([id, href, label]) => <li key={id}><a className="transition-colors duration-300 hover:text-white" href={href}>{label}</a></li>)}
          </ul>
        </nav>
        <p className="flex gap-3 text-sm">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-soft" />
          Общение с преподавателем — только через бота школы. Мы не передаём ваши контакты преподавателям.
        </p>
      </div>
      <p className="pb-10 text-center text-xs text-zinc-600">© {new Date().getFullYear()} Better study</p>
    </footer>
  );
}
