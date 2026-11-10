import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";
const server = await createServer({ server: { host: "127.0.0.1", port: 5173, strictPort: true } });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
await page.addInitScript(() => {
 window.spoken = []; window.cancelCount = 0;
 Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
  cancel() { window.cancelCount++; }, getVoices() { return []; },
  speak(u) { window.spoken.push(u.text); }, speaking: false
 } });
});
await mkdir("qa-output", { recursive: true });
try {
 await page.goto("http://127.0.0.1:5173/static/qa/preview.html");
 const dialog = page.getByRole("dialog");
 await dialog.waitFor();
 assert((await dialog.boundingBox()).width >= 1150, "Desktop preview must use available width");
 await page.screenshot({ path: "qa-output/preview-desktop.png", fullPage: true });
 await page.getByRole("button", { name: "Пройти как ученик" }).click();
 assert.equal(await page.getByRole("dialog").count(), 0, "Practice is outside the modal");
 await page.getByRole("button", { name: "Прослушать", exact: true }).click();
 assert.equal(await page.evaluate(() => window.spoken.at(-1)), "First sentence one.");
 await page.getByRole("textbox", { name: "Пропуск", exact: true }).fill("one");
 const before = await page.evaluate(() => window.cancelCount);
 await page.getByRole("button", { name: "Проверить", exact: true }).click();
 await page.getByRole("button", { name: "Дальше", exact: true }).waitFor();
 assert(await page.evaluate(() => window.cancelCount) > before, "Checking must stop speech");
 await page.getByRole("button", { name: "Дальше", exact: true }).click();
 await page.getByRole("button", { name: "Прослушать", exact: true }).click();
 assert.equal(await page.evaluate(() => window.spoken.at(-1)), "Second sentence two.");
 const exercise = await page.getByRole("button", { name: "Проверить", exact: true }).boundingBox();
 assert(exercise.width >= 950, "Desktop exercise should be readable");
 await page.screenshot({ path: "qa-output/exercise-desktop.png", fullPage: true });
 for (const width of [320, 390, 768]) {
  await page.setViewportSize({ width, height: 900 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No horizontal overflow at " + width);
  await page.screenshot({ path: "qa-output/exercise-" + width + ".png", fullPage: true });
 }
 await page.getByRole("button", { name: "Выйти", exact: true }).click();
 await page.getByRole("dialog").waitFor();
 await page.getByRole("button", { name: "Закрыть", exact: true }).click();
 assert.equal(await page.evaluate(() => document.body.style.overflow), "");

 // A real, silent two-second WAV verifies start/end bounds and replay in the browser.
 const samples = 16000 * 2, wav = Buffer.alloc(44 + samples * 2);
 wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
 wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
 wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32);
 wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);
 await page.route("**/qa-audio.wav", r => r.fulfill({ body: wav, contentType: "audio/wav" }));
 await page.goto("http://127.0.0.1:5173/static/qa/preview.html?audio=1");
 await page.waitForFunction(() => document.querySelector("audio")?.readyState >= 1);
 await page.getByRole("button", { name: "Прослушать", exact: true }).click();
 await page.waitForFunction(() => { const a = document.querySelector("audio"); return a.paused && a.currentTime < 0.25; });
 await page.getByRole("button", { name: "Прослушать", exact: true }).click();
 await page.waitForFunction(() => document.querySelector("audio").currentTime > 0.25);
 await page.waitForFunction(() => document.querySelector("audio").paused);
 assert.deepEqual(errors, []);
 console.log("Browser checks passed: desktop/mobile layout, scoped speech, cleanup, recording boundaries and replay.");
} finally { await browser.close(); await server.close(); }
