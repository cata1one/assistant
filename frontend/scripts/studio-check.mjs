import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";

const server = await createServer({ server: { host: "127.0.0.1", port: 5173, strictPort: true } });
await server.listen();
const browser = await chromium.launch();
await mkdir("qa-output", { recursive: true });
await mkdir("../docs/previews", { recursive: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.route("**/site/v1/**", route => {
 const url = route.request().url();
 if (url.includes("/cards")) return route.fulfill({json:{queue:[{key:"arrangement",word:"arrangement",translation:"договорённость",chat_id:"pair:demo",example:"We have a clear arrangement."}],stats:{total:24,learned:15}}});
 if (url.includes("/homework")) return route.fulfill({json:{homework:[{id:"hw-demo",text:"Making decisions: планы на выходные",status:"open",unit:true}]}});
 if (url.includes("/spark")) return route.fulfill({json:{ai:false,messages:[{id:1,role:"user",status:"done",text:"Проверь мои слова"},{id:2,role:"assistant",status:"done",text:"Давай повторим слова с урока. Как по-английски «договорённость»? Вспомни наш план поездки."}]}});
 if (url.includes("/chats/") && url.includes("/messages")) return route.fulfill({json:{with:"Анна",role:"student",can_write:true,messages:[{id:1,role:"tutor",author:"Анна",text:"Привет! На следующем уроке обсудим твой план путешествия. Приготовь три идеи.",created_at:"2026-11-11T12:00:00Z"},{id:2,role:"student",author:"Миша",text:"Хорошо! Можно рассказать про поездку на поезде?",created_at:"2026-11-11T12:02:00Z"},{id:3,role:"tutor",author:"Анна",text:"Конечно. Подумай, где и во сколько мы встретимся.",created_at:"2026-11-11T12:03:00Z"}]}});
 if(url.endsWith("/chats")) return route.fulfill({json:{chats:[{chat_id:"pair:demo",title:"Анна",kind:"tutor",unread:0,last:{text:"Обсудим план путешествия?"}}]}});
 if (url.includes("/boards/showcase/items")) {
  const base = { z:1, size:22 };
  const objects = [
   { ...base, oid:"title", type:"text", x:65, y:15, w:700, h:55, text:"A weekend worth remembering.", color:"#293DCD", size:34 },
   { ...base, oid:"note1", type:"note", x:70, y:100, w:230, h:170, text:"THE PLAN\nFriday · 18:00\nMeet at the station.\nBring a camera!", color:"#FFE07A" },
   { ...base, oid:"note2", type:"note", x:335, y:100, w:240, h:170, text:"WHAT IF IT RAINS?\nWe could visit the museum instead.\nWhat do you think?", color:"#FFD9CF", size:21 },
   { ...base, oid:"card1", type:"card", x:610, y:100, w:190, h:170, front:"look forward to", back:"ждать с нетерпением", color:"#E4E8FC" },
   { ...base, oid:"table", type:"table", x:70, y:310, w:505, h:145, head:true, cells:[["Arrangements","Possibilities"],["We're meeting at six.","We could take the train."],["I've booked the tickets.","Shall we visit the gallery?"]] },
   { ...base, oid:"card2", type:"card", x:610, y:310, w:190, h:145, front:"an arrangement", back:"договорённость", color:"#DFF2E4" }
  ];
  return route.fulfill({ json:{ items:objects.map(data => ({kind:"obj",data})), last_id:6 } });
 }
 return route.fulfill({ json: url.includes("config") ? { school_name:"Bright", support_email:"support@example.test" } : { reviews:[], items:[], chats:[] } });
});
const base = "http://127.0.0.1:5173/static";
try {
 await page.goto(base + "/");
 await page.getByRole("heading", { name:"Здесь хочется заниматься." }).waitFor();
 await page.getByRole("button", { name:/We're meeting at the station/ }).click();
 await page.getByRole("button", { name:"Проверить", exact:true }).click();
 await page.getByRole("status").filter({ hasText:"Верно!" }).waitFor();
 await page.getByRole("button", { name:"Ещё раз", exact:true }).click();
 await page.waitForFunction(() => !document.querySelector(".studio-option.is-correct"));
 await page.screenshot({ path:"../docs/previews/studio-desktop.png", fullPage:false });
 for (const width of [320, 390, 768]) {
  await page.setViewportSize({ width, height:1000 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Homepage overflow at " + width);
  if(width === 390) await page.screenshot({ path:"../docs/previews/studio-mobile.png", fullPage:false });
 }
 await page.setViewportSize({ width:1200, height:850 });
 for(const [name,mode] of [["shot-board","board"],["shot-stickers","stickers"],["shot-today","today"],["shot-courses","courses"],["shot-lesson","lesson"]]) {
  await page.goto(base + "/qa/showcase.html?mode=" + mode);
  await page.getByRole("heading", { level:1 }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  if(["board","stickers"].includes(mode)) {
   await page.getByText("A weekend worth remembering.", {exact:true}).waitFor();
   if(mode === "stickers") await page.getByRole("button", {name:"Стикеры",exact:true}).click();
  }
  await page.screenshot({path:"qa-output/" + name + ".png"});
 }
 await page.setViewportSize({ width:390, height:844 });
 for(const [name,mode] of [["shot-phone-home","home"],["shot-phone-words","words"],["shot-phone-chat","chat"],["shot-phone-spark","spark"]]) {
  await page.goto(base + "/qa/showcase.html?mode=" + mode);
  await page.getByRole("heading", {level:1}).waitFor();
  if(mode === "chat") { await page.getByRole("button", {name:/Анна/}).click(); await page.getByText("Конечно. Подумай, где и во сколько мы встретимся.",{exact:true}).waitFor(); }
  if(mode === "spark") await page.getByText("Проверь мои слова", {exact:true}).waitFor();
  if(mode === "home") await page.getByText("Making decisions: планы на выходные",{exact:true}).waitFor();
  if(mode === "words") await page.getByText("arrangement",{exact:true}).waitFor();
  await page.screenshot({path:"qa-output/" + name + ".png"});
 }
 assert.deepEqual(errors, []);
 console.log("Studio checks passed: working example, responsive homepage, refreshed branded interface screenshots.");
} finally { await browser.close(); await server.close(); }
