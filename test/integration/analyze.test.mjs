// Integration tests: analyzers against test/fixtures/broken-page.html.
// Self-skips when no Edge/Chrome is installed, so test:integration is green
// everywhere; runs the real browser against the local file:// fixture otherwise.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchBrowser, openFixture, VIEWPORTS } from "../helpers/browser.mjs";
import { runLayout, readViewportMeta } from "../../src/analyze/layout.mjs";

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

after(async () => { if (browser) await browser.close(); });
