import test from "node:test";
import assert from "node:assert/strict";
import { listeningText, clipBounds } from "../src/lib/listening.js";

test("sentence steps play only their own context and deduplicate shared sentences", () => {
  const b = { speak: "One. Two. Three.", gap_speech: ["One.", "Two.", "Two.", "Three."] };
  assert.equal(listeningText({ kind: "gap", b, gaps: [1, 2] }), "Two.");
  assert.equal(listeningText({ kind: "gap", b, gaps: [3] }), "Three.");
  assert.equal(listeningText({ kind: "choice", b, q: {} }), b.speak);
  assert.equal(listeningText({ kind: "choice", b, q: { speak: "Two." } }), "Two.");
});

test("recording bounds accept valid ranges and handle absent/invalid values", () => {
  assert.deepEqual(clipBounds({}), { start: 0, end: null });
  assert.deepEqual(clipBounds({ audio_start: 3, audio_end: 5 }), { start: 3, end: 5 });
  assert.deepEqual(clipBounds({ audio_start: 8, audio_end: 5 }), { start: 8, end: null });
});
