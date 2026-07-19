// TTS seam — the boundary that keeps Auria's narrated video cross-platform.
//
// A TTS engine implements:
//   synth(lines, { voice, rate, outDir }) -> Promise<wavPath[]>
//     Render each narration line to a WAV file; return their paths in order.
//
// getTts() picks an engine by platform/env so the rest of narrate/record depends
// ONLY on this interface, never on System.Speech directly. Precedence:
//   1. AURIA_TTS=piper|windows|crossplatform  — explicit override
//   2. PIPER_VOICE set                          -> tts-piper.mjs (neural, best quality)
//   3. Windows                                  -> tts-windows.mjs (System.Speech)
//   4. otherwise                                -> tts-crossplatform.mjs (espeak-ng)
//
// All engines honor the same contract: synth(lines, { voice, rate, outDir }) renders
// each line to seg-<i>.wav as PCM WAV (record.mjs's WAV assembly stays engine-agnostic).
// This is what lets a Linux SaaS worker produce the same narrated video (PLAN §5).
import process from "node:process";

const ENGINES = {
  piper: "./tts-piper.mjs",
  windows: "./tts-windows.mjs",
  crossplatform: "./tts-crossplatform.mjs",
};

export function selectEngine(env = process.env, platform = process.platform) {
  if (env.AURIA_TTS && ENGINES[env.AURIA_TTS]) return env.AURIA_TTS;
  if (env.PIPER_VOICE) return "piper";
  return platform === "win32" ? "windows" : "crossplatform";
}

export async function getTts() {
  const mod = await import(ENGINES[selectEngine()]);
  return mod.default ?? mod;
}
