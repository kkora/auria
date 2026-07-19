// Integration test: renderPdf actually prints a PDF via the browser.
// Self-skips when no Edge/Chrome is available. Writes to the OS temp dir.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { launchBrowser } from "../helpers/browser.mjs";
import { renderPdf } from "../../src/report/pdf.mjs";

const browser = await launchBrowser();
const opts = browser ? {} : { skip: "no Edge/Chrome available" };

test("renderPdf: writes a valid A4 PDF file", opts, async () => {
  const outPath = path.join(os.tmpdir(), `auria-pdf-test-${process.pid}.pdf`);
  await renderPdf(browser, "# Audit\n\n## axe-core violations\n\nNone. ✅", outPath);
  const buf = await readFile(outPath);
  assert.ok(buf.length > 0, "PDF should be non-empty");
  assert.equal(buf.subarray(0, 5).toString("latin1"), "%PDF-", "should start with the PDF magic bytes");
  await unlink(outPath).catch(() => {});
});

after(async () => { if (browser) await browser.close(); });
