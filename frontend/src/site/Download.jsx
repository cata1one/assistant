import { Download as DownloadIcon, MonitorSmartphone, Share, SquarePlus } from "lucide-react";
import { useState } from "react";
import { useConfig } from "../lib/config.js";
import { isApp, platform, useInstall } from "../lib/install.js";
import { Phone, Section } from "./parts.jsx";

function Step({ n, children }) {
  return <li className="flex gap-3"><span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{n}</span><span className="text-ink-soft">{children}</span></li>;
}

export default function Download() {
  const cfg = useConfig();
  const install = useInstall();
  const [done, setDone] = useState(false);
  const os = platform();
  const ask = async () => setDone(await install.prompt());
  const installButton = install.canPrompt && !done && <button type="button" className="btn-brand btn-lg" onClick={ask}><SquarePlus size={18} />Установить приложение</button>;

  const android = (
    <div key="android" className="rounded-3xl border border-line bg-white p-6 md:p-8">
      <h2 className="text-2xl">Android</h2>
      <div className="mt-5 flex flex-wrap gap-3">
        {cfg.rustore_url && <a href={cfg.rustore_url} target="_blank" rel="noreferrer" className="btn-brand btn-lg">Открыть в RuStore</a>}
        {cfg.apk_url && <a href={cfg.apk_url} className={cfg.rustore_url ? "btn-light btn-lg" : "btn-brand btn-lg"}><DownloadIcon size={18} />Скачать APK</a>}
        {os === "android" && installButton}
      </div>
      {!cfg.rustore_url && !cfg.apk_url && (
        <p className="mt-1 text-ink-soft">Приложение готовится к публикации в RuStore. Пока его можно поставить из браузера, это займёт полминуты:</p>
      )}
      <ol className="mt-5 grid gap-3">
        <Step n="1">Откройте этот сайт в Chrome или Яндекс Браузере.</Step>
        <Step n="2">Нажмите меню <b>⋮</b> и выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.</Step>
        <Step n="3">Значок Bright появится рядом с другими приложениями. Входить заново не нужно.</Step>
      </ol>
    </div>
  );
  const ios = (
    <div key="ios" className="rounded-3xl border border-line bg-white p-6 md:p-8">
      <h2 className="text-2xl">iPhone и iPad</h2>
      <p className="mt-1 text-ink-soft">Ставится из Safari, App Store не нужен.</p>
      <ol className="mt-5 grid gap-3">
        <Step n="1">Откройте этот сайт в <b>Safari</b>.</Step>
        <Step n="2">Нажмите <b>«Поделиться»</b> <Share size={15} className="inline align-[-2px]" /> внизу экрана.</Step>
        <Step n="3">Выберите <b>«На экран „Домой“»</b> и нажмите «Добавить».</Step>
      </ol>
    </div>
  );
  const desktop = (
    <div key="desktop" className="rounded-3xl border border-line bg-white p-6 md:p-8">
      <h2 className="text-2xl">Компьютер</h2>
      <p className="mt-1 text-ink-soft">Bright работает в браузере, установка не обязательна. Для отдельного окна и значка на рабочем столе:</p>
      {os === "desktop" && installButton && <div className="mt-5">{installButton}</div>}
      <ol className="mt-5 grid gap-3">
        <Step n="1">Откройте сайт в Chrome, Edge или Яндекс Браузере.</Step>
        <Step n="2">Нажмите значок установки <MonitorSmartphone size={15} className="inline align-[-2px]" /> в адресной строке или «Установить Bright» в меню.</Step>
      </ol>
    </div>
  );
  const order = os === "ios" ? [ios, android, desktop] : os === "desktop" ? [desktop, android, ios] : [android, ios, desktop];

  return (
    <>
      <section className="grid items-center gap-12 pb-4 pt-28 md:pt-36 lg:grid-cols-[1.2fr_1fr]">
        <div className="animate-fadeup">
          <p className="text-sm font-medium text-ink-mute">Приложение</p>
          <h1 className="mt-4 text-[clamp(2.3rem,5.6vw,4rem)] leading-[1.04]">Bright на телефоне</h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft md:text-xl">Уроки, слова, домашка и сообщения преподавателю. Удобно, если занимаетесь с телефона или повторяете слова в дороге.</p>
          {isApp() ? <p className="mt-6 rounded-2xl bg-cream p-4 font-medium">Вы уже в приложении Bright.</p> : <div className="mt-8 flex flex-wrap gap-3">{installButton}</div>}
        </div>
        <div className="flex items-end justify-center gap-4">
          <Phone src="/static/shot-phone-words.webp" alt="Карточки слов" className="hidden translate-y-6 sm:block" />
          <Phone src="/static/shot-phone-home.webp" alt="Главная ученика" />
        </div>
      </section>
      <Section label="Как установить" title="Выберите своё устройство">
        <div className="grid gap-4 lg:grid-cols-3">{order}</div>
      </Section>
    </>
  );
}
