import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Сборка кладётся прямо в tutor_assistant/web: Python-сервер раздаёт её как есть,
// поэтому на компьютере школы Node.js не нужен. Имена файлов плоские (/static/<имя>),
// так их отдаёт website.py.
export default defineConfig({
  plugins: [react()],
  base: "/static/",
  build: {
    outDir: "../tutor_assistant/web",
    emptyOutDir: true,
    assetsDir: "",
    cssCodeSplit: false,
    assetsInlineLimit: 0, // шрифты — файлами: CSP сайта не разрешает data:-шрифты
    rollupOptions: {
      output: {
        entryFileNames: "app.js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: (info) => (info.names?.[0] || info.name || "").endsWith(".css") ? "app.css" : "[name][extname]",
      },
    },
  },
  server: { proxy: { "/site": "http://127.0.0.1:8080" } },
});
