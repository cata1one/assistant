import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "../lib/session.js";
import Logo from "../ui/Logo.jsx";

export const LINKS = [
  ["teach", "#/teach", "Преподавателям"],
  ["study", "#/study", "Ученикам и родителям"],
  ["market", "#/market", "Найти преподавателя"],
  ["pricing", "#/pricing", "Тарифы"],
  ["reviews", "#/reviews", "Отзывы"],
];

export default function Navbar({ brand, active }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [active]);
  // Преподаватель ищет учеников, ученик — преподавателя
  const links = session?.role === "tutor" ? LINKS.map((l) => (l[0] === "market" ? ["market", "#/market?tab=students", "Найти ученика"] : l)) : LINKS;
  const startHref = brand === "teach" ? "#/register?role=tutor" : "#/register?role=student";
  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3">
      <nav aria-label="Разделы" className={`mx-auto flex max-w-6xl items-center gap-3 rounded-full px-3 py-2 transition-all duration-300 md:px-4 ${
        scrolled ? "glass" : "border border-transparent"}`}>
        <a href="#/" aria-label="На главную"><Logo brand={brand} /></a>
        <ul className="mx-auto hidden items-center gap-0.5 lg:flex">
          {links.map(([id, href, label]) => (
            <li key={id}>
              <a href={href} aria-current={active === id ? "page" : undefined}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${active === id ? "bg-white text-ink shadow-soft" : "text-ink-soft hover:bg-white/70 hover:text-ink"}`}>{label}</a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {session?.role ? <a href="#/app" className="btn-brand">Кабинет</a> : (
            <>
              <a href="#/login" className="btn-ghost hidden sm:inline-flex">Войти</a>
              <a href={startHref} className="btn-brand">Начать бесплатно</a>
            </>
          )}
          <button type="button" className="btn-light !p-2.5 lg:hidden" aria-label="Меню" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="glass mx-auto mt-2 max-w-6xl rounded-3xl p-2 lg:hidden">
          {links.map(([id, href, label]) => <a key={id} href={href} className="block rounded-2xl px-4 py-3 font-semibold text-ink-soft hover:bg-white">{label}</a>)}
          {!session?.role && <a href="#/login" className="block rounded-2xl px-4 py-3 font-semibold text-ink-soft hover:bg-white">Войти</a>}
        </div>
      )}
    </header>
  );
}
