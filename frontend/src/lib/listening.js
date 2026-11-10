// Choose the audio needed by this exercise; comprehension questions retain their context.
export function listeningText(step) {
  if (step.kind === "gap" && step.b.gap_speech) {
    return [...new Set(step.gaps.map((g) => step.b.gap_speech[g]).filter(Boolean))].join(" ");
  }
  return step.q?.speak || step.b.speak || "";
}

export function clipBounds(block) {
  const start = Number(block.audio_start ?? 0);
  const end = block.audio_end == null ? null : Number(block.audio_end);
  return { start: Number.isFinite(start) && start >= 0 ? start : 0,
    end: Number.isFinite(end) && end > start ? end : null };
}
