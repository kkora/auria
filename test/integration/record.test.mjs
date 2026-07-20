// Integration test: recordVideo produces a valid muxed video and cleans up its
// intermediates. Self-skips when no browser OR no TTS engine is available (so it
// runs on the Windows dev box via System.Speech, and skips on a TTS-less CI).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, access, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { launchBrowser } from "../helpers/browser.mjs";
import { recordVideo } from "../../src/record.mjs";

const FIXTURE = new URL("../fixtures/broken-page.html", import.meta.url).href;

const browser = await launchBrowser();
const opts = browser ? {} : { skip: "no Edge/Chrome available" };

const exists = async p => { try { await access(p); return true; } catch { return false; } };

// A tiny 2-line plan with no layout scrolls keeps this fast (~seconds, not minutes).
const plan = [
  { text: "Auria record pipeline test, line one.", pad: 200, action: null },
  { text: "Line two.", pad: 200, action: null },
];

test("recordVideo: produces a valid mp4 and cleans up intermediates", opts, async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "auria-rec-"));
  try {
    let result;
    try {
      result = await recordVideo(browser, { url: FIXTURE }, {
        plan, analysis: { nvdaUsed: false }, outDir, name: "vid", format: "mp4",
      });
    } catch (e) {
      // No TTS engine on this machine (e.g. Linux CI without espeak/piper) — skip.
      if (/TTS|voice model|engine|System\.Speech|Piper|espeak/i.test(e.message)) {
        console.error("skip recordVideo: no TTS engine —", e.message);
        return;
      }
      throw e;
    }
    const buf = await readFile(result.outVideo);
    assert.ok(buf.length > 1000, "video should be non-trivial in size");
    assert.equal(buf.subarray(4, 8).toString("latin1"), "ftyp", "mp4 files start with an ftyp box");
    assert.ok(result.seconds > 0);
    // try/finally cleanup must have removed the intermediates
    assert.ok(!(await exists(path.join(outDir, "seg-0.wav"))), "seg WAVs cleaned");
    assert.ok(!(await exists(path.join(outDir, "_narration.wav"))), "narration WAV cleaned");
    assert.ok(!(await exists(path.join(outDir, "_steps.json"))), "steps JSON cleaned");
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

after(async () => { if (browser) await browser.close(); });
