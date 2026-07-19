// Tests for the TTS seam: engine selection (pure) + the Piper neural engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import { selectEngine } from "../../src/narrate/tts.mjs";
import { lengthScale, piperConfig, synth } from "../../src/narrate/tts-piper.mjs";

test("selectEngine: explicit AURIA_TTS override wins", () => {
  assert.equal(selectEngine({ AURIA_TTS: "piper" }, "linux"), "piper");
  assert.equal(selectEngine({ AURIA_TTS: "windows" }, "linux"), "windows");
  assert.equal(selectEngine({ AURIA_TTS: "crossplatform" }, "win32"), "crossplatform");
});

test("selectEngine: PIPER_VOICE auto-selects the neural engine on any platform", () => {
  assert.equal(selectEngine({ PIPER_VOICE: "/v.onnx" }, "win32"), "piper");
  assert.equal(selectEngine({ PIPER_VOICE: "/v.onnx" }, "linux"), "piper");
});

test("selectEngine: platform default, and invalid override falls through", () => {
  assert.equal(selectEngine({}, "win32"), "windows");
  assert.equal(selectEngine({}, "linux"), "crossplatform");
  assert.equal(selectEngine({ AURIA_TTS: "bogus" }, "win32"), "windows"); // unknown -> ignored
});

test("piper lengthScale: rate 1 is the 1.0 default, faster shrinks, slower grows, clamped", () => {
  assert.equal(lengthScale(1), 1);
  assert.ok(lengthScale(10) < lengthScale(1));   // faster => shorter
  assert.ok(lengthScale(-10) > lengthScale(1));  // slower => longer
  assert.equal(lengthScale(1000), 0.5);          // clamp floor
  assert.equal(lengthScale(-1000), 2);           // clamp ceiling
});

test("piperConfig: the job voice overrides, bin defaults to 'piper'", () => {
  const prev = process.env.PIPER_VOICE;
  delete process.env.PIPER_VOICE;
  try {
    assert.deepEqual(piperConfig({ voice: "/m.onnx" }), { bin: "piper", model: "/m.onnx" });
    assert.equal(piperConfig({}).model, null);
  } finally {
    if (prev !== undefined) process.env.PIPER_VOICE = prev;
  }
});

test("piper synth: clear guidance when no voice model is configured", async () => {
  const prev = process.env.PIPER_VOICE;
  delete process.env.PIPER_VOICE;
  try {
    await assert.rejects(() => synth(["hi"], { outDir: os.tmpdir() }), /Piper needs a voice model/);
  } finally {
    if (prev !== undefined) process.env.PIPER_VOICE = prev;
  }
});
