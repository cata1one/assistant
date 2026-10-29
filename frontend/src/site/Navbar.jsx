import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PRICE } from "../lib/pricing.js";
import { useSession } from "../lib/session.js";
import Logo from "../ui/Logo.jsx";

export const LINKS = [
  ["study", "#/study", "Ученикам"],
  ["schools", "#/schools", "Онлайн-школам"],
  ["market", "#/market", "Заявки"],
  ["pricing", "#/pricing", "Тарифы"],
  ["download", "#/download", "Приложение"],
];

export default function Navbar({ active }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [active]);
  // Преподаватель ищет учеников, ученик – преподавателя
  const links = session?.role === "tutor" ? LINKS.map((l) => (l[0] === "market" ? ["market", "#/market?tab=students", "Заявки"] : l)) : LINKS;
  return (
    <header className={`fixed inset-x-0 top-0 z-40 border-b transition-colors ${scrolled || open ? "border-line bg-paper/95 backdrop-blur" : "border-transparent bg-paper"}`}>
      <nav aria-label="Разделы" className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-6">
        <a href="#/" aria-label="Bright, на главную" className="shrink-0"><Logo school={session?.role === "school"} /></a>
        <ul className="hidden items-center gap-1 lg:flex">
          {links.map(([id, href, label]) => (
            <li key={id}>
              <a href={href} aria-current={active === id ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-[15px] transition ${active === id ? "font-semibold text-ink" : "text-ink-soft hover:text-ink"}`}>{label}</a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          {session?.role ? <a href="#/app" className="btn-brand">Кабинет</a> : (
            <>
              <a href="#/login" className="btn-ghost hidden sm:inline-flex">Войти</a>
              <a href="#/register?role=tutor&start=trial" className="btn-brand hidden sm:inline-flex">{PRICE.trialDays} дня бесплатно</a>
            </>
          )}
          <button type="button" className="btn-ghost !px-2.5 lg:hidden" aria-label="Меню" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="border-t border-line bg-paper px-4 pb-5 pt-2 lg:hidden">
          {[["", "#/", "Преподавателям"], ...links].map(([id, href, label]) => <a key={id} href={href} className="block border-b border-line py-3.5 text-[17px] font-medium">{label}</a>)}
          {!session?.role && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <a href="#/login" className="btn-light btn-lg">Войти</a>
              <a href="#/register?role=tutor&start=trial" className="btn-brand btn-lg">Попробовать</a>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
