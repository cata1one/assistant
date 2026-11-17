export const LOCAL_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
export const FAST_LOCAL_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

/** Create an isolated worker only after the user explicitly opts in. */
export async function startLocalSpark(onProgress, model = LOCAL_MODEL, signal) {
  if (![LOCAL_MODEL, FAST_LOCAL_MODEL].includes(model)) throw new Error("Неизвестная модель ИИ.");
  if (signal?.aborted) throw new DOMException("Загрузка остановлена", "AbortError");
  if (!navigator.gpu) throw new Error("Этот браузер не поддерживает WebGPU. Попробуйте актуальный Chrome на совместимом устройстве.");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("На этом устройстве не удалось запустить локальный ИИ. Попробуйте другой компьютер или браузер.");
  const worker = new Worker(new URL("./localSpark.worker.js", import.meta.url), { type: "module" });
  let onAbort;
  try {
    const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
    if (signal?.aborted) throw new DOMException("Загрузка остановлена", "AbortError");
    const load = CreateWebWorkerMLCEngine(worker, model, {
      initProgressCallback: (report) => onProgress?.(report.progress),
    });
    const aborted = new Promise((_, reject) => { onAbort = () => reject(new DOMException("Загрузка остановлена", "AbortError")); signal?.addEventListener("abort", onAbort, { once: true }); });
    const engine = await Promise.race([load, aborted]);
    return { engine, close: () => worker.terminate() };
  } catch (error) {
    worker.terminate();
    throw error;
  } finally {
    if (onAbort) signal?.removeEventListener("abort", onAbort);
  }
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Искорка слишком долго не отвечает. Попробуйте облегчённый режим или другое устройство.")), ms); })]).finally(() => clearTimeout(timer));
}

/** Display each token immediately and stop waiting if the worker becomes unresponsive. */
export async function streamLocalAnswer(engine, messages, onText, timeoutMs = 60000) {
  const stream = await withTimeout(engine.chat.completions.create({ messages, stream: true, temperature: 0.5, max_tokens: 320 }), timeoutMs);
  const iterator = stream[Symbol.asyncIterator]();
  let answer = "";
  while (true) {
    const next = await withTimeout(iterator.next(), timeoutMs);
    if (next.done) break;
    answer += next.value?.choices?.[0]?.delta?.content || "";
    if (answer) onText(answer);
  }
  if (!answer.trim()) throw new Error("Модель не вернула ответ. Попробуйте переформулировать вопрос.");
  return answer.trim();
}

export function localMessages(role, messages, prompt) {
  const student = role === "student";
  const system = `Ты Искорка, помощница образовательной платформы Bright. Объясняй понятно и дружелюбно на языке вопроса. Помогай изучать иностранные языки. ${student ? "Помогай ученику рассуждать, не выполняй за него домашнюю работу." : "Помогай преподавателю готовить занятия. Для упражнений давай понятный контекст, инструкции и ответы для проверки."} Не утверждай, что создала или изменила что-либо на платформе: ты можешь только предложить текст. Если не уверена в ответе, скажи об этом. Учителю следует проверить созданные материалы.`;
  return [{ role: "system", content: system }, ...messages.filter((m) => m.status === "done" || !m.status).slice(-4).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text.slice(-1200) })), { role: "user", content: prompt }];
}

export function parseLocalLesson(output, form) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("ИИ не смог составить черновик. Попробуйте другую тему или создайте занятие вручную.");
  let data;
  try { data = JSON.parse(output.slice(start, end + 1)); } catch { throw new Error("ИИ вернул неполное занятие. Попробуйте ещё раз или создайте его вручную."); }
  if (!data || !Array.isArray(data.blocks)) throw new Error("ИИ не вернул задания. Попробуйте другую тему.");
  const blocks = data.blocks.slice(0, 8).filter((b) => b && typeof b === "object").flatMap((b) => {
    const title = typeof b.title === "string" ? b.title.slice(0, 200) : "";
    if (b.type === "text" && typeof b.body === "string" && b.body.trim()) return [{ type: "text", title, body: b.body.slice(0, 5000) }];
    if (b.type === "gap" && typeof b.text === "string" && /\[[^\[\]\n]+\]/.test(b.text)) return [{ type: "gap", title, text: b.text.slice(0, 5000), context: typeof b.context === "string" ? b.context.slice(0, 3000) : "", instruction: typeof b.instruction === "string" ? b.instruction.slice(0, 1000) : "", bank: false }];
    if (b.type === "write" && typeof b.prompt === "string" && b.prompt.trim()) return [{ type: "write", title, prompt: b.prompt.slice(0, 3000) }];
    return [];
  });
  if (!blocks.length) throw new Error("ИИ не создал распознаваемых заданий. Попробуйте другую тему.");
  return { title: (typeof data.title === "string" && data.title.trim() ? data.title : form.topic).slice(0, 200), language: form.language, level: form.level, blocks,
    notice: "Это черновик небольшого ИИ. Проверьте факты, формулировки и ответы перед выдачей." };
}
