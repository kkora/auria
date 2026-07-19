// Tests for the cross-platform TTS engine. The pure rate mapping always runs; the
// synth tests adapt to whether a TTS CLI is installed in this environment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { rateToWpm, detectEngine, synth } from "../../src/narrate/tts-crossplatform.mjs";
import { parseWav } from "../../src/record.mjs";

test("rateToWpm: maps -10..10 onto a clamped WPM range", () => {
  assert.equal(rateToWpm(0), 175);
  assert.equal(rateToWpm(1), 187);
  assert.equal(rateToWpm(10), 295);
  assert.equal(rateToWpm(-10), 80);   // 175-120=55 -> clamped to 80
  assert.equal(rateToWpm(undefined), 187); // default rate 1
});

test("synth: clear guidance when no TTS engine is installed", async () => {
  if (detectEngine()) return; // an engine is present here; nothing to assert
  await assert.rejects(
    () => synth(["hello"], { outDir: os.tmpdir() }),
    /No cross-platform TTS engine found/,
  );
});

test("synth: renders PCM WAV segments when an engine is available", async () => {
  const engine = detectEngine();
  if (!engine) return; // skipped on engine-less machines (e.g. the Windows dev box)
  const outDir = await mkdtemp(path.join(os.tmpdir(), "auria-xtts-"));
  try {
    const paths = await synth(["Hello world.", "Second line."], { outDir, rate: 1 });
    assert.equal(paths.length, 2);
    for (const p of paths) {
      const buf = await readFile(p);
      assert.equal(buf.subarray(0, 4).toString("ascii"), "RIFF");
      const { fmt, durMs } = parseWav(buf);
      assert.ok(fmt.sampleRate > 0 && fmt.channels >= 1);
      assert.ok(durMs > 0, "rendered audio should have a positive duration");
    }
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
