// Unit test for parseWav — the pure WAV-assembly seam of the recorder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWav } from "../../src/record.mjs";

// Build a minimal PCM WAV: mono, 8000 Hz, 8-bit, with `samples` data bytes.
function makeWav(samples) {
  const sampleRate = 8000, channels = 1, bits = 8;
  const byteRate = sampleRate * channels * (bits / 8); // 8000 bytes/sec
  const data = Buffer.alloc(samples, 0x7f);
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write("WAVE", 8);
  hdr.write("fmt ", 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20);
  hdr.writeUInt16LE(channels, 22); hdr.writeUInt32LE(sampleRate, 24);
  hdr.writeUInt32LE(byteRate, 28); hdr.writeUInt16LE(channels * (bits / 8), 32);
  hdr.writeUInt16LE(bits, 34); hdr.write("data", 36); hdr.writeUInt32LE(data.length, 40);
  return Buffer.concat([hdr, data]);
}

test("parseWav: reads fmt chunk and computes duration", () => {
  const wav = makeWav(8000); // exactly one second at 8000 bytes/sec
  const { fmt, data, durMs } = parseWav(wav);
  assert.equal(fmt.sampleRate, 8000);
  assert.equal(fmt.channels, 1);
  assert.equal(fmt.bits, 8);
  assert.equal(fmt.byteRate, 8000);
  assert.equal(data.length, 8000);
  assert.equal(Math.round(durMs), 1000);
});

test("parseWav: half a second of audio -> ~500ms", () => {
  const { durMs } = parseWav(makeWav(4000));
  assert.equal(Math.round(durMs), 500);
});
