import { lazy, Suspense, useEffect } from "react";
import { setToken } from "./lib/api.js";
import { useRoute } from "./lib/router.js";
import { brandOf, SessionContext, useSessionState } from "./lib/session.js";
import Footer from "./site/Footer.jsx";
import Help from "./site/Help.jsx";
import StickyCta from "./site/StickyCta.jsx";
import Navbar from "./site/Navbar.jsx";
import Landing from "./site/Landing.jsx";
import { Loading } from "./ui/kit.jsx";

// Остальное грузится по требованию – главная открывается быстро даже на слабом телефоне
const Teach = lazy(() => import("./site/Teach.jsx"));
const Study = lazy(() => import("./site/Study.jsx"));
const Pricing = lazy(() => import("./site/Pricing.jsx"));
const Auth = lazy(() => import("./site/Auth.jsx"));
const ReviewsPage = lazy(() => import("./site/ReviewsPage.jsx"));
const Market = lazy(() => import("./site/Market.jsx"));
const AppShell = lazy(() => import("./app/AppShell.jsx"));

const PUBLIC = { "": Landing, teach: Teach, study: Study, pricing: Pricing, reviews: ReviewsPage, market: Market,
  login: Auth, register: Auth, join: Auth, forgot: Auth, reset: Auth };

export default function App() {
  const route = useRoute();
  const session = useSessionState();
  const name = route.parts[0] || "";

  // Старые ссылки: кабинет из Telegram-бота (#/cabinet?t=…) и разделы прошлой версии сайта
  useEffect(() => {
    if (name === "cabinet") {
      const t = route.params.get("t");
      if (t) { setToken(t); session.reload(); }
      window.location.replace("#/app");
    } else if (["courses", "exams", "chinese", "course", "how", "apply"].includes(name)) {
      window.location.replace(name === "apply" ? "#/market/new" : "#/");
    }
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  const inApp = ["app", "room", "lesson", "board"].includes(name);
  const brand = inApp ? brandOf(session.role) : name === "teach" || (name === "register" && ["tutor", "school"].includes(route.params.get("role"))) ? "teach" : "study";
  useEffect(() => { document.documentElement.dataset.brand = brand; }, [brand]);
  useEffect(() => { window.scrollTo(0, 0); }, [name, route.parts[1]]);

  const Page = PUBLIC[name];
  return (
    <SessionContext.Provider value={session}>
      {inApp ? (
        <Suspense fallback={<div className="p-10"><Loading /></div>}><AppShell route={route} /></Suspense>
      ) : (
        <div className="bg-mesh min-h-screen">
          <Navbar brand={brand} active={name} />
          <main className="mx-auto max-w-6xl px-4 md:px-6">
            <Suspense fallback={<div className="pt-32"><Loading /></div>}>
              {Page ? <Page route={route} brand={brand} /> : (
                <div className="py-40 text-center"><h1 className="text-4xl">Страница не найдена</h1><a href="#/" className="link mt-4 inline-block">На главную</a></div>
              )}
            </Suspense>
          </main>
          <Footer />
          <StickyCta name={name} />
          <Help />
        </div>
      )}
    </SessionContext.Provider>
  );
}
