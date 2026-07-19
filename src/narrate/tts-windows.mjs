// TTS engine: Windows System.Speech (default, highest quality on Windows).
//
// synth(lines, { voice, rate, outDir }) shells out to assets/gen-voice.ps1, which
// renders each line to seg-<i>.wav using System.Speech, and returns the WAV paths in
// order. A bad voice name fails loudly rather than silently falling back.
//
// Windows-only. This and src/nvda.mjs are the ONLY modules allowed a hard OS
// dependency — see docs/PLAN.md §5 and CLAUDE.md.
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GEN_VOICE = fileURLToPath(new URL("../../assets/gen-voice.ps1", import.meta.url));

export async function synth(lines, { voice, rate, outDir }) {
  const stepsJson = path.join(outDir, "_steps.json");
  await writeFile(stepsJson, JSON.stringify(lines));
  const ps = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass",
    "-File", GEN_VOICE, stepsJson, outDir,
    ...(voice ? ["-Voice", voice] : []),
    ...(rate != null ? ["-Rate", String(rate)] : [])], { encoding: "utf8" });
  if (ps.status !== 0) throw new Error(`TTS failed: ${ps.stderr}`);
  return lines.map((_, i) => path.join(outDir, `seg-${i}.wav`));
}

export default { synth };
