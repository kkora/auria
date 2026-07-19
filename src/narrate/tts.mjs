// TTS seam — the boundary that keeps Auria's narrated video cross-platform.
//
// A TTS engine implements:
//   synth(lines, { voice, rate, outDir }) -> Promise<wavPath[]>
//     Render each narration line to a WAV file; return their paths in order.
//
// getTts() picks an engine by platform/env so the rest of narrate/record depends
// ONLY on this interface, never on System.Speech directly:
//   - Windows (default)      -> tts-windows.mjs   (System.Speech via gen-voice.ps1)
//   - AURIA_TTS=crossplatform -> tts-crossplatform.mjs (Piper / edge-tts)
//   - non-Windows            -> tts-crossplatform.mjs
//
// This is what lets a Linux SaaS worker produce the same narrated video (see
// docs/PLAN.md §5). Do NOT bypass it.

import process from "node:process";

export async function getTts() {
  const wantCross =
    process.env.AURIA_TTS === "crossplatform" || process.platform !== "win32";
  const mod = wantCross
    ? await import("./tts-crossplatform.mjs")
    : await import("./tts-windows.mjs");
  return mod.default ?? mod;
}

// TODO(port): define the exact synth() signature + WAV contract once the Windows
// impl is ported, then make the cross-platform impl match it byte-format-wise
// (same sample rate / channels so record.mjs's WAV assembly stays engine-agnostic).
