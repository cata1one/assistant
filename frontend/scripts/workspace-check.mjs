import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";

const server = await createServer({ server: { host: "127.0.0.1", port: 5174, strictPort: true } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem("school-access-token", "test-only"));
await page.route("**/site/v1/**", (route) => {
  const path = new URL(route.request().url()).pathname;
  const fixtures = {
    "/site/v1/config": { online_payments: false, support_email: "support@example.test" },
    "/site/v1/account": { account: { id: "test-teacher", name: "Анна", role: "tutor", prefs: {}, billing: { state: "trial", days_left: 2 } } },
    "/site/v1/me": { chats: [], lessons: [], unread: 0 },
    "/site/v1/students": { students: [] },
    "/site/v1/groups": { groups: [] },
    "/site/v1/units": { units: [], ai: false },
    "/site/v1/materials": { materials: [] },
    "/site/v1/homework": { homework: [] },
    "/site/v1/lesson-pay": {},
    "/site/v1/reviews": { reviews: [], count: 0 },
  };
  return route.fulfill({ json: fixtures[path] || { items: [], chats: [] } });
});
try {
  await mkdir("../docs/previews", { recursive: true });
  await page.goto("http://127.0.0.1:5174/static/#/app");
  await page.getByRole("heading", { name: /Здравствуйте, Анна/ }).waitFor();
  await page.getByText("Здесь появятся задания и сообщения, когда ученик подключится.").waitFor();
  await page.screenshot({ path: "../docs/previews/teacher-workspace.png" });
  await page.goto("http://127.0.0.1:5174/static/#/app/units/new");
  await page.getByText("Структура урока").waitFor();
  await page.getByRole("button", { name: /Вставить слова в текст/ }).click();
  await page.locator("textarea[placeholder^='I [have been]']").fill("She [works] here.");
  await page.getByText("Предпросмотр для ученика").waitFor();
  assert.equal(await page.getByLabel("Пропуск 1").count(), 1);
  await page.screenshot({ path: "../docs/previews/lesson-editor.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Editor overflows on mobile");
  await page.screenshot({ path: "../docs/previews/lesson-editor-mobile.png" });
  await page.goto("http://127.0.0.1:5174/static/#/pricing");
  await page.getByText("Онлайн-оплата временно недоступна.").waitFor();
  assert.equal(await page.getByRole("link", { name: /Сразу оплатить/ }).count(), 0);
  assert.deepEqual(errors, []);
  console.log("Teaching workspace, editor preview, mobile layout and disabled payment state checked.");
} finally {
  await browser.close();
  await server.close();
}
