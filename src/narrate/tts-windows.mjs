// TTS engine: Windows System.Speech (default, highest quality on Windows).
//
// synth(lines, { voice, rate, outDir }) shells out to assets/gen-voice.ps1, which
// renders each line to seg-<i>.wav using System.Speech. A bad voice name fails
// loudly rather than silently falling back (matching the original behavior).
//
// Windows-only. This and src/nvda.mjs are the ONLY modules allowed a hard OS
// dependency — see docs/PLAN.md §5 and CLAUDE.md.

// TODO(port): move the spawnSync("powershell.exe", ... gen-voice.ps1 ...) call
// from the monolith's video section here, returning the produced WAV paths.

export async function synth(/* lines, opts */) {
  throw new Error("not implemented — scaffold");
}

export default { synth };
