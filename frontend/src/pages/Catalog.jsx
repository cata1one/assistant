import { ArrowLeft, ArrowUpRight, BookOpen, Lock, MessagesSquare, NotebookPen, Users, Video } from "lucide-react";
import { useState } from "react";
import MagneticButton from "../components/MagneticButton.jsx";
import { Reveal, Stagger, StaggerItem } from "../components/Reveal.jsx";
import { Bullets, CourseCard, PageHead, Panel, SectionHead, Segmented } from "../components/ui.jsx";
import { botUrl, categoryById, categoryHref, courseById, useCatalog } from "../lib/catalog.js";
import { replaceHash } from "../lib/router.js";
import { Steps } from "./Home.jsx";

function Grid({ courses }) {
  return (
    <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" gap={0.05}>
      {courses.map((c) => <StaggerItem key={c.id}><CourseCard c={c} /></StaggerItem>)}
    </Stagger>
  );
}

export function Courses({ params }) {
  const catalog = useCatalog();
  const [cat, setCat] = useState(params.get("cat") || "all");
  const tabs = [{ id: "all", title: "Все" }, ...catalog.categories];
  const pick = (id) => { setCat(id); replaceHash(`#/courses${id === "all" ? "" : `?cat=${id}`}`); };
  const list = catalog.courses.filter((x) => cat === "all" || x.category === cat);
  return (
    <>
      <PageHead eyebrow="Каталог" title="Направления" text="Выберите направление — программу подстроим под вашу цель на пробном уроке." />
      <div className="mb-8"><Segmented label="Категории" items={tabs} value={cat} onChange={pick} /></div>
      <Grid key={cat} courses={list} />
    </>
  );
}

export function Chinese() {
  const catalog = useCatalog();
  const hsk = catalog.courses.filter((x) => x.hsk);
  return (
    <>
      <PageHead eyebrow="中文" title={<>Китайский <span className="text-aurora italic">и HSK</span></>}
        text="Китайский с нуля, деловой китайский и подготовка к HSK по всем уровням. Тоны и иероглифы — с первого урока, слова каждого урока попадают в ваш словарь с пиньинем и переводом." />
      <Reveal className="card mb-12 overflow-x-auto">
        <h3 className="text-2xl">Уровни HSK</h3>
        <p className="mt-1 text-sm text-zinc-500">Число слов — по новому стандарту HSK 3.0.</p>
        <table className="mt-6 w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[.15em] text-zinc-500">
            <tr><th className="pb-3 pr-4 font-medium">Уровень</th><th className="pb-3 pr-4 font-medium">Что умеете</th><th className="pb-3 text-right font-medium">Слов</th></tr>
          </thead>
          <tbody>
            {hsk.map((r) => (
              <tr key={r.id} className="group border-t border-white/5 transition-colors duration-300 hover:bg-white/[.03]">
                <td className="py-4 pr-4"><a className="font-display text-lg text-white transition-colors group-hover:text-violet-soft" href={`#/course/${r.id}`}>HSK {r.hsk}</a></td>
                <td className="py-4 pr-4 text-zinc-300">{r.short}</td>
                <td className="py-4 text-right font-mono text-zinc-200">{r.words ? r.words.toLocaleString("ru-RU") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      <SectionHead title="Программы" />
      <Grid courses={catalog.courses.filter((x) => x.category === "chinese")} />
    </>
  );
}

export function Exams() {
  const catalog = useCatalog();
  const exams = catalog.courses.filter((x) => x.exam);
  return (
    <>
      <PageHead eyebrow="Сертификаты" title="Международные экзамены"
        text="Готовим по официальному формату: пробные экзамены, разбор каждого задания, проверка письма и устной части по критериям экзаменаторов. Формат экзаменов иногда меняется — правила сверяем с сайтом организатора перед регистрацией." />
      <Reveal className="card mb-14 overflow-x-auto !p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[.15em] text-zinc-500">
            <tr>{["Экзамен", "Шкала", "Длительность", "Важно знать"].map((h) => <th key={h} className="px-6 pb-4 pt-6 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {exams.map((c) => (
              <tr key={c.id} className="group border-t border-white/5 align-top transition-colors duration-300 hover:bg-white/[.03]">
                <td className="px-6 py-4"><a href={`#/course/${c.id}`} className="font-semibold text-white transition-colors group-hover:text-violet-soft">{c.exam.name}</a></td>
                <td className="px-6 py-4 text-zinc-300">{c.exam.scale || "—"}</td>
                <td className="px-6 py-4 text-zinc-300">{c.exam.duration || "—"}</td>
                <td className="px-6 py-4">{c.exam.note || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
      <SectionHead title="Программы подготовки" />
      <Grid courses={catalog.courses.filter((x) => x.category === "exams" || x.hsk)} />
    </>
  );
}

export function Course({ id }) {
  const catalog = useCatalog();
  const c = courseById(catalog, id);
  if (!c) return <PageHead title="Курс не найден"><a className="link mt-6 inline-block" href="#/courses">Все направления</a></PageHead>;
  const cat = categoryById(catalog, c.category) || {};
  const exam = c.exam ? [c.exam.name, c.exam.scale && `Шкала: ${c.exam.scale}`, c.exam.duration && `Длительность: ${c.exam.duration}`, c.exam.note].filter(Boolean) : null;
  return (
    <>
      <PageHead eyebrow={<a href={categoryHref(cat.id)} className="inline-flex items-center gap-2 hover:text-white"><ArrowLeft size={14} /> {cat.title}</a>}
        title={c.title} text={c.short}>
        <div className="mt-6 flex flex-wrap gap-2">{(c.levels || []).map((l) => <span key={l} className="chip chip-accent">{l}</span>)}</div>
      </PageHead>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Программа" icon={BookOpen}><Bullets items={c.program} /></Panel>
        <div className="grid gap-4">
          {c.for_whom && <Panel title="Кому подходит" icon={Users}><Bullets items={c.for_whom} /></Panel>}
          {c.result && <Panel title="Результат" icon={ArrowUpRight}><p className="text-zinc-300">{c.result}</p></Panel>}
          {exam && <Panel title="Об экзамене" icon={NotebookPen}><Bullets items={exam} /></Panel>}
          <Panel title="Как проходят занятия" icon={Video}>
            <Bullets items={["Уроки на платформе ProgressMe: учебник, доска и видеосвязь", "Связь с преподавателем — в Telegram через бота школы", "После урока — конспект, новые слова, тест и ДЗ"]} />
          </Panel>
        </div>
      </div>
      <div className="mt-10"><MagneticButton href={`#/apply?course=${c.id}`} className="!px-8 !py-4 text-base">Записаться на пробный урок <ArrowUpRight size={18} /></MagneticButton></div>
    </>
  );
}

export function How() {
  const catalog = useCatalog();
  const bot = botUrl(catalog);
  return (
    <>
      <PageHead eyebrow="Процесс" title="Как проходят уроки" />
      <Steps />
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <Panel title="Урок на ProgressMe" icon={Video}>
          <p className="text-zinc-300">Занятия идут на платформе ProgressMe: интерактивные учебники, общая доска, аудио и видео в одном окне. Ссылку на ваш класс выдаёт школа — она есть в личном кабинете и приходит в Telegram в начале урока.</p>
          <p className="mt-3 text-sm text-zinc-500">Урок записывается и расшифровывается: так собирается конспект, а школа отвечает за качество занятий.</p>
        </Panel>
        <Panel title="Переписка в Telegram" icon={MessagesSquare}>
          <p className="text-zinc-300">Вопросы, домашние задания и материалы — в чате с преподавателем через бота школы. Преподаватель не видит ваш номер и аккаунт, а вы — его.</p>
          {bot && <a className="btn-ghost btn-sm mt-5" href={bot} target="_blank" rel="noopener">Открыть бота школы <ArrowUpRight size={14} /></a>}
        </Panel>
        <Panel title="Материалы после урока" icon={NotebookPen}>
          <Bullets items={["Конспект: тема, правила с примерами, ключевые моменты", "Работа над ошибками", "Новые слова с переводом", "Тест для самопроверки", "Домашнее задание — от преподавателя и дополнительное по теме", "Что повторить к следующему уроку"]} />
        </Panel>
        <Panel title="Для родителей" icon={Users}>
          <p className="text-zinc-300">После каждого урока родители получают отчёт: что прошли, успехи, на что обратить внимание, замечания преподавателя и статус домашнего задания.</p>
        </Panel>
      </div>
      <Panel title="Безопасность и правила" icon={Lock} className="mt-4">
        <Bullets items={["Общение с преподавателем — только через бота школы и платформу уроков", "Обмен личными контактами (телефон, почта, мессенджеры) запрещён и автоматически блокируется", "Оплата — только школе. Если преподаватель предлагает заниматься напрямую, сообщите администратору", "Записи и переписка хранятся у школы и используются для конспектов и контроля качества"]} />
      </Panel>
    </>
  );
}
