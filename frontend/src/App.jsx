import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import Aurora from "./components/Aurora.jsx";
import Footer from "./components/Footer.jsx";
import Navbar from "./components/Navbar.jsx";
import { ErrorBox, Loading, PageHead } from "./components/ui.jsx";
import { request } from "./lib/api.js";
import { AudienceContext, loadAudience, saveAudience } from "./lib/audience.js";
import { Market, MarketMy, MarketNew } from "./pages/Market.jsx";
import ReviewsPage from "./pages/ReviewsPage.jsx";
import { CatalogContext } from "./lib/catalog.js";
import { useRoute } from "./lib/router.js";
import Apply from "./pages/Apply.jsx";
import Board from "./pages/Board.jsx";
import Cabinet from "./pages/Cabinet.jsx";
import { Chinese, Course, Courses, Exams, How } from "./pages/Catalog.jsx";
import Home from "./pages/Home.jsx";
import Lesson from "./pages/Lesson.jsx";
import Room from "./pages/Room.jsx";

const ACTIVE = { course: "courses", lesson: "cabinet", room: "cabinet", apply: "" };

function Page({ name, parts, params }) {
  switch (name) {
    case "home": return <Home />;
    case "courses": return <Courses params={params} />;
    case "chinese": return <Chinese />;
    case "exams": return <Exams />;
    case "course": return <Course id={parts[1]} />;
    case "how": return <How />;
    case "apply": return <Apply params={params} />;
    case "board": return <Board params={params} />;
    case "cabinet": return <Cabinet params={params} />;
    case "lesson": return <Lesson id={parts[1]} />;
    case "room": return <Room id={parts[1]} />;
    case "reviews": return <ReviewsPage />;
    case "market":
      if (parts[1] === "new") return <MarketNew />;
      if (parts[1] === "my") return <MarketMy params={params} />;
      return <Market params={params} />;
    default: return <PageHead title="Страница не найдена"><a className="link mt-6 inline-block" href="#/">На главную</a></PageHead>;
  }
}

export default function App({ lenis }) {
  const { parts, params } = useRoute();
  const name = parts[0] || "home";
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(null);
  const [audience, setAud] = useState(loadAudience);
  const audienceValue = useMemo(() => ({ audience, setAudience: (a) => { setAud(a); saveAudience(a); } }), [audience]);

  useEffect(() => { request("GET", "/site/v1/catalog").then(setCatalog).catch(setError); }, []);
  // Смена страницы — сразу наверх (Lenis прокручивает без анимации)
  useEffect(() => { lenis ? lenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0); }, [name, parts[1], params.get("id")]); // eslint-disable-line

  const key = `${name}/${parts[1] || ""}/${params.get("id") || ""}/${name === "courses" ? params.get("cat") || "" : ""}`;
  return (
    <AudienceContext.Provider value={audienceValue}>
    <CatalogContext.Provider value={catalog}>
      <Aurora />
      <div className="noise" aria-hidden="true" />
      <Navbar active={ACTIVE[name] ?? name} />
      <main className="mx-auto min-h-[70vh] max-w-6xl px-4 md:px-6">
        {error ? <div className="pt-36"><ErrorBox error={error} /></div> : !catalog ? <div className="pt-36"><Loading /></div> : (
          <AnimatePresence mode="wait">
            {/* Переход между страницами: короткий fade + blur */}
            <motion.div key={key} initial={{ opacity: 0, filter: "blur(8px)" }} animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }} transition={{ duration: 0.35, ease: "easeOut" }}>
              <Page name={name} parts={parts} params={params} />
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      {catalog && <Footer />}
    </CatalogContext.Provider>
    </AudienceContext.Provider>
  );
}
