// Video recorder + muxer.
//
// recordVideo(browser, job, { plan, emu, auth, outDir, name, format }) -> { outVideo, seconds }
//
// Steps:
//   1. Synthesize narration WAVs via the TTS seam (src/narrate/tts.mjs).
//   2. Assemble a single timeline WAV (per-segment durations + pads -> silence gaps).
//   3. Record a Playwright context (recordVideo) while driving the on-screen caption
//      overlay and the plan's actions (Tab presses, per-viewport resize + full scroll).
//   4. Mux video + narration with ffmpeg (ffmpeg-static) into mp4 (H.264/AAC) or webm.
//   5. Clean up intermediates (seg-*.wav, _narration.wav, _steps.json).
//
// Cross-platform once TTS is: recordVideo + ffmpeg already run headless on Linux.
// The WAV-assembly math (parseWav, silence padding) is pure and unit-testable.

// TODO(port): move the "video: narrate, record, mux" + "phase B: record" + "mux"
// sections here. Keep parseWav exported for unit tests.

export async function recordVideo(/* browser, job, ctx */) {
  throw new Error("not implemented — scaffold");
}
