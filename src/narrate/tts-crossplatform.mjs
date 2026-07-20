// TTS engine: cross-platform (headless Linux / macOS / SaaS workers).
//
// synth(lines, { voice, rate, outDir }) -> wavPath[], matching the Windows engine's
// WAV contract (PCM WAV, one seg-<i>.wav per line) so record.mjs stays engine-agnostic.
//
// Backend decision (was PLAN §9.3): shell out to an installed OFFLINE TTS CLI, in
// preference order — espeak-ng, espeak, then macOS `say`. Rationale: zero network
// dependency, no bundled/downloaded binary, and espeak-ng is a one-line install on
// Linux (`apt install espeak-ng`) and macOS (`brew install espeak-ng`); `say` ships
// with macOS. A higher-quality neural backend (Piper / edge-tts) can be added behind
// this same interface later without touching record.mjs.
import { spawnSync } from "node:child_process";
import path from "node:path";

// Our rate is -10..10 (0/1 ≈ default pacing). Map to words-per-minute for the espeak
// family (`say` uses the same -r WPM scale). Default (rate 1) is ~150 WPM — a calm
// narration pace; espeak's own 175+ default sounds rushed. Pure — unit-tested.
export function rateToWpm(rate = 1) {
  const wpm = Math.round(138 + Number(rate || 0) * 12);
  return Math.max(80, Math.min(450, wpm));
}

// First available engine descriptor, or null. A binary "exists" if spawning it does
// not fail with ENOENT (the exit code from --help is irrelevant).
export function detectEngine() {
  const exists = bin => {
    try { return spawnSync(bin, ["--help"], { stdio: "ignore" }).error == null; } catch { return false; }
  };
  if (exists("espeak-ng")) return { kind: "espeak", bin: "espeak-ng" };
  if (exists("espeak")) return { kind: "espeak", bin: "espeak" };
  if (process.platform === "darwin" && exists("say")) return { kind: "say", bin: "say" };
  return null;
}

function render(engine, text, file, { voice, wpm }) {
  if (engine.kind === "say") {
    return spawnSync("say", ["--file-format=WAVE", "--data-format=LEI16@22050", "-o", file,
      "-r", String(wpm), ...(voice ? ["-v", voice] : []), text], { encoding: "utf8" });
  }
  // espeak-ng / espeak: -w writes a PCM WAV, -s sets speed (WPM), -v picks a voice.
  return spawnSync(engine.bin, ["-w", file, "-s", String(wpm),
    ...(voice ? ["-v", voice] : []), text], { encoding: "utf8" });
}

export async function synth(lines, { voice, rate, outDir }) {
  const engine = detectEngine();
  if (!engine) throw new Error(
    "No cross-platform TTS engine found. Install espeak-ng (Linux: `apt install espeak-ng`, " +
    "macOS: `brew install espeak-ng`) or run on Windows for System.Speech.");
  const wpm = rateToWpm(rate);
  const paths = [];
  for (let i = 0; i < lines.length; i++) {
    const file = path.join(outDir, `seg-${i}.wav`);
    const res = render(engine, lines[i], file, { voice, wpm });
    if (res.status !== 0) throw new Error(`TTS (${engine.bin}) failed: ${res.stderr || res.error?.message || "unknown error"}`);
    paths.push(file);
  }
  return paths;
}

export default { synth };
