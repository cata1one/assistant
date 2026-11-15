import { ArrowRight, Globe2, MessagesSquare, Video } from "lucide-react";
import { useSession } from "../lib/session.js";
import { Loading } from "../ui/kit.jsx";
import PracticePage from "../app/Practice.jsx";

export default function Practice() {
  const session = useSession();
  const canJoin = ["student", "tutor"].includes(session.role);
  return <div className="pb-16 pt-28 md:pt-32">
    {session.loading ? <Loading /> : canJoin ? <PracticePage /> : <>
      <section className="practice-intro">
        <div><p className="eyebrow">ЯЗЫКИ ОБЪЕДИНЯЮТ</p>
          <h1>Разговор начинается здесь.</h1>
          <p>Найдите собеседников, выберите язык и тему, создайте свою комнату и практикуйтесь вместе.</p>
          {!session.role ? <div className="mt-7 flex flex-wrap gap-3"><a className="btn-brand btn-lg" href="#/login?next=practice">Войти в комнаты <ArrowRight size={18} /></a><a className="btn-light btn-lg" href="#/register?role=student&next=practice">Создать аккаунт</a></div>
            : <p className="mt-6 rounded-xl bg-white p-4 text-sm text-ink-soft">Для комнат нужен аккаунт ученика или преподавателя. Войдите в подходящий аккаунт.</p>}
        </div>
        <div className="practice-intro-art" aria-hidden="true"><Globe2 size={54} strokeWidth={1.2} /><span>Hello!</span><span>¡Hola!</span><span>你好</span><span>Bonjour</span></div>
      </section>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">{[[Globe2,"Выберите язык", "Найдите комнату по языку и уровню."], [MessagesSquare,"Найдите тему", "Обсудите то, что интересно именно вам."], [Video,"Общайтесь вместе", "Присоединяйтесь к разговору по видео."]].map(([Icon,title,description]) => <div key={title} className="card !p-5"><Icon className="text-brand" size={22} /><h2 className="mt-3 text-lg">{title}</h2><p className="mt-2 text-sm text-ink-soft">{description}</p></div>)}</div>
    </>}
  </div>;
}
