// TTS engine: cross-platform (headless Linux / SaaS workers).
//
// synth(lines, { voice, rate, outDir }) -> wavPath[], matching the Windows engine's
// WAV contract (same sample rate / channels) so record.mjs stays engine-agnostic.
//
// Candidate backends (see docs/PLAN.md §5, open item §9.3):
//   - Piper    : offline neural TTS, MIT, no per-use cost — best server economics.
//   - edge-tts : higher quality, but a network dependency.
//
// Decision pending. Implement the chosen backend behind this same interface.

// TODO(implement): render lines to WAV via the chosen backend; normalize output to
// the format record.mjs expects (parseWav in the monolith assumes PCM WAV).

export async function synth(/* lines, opts */) {
  throw new Error("not implemented — pending TTS engine decision (PLAN §9.3)");
}

export default { synth };
