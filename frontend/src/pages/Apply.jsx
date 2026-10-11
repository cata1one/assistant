import { CheckCircle2, Send } from "lucide-react";
import { useState } from "react";
import MagneticButton from "../components/MagneticButton.jsx";
import { Reveal } from "../components/Reveal.jsx";
import { ErrorBox, Notice, PageHead } from "../components/ui.jsx";
import { request } from "../lib/api.js";
import { useCatalog } from "../lib/catalog.js";

export default function Apply({ params }) {
  const catalog = useCatalog();
  const [form, setForm] = useState({ name: "", contact: "", course_id: params.get("course") || "", level: "", goal: "",
    comment: "", website: "", consent: false });
  const [state, setState] = useState({ busy: false, done: false, error: null });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.contact.trim()) return setState({ ...state, error: new Error("Заполните имя и контакт для связи") });
    if (!form.consent) return setState({ ...state, error: new Error("Нужно согласие на обработку данных") });
    setState({ busy: true, done: false, error: null });
    try {
      await request("POST", "/site/v1/applications", { ...form, course_id: form.course_id || null });
      setState({ busy: false, done: true, error: null });
    } catch (err) {
      setState({ busy: false, done: false, error: err });
    }
  };

  return (
    <>
      <PageHead eyebrow="Бесплатно" title="Пробный урок" text="Определим уровень, обсудим цель и подберём преподавателя." />
      <Reveal className="card max-w-2xl">
        {state.done ? (
          <div role="status" className="flex flex-col items-start gap-4 py-6">
            <CheckCircle2 size={40} className="text-emerald-soft" />
            <h2 className="text-3xl">Спасибо! Заявка отправлена</h2>
            <p>Менеджер школы свяжется с вами в течение рабочего дня.</p>
          </div>
        ) : (
          <form className="grid gap-5" noValidate onSubmit={submit}>
            {state.error && <ErrorBox error={state.error} />}
            <label className="label">Как к вам обращаться
              <input className="field" type="text" required maxLength={80} autoComplete="name" value={form.name} onChange={set("name")} />
            </label>
            <label className="label">Телефон, Telegram или почта для связи с менеджером школы
              <input className="field" type="text" required maxLength={120} autoComplete="tel" value={form.contact} onChange={set("contact")} />
              <span className="text-xs font-normal text-zinc-500">Контакт видит только администратор школы, преподавателям он не передаётся.</span>
            </label>
            <label className="label">Направление
              <select className="field" value={form.course_id} onChange={set("course_id")}>
                <option value="">Пока не знаю — помогите выбрать</option>
                {catalog.categories.map((cat) => (
                  <optgroup key={cat.id} label={cat.title}>
                    {catalog.courses.filter((x) => x.category === cat.id).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="label">Уровень (если знаете)
                <input className="field" type="text" maxLength={40} placeholder="B1 или HSK 3" value={form.level} onChange={set("level")} />
              </label>
              <label className="label">Цель
                <input className="field" type="text" maxLength={300} placeholder="IELTS 7.0, собеседование…" value={form.goal} onChange={set("goal")} />
              </label>
            </div>
            <label className="label">Комментарий
              <textarea className="field min-h-[110px]" maxLength={1000} placeholder="Удобное время, возраст ученика, пожелания" value={form.comment} onChange={set("comment")} />
            </label>
            {/* Скрытое поле-ловушка для спам-ботов */}
            <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
              <label>Сайт<input type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} /></label>
            </div>
            <label className="flex items-start gap-3 text-sm text-zinc-300">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-violet" checked={form.consent} onChange={set("consent")} />
              Согласен на обработку персональных данных для связи по заявке
            </label>
            <div>
              <MagneticButton type="submit" className="!px-8 !py-3.5">{state.busy ? "Отправляем…" : <>Отправить заявку <Send size={16} /></>}</MagneticButton>
            </div>
          </form>
        )}
      </Reveal>
      {!state.done && <div className="mt-4 max-w-2xl"><Notice tone="info">Ответим в течение рабочего дня — по телефону или в Telegram, как вам удобно.</Notice></div>}
    </>
  );
}
