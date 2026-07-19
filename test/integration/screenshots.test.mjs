// Integration test: captureScreenshots marks offenders and writes one PNG per viewport.
// Self-skips when no Edge/Chrome is available. Writes to a temp dir.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { launchBrowser, openFixture } from "../helpers/browser.mjs";
import { captureScreenshots } from "../../src/report/screenshots.mjs";

const FIXTURE = new URL("../fixtures/broken-page.html", import.meta.url).href;

const browser = await launchBrowser();
const opts = browser ? {} : { skip: "no Edge/Chrome available" };

const VIEWPORTS = [
  { label: "Desktop", w: 1280, h: 900 },
  { label: "Phone", w: 375, h: 812 },
];

// Minimal analysis referencing real fixture selectors: the <img> (axe node) and the
// overflowing .wide block (layout finding).
const analysis = {
  axe: { Desktop: [{ nodes: ["img"] }], Phone: [{ nodes: ["img"] }] },
  layout: {
    Desktop: { overflowing: [{ el: "div.wide" }], smallTargets: [], tinyText: [] },
    Phone: { overflowing: [{ el: "div.wide" }], smallTargets: [{ el: "button.small-btn" }], tinyText: [] },
  },
};

test("captureScreenshots: one marked PNG per viewport", opts, async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "auria-shots-"));
  try {
    const page = await openFixture(browser, FIXTURE);
    const shots = await captureScreenshots(page, analysis, { viewports: VIEWPORTS, outDir, name: "test" });
    assert.equal(shots.length, 2);
    assert.deepEqual(shots.map(s => s.viewport), ["Desktop", "Phone"]);
    assert.ok(shots.every(s => s.marked >= 1), "each shot marks at least the image");
    // The files exist and are PNGs (magic bytes 89 50 4E 47).
    for (const s of shots) {
      const buf = await readFile(path.join(outDir, s.file));
      assert.deepEqual([...buf.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    }
    await page.context().close();
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

after(async () => { if (browser) await browser.close(); });
