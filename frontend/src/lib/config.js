import { useEffect, useState } from "react";
import { request } from "./api.js";

// Публичные настройки сайта: почта поддержки, имя Telegram-бота, подключена ли онлайн-оплата.
const DEFAULT = { name: "Bright", support_email: "monework@mail.ru", bot: null, online_payments: false };
let cached = null;
let pending = null;

export function useConfig() {
  const [cfg, setCfg] = useState(cached || DEFAULT);
  useEffect(() => {
    if (cached) return;
    pending = pending || request("GET", "/site/v1/config").then((c) => { cached = { ...DEFAULT, ...c }; return cached; }).catch(() => DEFAULT);
    pending.then(setCfg);
  }, []);
  return cfg;
}
