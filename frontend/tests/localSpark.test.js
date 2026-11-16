import assert from "node:assert/strict";
import test from "node:test";
import { localMessages, parseLocalLesson } from "../src/lib/localSpark.js";

const form = { topic: "Travel", language: "en", level: "B1" };

test("local lesson accepts only usable supported blocks", () => {
  const result = parseLocalLesson(JSON.stringify({ title: "Travel", blocks: [
    { type: "gap", text: "I [went] home." }, { type: "gap", text: "No answer" },
    { type: "text", body: "Read the text." }, { type: "choice", questions: [] },
  ] }), form);
  assert.deepEqual(result.blocks.map((b) => b.type), ["gap", "text"]);
  assert.equal(result.level, "B1");
  assert.match(result.notice, /Проверьте/);
});

test("local lesson rejects incomplete or empty output", () => {
  assert.throws(() => parseLocalLesson('{"blocks":', form));
  assert.throws(() => parseLocalLesson('{"blocks":[]}', form));
});

test("student prompt avoids claiming actions and retains only recent messages", () => {
  const previous = Array.from({ length: 8 }, (_, i) => ({ role: "user", text: String(i) }));
  const messages = localMessages("student", previous, "Hello");
  assert.equal(messages.length, 8);
  assert.match(messages[0].content, /не выполняй/);
  assert.match(messages[0].content, /Не утверждай/);
  assert.equal(messages.at(-1).content, "Hello");
});
