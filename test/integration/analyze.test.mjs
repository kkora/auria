// Integration tests: analyzers against test/fixtures/broken-page.html.
// Self-skips when no Edge/Chrome is installed, so test:integration is green
// everywhere; runs the real browser against the local file:// fixture otherwise.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchBrowser, openFixture, VIEWPORTS } from "../helpers/browser.mjs";
import { runLayout, readViewportMeta } from "../../src/analyze/layout.mjs";
import { runStrict } from "../../src/analyze/strict.mjs";
import { runAxe } from "../../src/analyze/axe.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = pathToFileURL(path.join(HERE, "..", "fixtures", "broken-page.html")).href;

const browser = await launchBrowser();
const opts = browser ? {} : { skip: "no Edge/Chrome available" };

test("layout: detects horizontal overflow on the broken fixture", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  const layout = await runLayout(page, VIEWPORTS);
  assert.ok(layout.Phone.overflowPx > 1, "expected phone-width overflow");
  await page.context().close();
});

test("layout: broken fixture has no viewport meta (WCAG 1.4.10 signal)", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  assert.equal(await readViewportMeta(page), null);
  await page.context().close();
});

test("strict: reflow320 reports overflow on the broken fixture", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  const strict = await runStrict(page);
  assert.ok(strict.reflow320 > 0, "expected 320px reflow overflow");
  await page.context().close();
});

test("axe: surfaces the image-alt violation on the broken fixture", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  const axe = await runAxe(page, VIEWPORTS);
  const all = Object.values(axe).flat();
  assert.ok(!all.some(v => v.id === "scan-failed"), "axe scan should not fail on a file:// fixture");
  assert.ok(all.some(v => v.id === "image-alt"), "expected the image-alt violation (fixture <img> has no alt)");
  await page.context().close();
});

after(async () => { if (browser) await browser.close(); });
