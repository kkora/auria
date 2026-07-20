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
import { walkTabOrder, detectKeyboardTrap } from "../../src/analyze/keyboard.mjs";
import { readHeadings } from "../../src/analyze/headings.mjs";
import { readLandmarks, landmarkFindings } from "../../src/analyze/landmarks.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = pathToFileURL(path.join(HERE, "..", "fixtures", "broken-page.html")).href;

const browser = await launchBrowser();
const opts = browser ? {} : { skip: "no Edge/Chrome available" };

test("layout: detects overflow, sub-24px targets, and sub-12px text on the broken fixture", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  const layout = await runLayout(page, VIEWPORTS);
  assert.ok(layout.Phone.overflowPx > 1, "expected phone-width overflow (.wide is 2000px)");
  // the fixture has a 16×16 .small-btn (WCAG 2.5.8) and a 9px .tiny paragraph
  assert.ok(layout.Phone.smallTargets.some(t => /small-btn/.test(t.el)), "expected the 16px button flagged");
  assert.ok(layout.Phone.tinyText.some(t => /tiny/.test(t.el) && t.px < 12), "expected the 9px text flagged");
  await page.context().close();
});

test("layout: broken fixture has no viewport meta (WCAG 1.4.10 signal)", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  assert.equal(await readViewportMeta(page), null);
  await page.context().close();
});

test("strict: reflow320 and zoom200 both report overflow on the broken fixture", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  const strict = await runStrict(page);
  assert.ok(strict.reflow320 > 0, "expected 320px reflow overflow");
  assert.ok(strict.zoom200 > 0, "expected 200%-zoom overflow (.wide 2000px >> 640px equivalent)");
  await page.context().close();
});

test("axe: surfaces the image-alt violation on the broken fixture", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  const { byViewport } = await runAxe(page, VIEWPORTS);
  const all = Object.values(byViewport).flat();
  assert.ok(!all.some(v => v.id === "scan-failed"), "axe scan should not fail on a file:// fixture");
  assert.ok(all.some(v => v.id === "image-alt"), "expected the image-alt violation (fixture <img> has no alt)");
  await page.context().close();
});

test("axe: { passes: true } reports the criteria axe tested and passed", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  const { passedSc } = await runAxe(page, VIEWPORTS, { passes: true });
  assert.ok(Array.isArray(passedSc) && passedSc.length > 0, "expected some passed WCAG criteria");
  assert.ok(passedSc.every(sc => /^\d\.\d\.\d+$/.test(sc)), "each is an SC like 1.4.3");
  await page.context().close();
});

test("keyboard: walks tab order and finds no trap on the broken fixture", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  const stops = await walkTabOrder(page, { maxTabs: 10 });
  assert.ok(stops.length >= 1, "expected at least one tab stop");
  assert.ok(stops.every(s => typeof s.role === "string" && s.role.length > 0), "every stop has a role");
  const trap = await detectKeyboardTrap(page);
  assert.equal(trap.status, "pass");
  await page.context().close();
});

test("keyboard: detects a real trap (WCAG 2.1.2)", opts, async () => {
  const trapUrl = pathToFileURL(path.join(HERE, "..", "fixtures", "keyboard-trap.html")).href;
  const page = await openFixture(browser, trapUrl);
  const trap = await detectKeyboardTrap(page);
  assert.equal(trap.status, "trap", "focus stuck on #trap should be reported as a trap");
  assert.match(trap.at, /input#trap/);
  await page.context().close();
});

test("keyboard: a page with no focusable elements is not a false trap", opts, async () => {
  const secretUrl = pathToFileURL(path.join(HERE, "..", "fixtures", "crawl-secret.html")).href;
  const page = await openFixture(browser, secretUrl);
  const trap = await detectKeyboardTrap(page); // fixture is just an <h1>, nothing focusable
  assert.equal(trap.status, "pass");
  await page.context().close();
});

test("headings: extracts the visible outline (fixture has one h2, no h1)", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  const headings = await readHeadings(page);
  assert.equal(headings.length, 1, "fixture has a single visible heading");
  assert.equal(headings[0].level, 2);
  assert.ok(!headings.some(h => h.level === 1), "fixture deliberately has no h1");
  await page.context().close();
});

test("landmarks: reads roles and scopes a nested <header> out of banner", opts, async () => {
  const url = pathToFileURL(path.join(HERE, "..", "fixtures", "landmarks.html")).href;
  const page = await openFixture(browser, url);
  const landmarks = await readLandmarks(page);
  const roles = landmarks.map(l => l.role);
  assert.ok(roles.includes("main") && roles.includes("banner") && roles.includes("navigation") && roles.includes("contentinfo"));
  // the <header> inside <article> must not add a second banner
  assert.equal(landmarks.filter(l => l.role === "banner").length, 1, "nested article <header> is not a banner");
  assert.equal(landmarks.find(l => l.role === "navigation").label, "Primary");
  assert.deepEqual(landmarkFindings(landmarks).issues, [], "the well-structured fixture has no landmark issues");
  await page.context().close();
});

test("landmarks: the broken fixture has no landmarks -> missing main is flagged", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  const landmarks = await readLandmarks(page);
  assert.deepEqual(landmarks, [], "broken fixture puts everything directly in <body>");
  assert.ok(landmarkFindings(landmarks).issues.some(i => /No main landmark/.test(i.msg)));
  await page.context().close();
});

after(async () => { if (browser) await browser.close(); });
