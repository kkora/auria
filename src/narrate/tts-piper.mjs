// TTS engine: Piper — neural, offline, cross-platform, high quality.
//
// synth(lines, { voice, rate, outDir }) -> wavPath[], matching the other engines' WAV
// contract (Piper writes 22050 Hz mono 16-bit PCM WAV natively). No network.
//
// Setup (once): download the `piper` binary (github.com/rhasspy/piper) and a voice
// model (.onnx + .onnx.json from rhasspy/piper-voices), then:
//   PIPER_BIN=/path/to/piper        (optional; defaults to `piper` on PATH)
//   PIPER_VOICE=/path/to/voice.onnx (required; or pass the model path as the job voice)
// Select it with AURIA_TTS=piper, or it is auto-preferred whenever PIPER_VOICE is set.
import { spawnSync } from "node:child_process";
import path from "node:path";

// Resolve the binary + model. The job's `voice` (a model path) overrides PIPER_VOICE.
export function piperConfig({ voice } = {}) {
  return {
    bin: process.env.PIPER_BIN || "piper",
    model: voice || process.env.PIPER_VOICE || null,
  };
}

// Piper's speed is `length_scale` (higher = slower). Map our -10..10 rate (higher =
// faster) onto a scale around the 1.0 default. Pure — unit-tested.
export function lengthScale(rate = 1) {
  const s = 1 - (Number(rate || 0) - 1) * 0.04; // rate 1 -> 1.0; faster -> < 1; slower -> > 1
  return Math.max(0.5, Math.min(2.0, s));
}

// True when a model is configured and the binary is runnable.
export function isAvailable({ voice } = {}) {
  const { bin, model } = piperConfig({ voice });
  if (!model) return false;
  try { return spawnSync(bin, ["--help"], { stdio: "ignore" }).error == null; } catch { return false; }
}

export async function synth(lines, { voice, rate, outDir }) {
  const { bin, model } = piperConfig({ voice });
  if (!model) throw new Error(
    "Piper needs a voice model: set PIPER_VOICE=/path/to/voice.onnx " +
    "(download from github.com/rhasspy/piper-voices), or pass the model path as the job voice.");
  const scale = lengthScale(rate);
  const paths = [];
  for (let i = 0; i < lines.length; i++) {
    const file = path.join(outDir, `seg-${i}.wav`);
    // Piper reads the utterance from stdin and writes a WAV to --output_file.
    const res = spawnSync(bin, ["--model", model, "--output_file", file, "--length_scale", String(scale)],
      { input: lines[i], encoding: "utf8" });
    if (res.status !== 0) throw new Error(`Piper TTS failed: ${res.stderr || res.error?.message || "unknown error"}`);
    paths.push(file);
  }
  return paths;
}

export default { synth };
