import Lenis from "lenis";
import "lenis/dist/lenis.css";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// Плавный скролл Lenis — только если пользователь не просил уменьшить движение
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let lenis = null;
if (!reduce) {
  lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)), smoothWheel: true });
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App lenis={lenis} />
  </React.StrictMode>,
);
