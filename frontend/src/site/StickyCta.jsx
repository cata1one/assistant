import { useEffect, useState } from "react";
import { firstMonth, PRICE } from "../lib/pricing.js";
import { useSession } from "../lib/session.js";

/** Полоса с кнопкой внизу экрана на телефоне: появляется после прокрутки и только для тех, кто ещё не зарегистрирован. */
export default function StickyCta({ name }) {
  const session = useSession();
  const [show, setShow] = useState(false);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 700);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  if (session.role || closed || !["", "teach", "pricing"].includes(name) || !show) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-full border border-line bg-white/95 py-2 pl-5 pr-2 shadow-lift backdrop-blur md:hidden" data-brand="teach">
      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{PRICE.trialDays} дня бесплатно <span className="font-normal text-ink-mute">или {firstMonth()} ₽ сразу</span></p>
      <a href="#/register?role=tutor&start=trial" className="btn-brand btn-sm">Попробовать</a>
      <button type="button" className="px-2 text-ink-mute" onClick={() => setClosed(true)} aria-label="Скрыть">×</button>
    </div>
  );
}
