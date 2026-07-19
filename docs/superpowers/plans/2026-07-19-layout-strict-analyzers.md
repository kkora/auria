# Layout + Strict Analyzers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the `runLayout` + `readViewportMeta` and `runStrict` inspectors from the source monolith into `src/analyze/layout.mjs` and `src/analyze/strict.mjs`, with a browser-backed integration test that self-skips when no browser is installed.

**Architecture:** Faithful extraction from `docs/_source-monolith.mjs.txt`. Analyzers are pure inspectors: take a Playwright `page`, drive/read it, return plain data, write nothing. A shared test helper owns the browser lifecycle in tests. First slice to use a real browser (Playwright + installed Edge/Chrome).

**Tech Stack:** Node.js ≥ 20, ESM, `playwright-core` (already a dependency), `node:test` + `node:assert/strict`. No new dependencies.

## Global Constraints

- ESM only (`"type": "module"`).
- `analyze/*` are pure inspectors: MAY drive/read the `page` (set viewport, evaluate), MUST NOT write files or launch their own browser (the caller/test owns the browser).
- Port logic VERBATIM from the monolith. Do NOT change thresholds (24px, 12px, ±1px overflow tolerance, 4000-element cap, 8-item dedup cap) or timings (500ms/400ms/300ms/200ms waits).
- Tests must not use live network — only the local `file://` fixture.
- Integration suite MUST self-skip cleanly when no Edge/Chrome is available (mirrors the Windows-only self-skip convention), so `npm run test:integration` is green everywhere.
- Test runner: `node --test`. Run the integration suite with `npm run test:integration`; a single file with `node --test test/integration/analyze.test.mjs`.
- There is a Write-safety hook that intermittently blocks in-project writes over a `C:`/`c:` drive-letter case mismatch — retry with the opposite drive-letter case if blocked.

---

## File Structure

- `test/helpers/browser.mjs` — CREATE. `launchBrowser()` (msedge→chrome, returns null), `openFixture(browser, fileUrl)`, exported `VIEWPORTS`. Owns the browser lifecycle for tests only.
- `src/analyze/layout.mjs` — MODIFY. Replace stub with `runLayout` + `readViewportMeta`.
- `src/analyze/strict.mjs` — MODIFY. Replace stub with `runStrict`.
- `test/integration/analyze.test.mjs` — MODIFY. Replace the skipped placeholders with real browser-backed assertions that self-skip when no browser.

---

### Task 1: Browser test helper + layout analyzer

**Files:**
- Create: `test/helpers/browser.mjs`
- Modify: `src/analyze/layout.mjs`
- Modify: `test/integration/analyze.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `launchBrowser() -> Promise<Browser | null>` — Playwright browser via channel msedge then chrome; `null` if neither launches.
  - `openFixture(browser, fileUrl) -> Promise<Page>` — new context (viewport 1280×900) + page, navigated to `fileUrl`.
  - `VIEWPORTS: Array<{label,w,h}>` — Desktop 1280×900, Tablet 820×1080, Phone 375×812.
  - `runLayout(page, viewports) -> Promise<{ [label]: { overflowPx:number, overflowing:Array<{el,px}>, smallTargets:Array<{el,size}>, tinyText:Array<{el,px}> } }>`.
  - `readViewportMeta(page) -> Promise<string | null>`.

- [ ] **Step 1: Create the browser test helper**

Create `test/helpers/browser.mjs`:

```js
// Browser lifecycle for integration tests only. Drives the installed Edge/Chrome
// via playwright-core (no download). launchBrowser() returns null when neither is
// available so suites can self-skip instead of failing on a browserless machine.
import { chromium } from "playwright-core";

export const VIEWPORTS = [
  { label: "Desktop", w: 1280, h: 900 },
  { label: "Tablet", w: 820, h: 1080 },
  { label: "Phone", w: 375, h: 812 },
];

export async function launchBrowser() {
  for (const channel of ["msedge", "chrome"]) {
    try { return await chromium.launch({ channel }); } catch {}
  }
  return null;
}

export async function openFixture(browser, fileUrl) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(fileUrl, { waitUntil: "load" });
  return page;
}
```

- [ ] **Step 2: Write the failing integration tests (layout + viewport meta)**

Replace the entire contents of `test/integration/analyze.test.mjs` with:

```js
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test test/integration/analyze.test.mjs`
Expected: FAIL — `runLayout`/`readViewportMeta` throw `"not implemented — scaffold"` (assuming a browser is present). If the machine has no browser the suite will SKIP instead; in that case note it and proceed to Step 4 — the implementation is still required.

- [ ] **Step 4: Implement the layout analyzer**

Replace the entire contents of `src/analyze/layout.mjs` with (the in-page `short`/`dedup` helpers stay inside `page.evaluate`, ported verbatim from the monolith):

```js
// Analyzer: per-viewport layout / responsive checks.
//
// runLayout(page, viewports) -> { [label]: { overflowPx, overflowing[], smallTargets[], tinyText[] } }
// Per viewport: horizontal overflow (WCAG 1.4.10 Reflow), interactive targets under
// 24px (WCAG 2.5.8), text under 12px. SR-only (<=1x1) and display:none/visibility:hidden
// excluded; each list deduped by element and capped at 8.
//
// readViewportMeta(page) -> the <meta name="viewport"> content, or null.
//
// Pure inspector: takes a Playwright page, returns data. No file writes.

export async function readViewportMeta(page) {
  return page.evaluate(() =>
    document.querySelector('meta[name="viewport"]')?.getAttribute("content") || null);
}

export async function runLayout(page, viewports) {
  const layout = {};
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(500);
    layout[vp.label] = await page.evaluate(() => {
      const short = el => {
        const t = el.tagName.toLowerCase();
        if (el.id) return `${t}#${el.id}`;
        const c = [...el.classList][0];
        return c ? `${t}.${c}` : t;
      };
      const vw = document.documentElement.clientWidth;
      const overflowPx = Math.max(0, document.documentElement.scrollWidth - vw);
      const overflowing = [], smallTargets = [], tinyText = [];
      const els = [...document.querySelectorAll("body *")].slice(0, 4000);
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width <= 1 && r.height <= 1) continue; // visually-hidden (SR-only) technique
        const st = getComputedStyle(el);
        if (st.visibility === "hidden" || st.display === "none") continue;
        if (r.right > vw + 1 || r.left < -1)
          overflowing.push({ el: short(el), px: Math.round(Math.max(r.right - vw, -r.left)) });
        if (el.matches("a,button,select,textarea,input:not([type=hidden]),[role=button],[role=link]")
            && (r.width < 24 || r.height < 24))
          smallTargets.push({ el: short(el), size: `${Math.round(r.width)}×${Math.round(r.height)}` });
        if (parseFloat(st.fontSize) < 12
            && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
          tinyText.push({ el: short(el), px: Math.round(parseFloat(st.fontSize)) });
      }
      const dedup = (arr, key) => [...new Map(arr.map(x => [x.el, x])).values()]
        .sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, 8);
      return {
        overflowPx,
        overflowing: dedup(overflowing, "px"),
        smallTargets: dedup(smallTargets, ""),
        tinyText: dedup(tinyText, ""),
      };
    });
  }
  return layout;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/integration/analyze.test.mjs`
Expected: PASS (2 tests) if a browser is present; SKIP (2 tests) if not. Either way, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add test/helpers/browser.mjs src/analyze/layout.mjs test/integration/analyze.test.mjs
git commit -m "feat(analyze): port layout analyzer + browser test helper"
```

---

### Task 2: Strict WCAG analyzer

**Files:**
- Modify: `src/analyze/strict.mjs`
- Modify: `test/integration/analyze.test.mjs`

**Interfaces:**
- Consumes: `openFixture`, `browser`, `FIXTURE` from the test module (Task 1); the `opts` self-skip object already defined in the test file.
- Produces:
  - `runStrict(page) -> Promise<{ reflow320: number, zoom200: number }>` — leaves the page at viewport 1280×900 on return.

- [ ] **Step 1: Add the failing strict test**

In `test/integration/analyze.test.mjs`, add the strict import beside the layout import near the top:

```js
import { runStrict } from "../../src/analyze/strict.mjs";
```

And add this test AFTER the two layout tests and BEFORE the `after(...)` hook:

```js
test("strict: reflow320 reports overflow on the broken fixture", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  const strict = await runStrict(page);
  assert.ok(strict.reflow320 > 0, "expected 320px reflow overflow");
  await page.context().close();
});
```

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `node --test test/integration/analyze.test.mjs`
Expected: FAIL on the strict test — `runStrict` throws `"not implemented — scaffold"` (browser present). SKIP if no browser; note and proceed.

- [ ] **Step 3: Implement the strict analyzer**

Replace the entire contents of `src/analyze/strict.mjs` with (ported verbatim from monolith lines 433–447):

```js
// Analyzer: strict WCAG passes.
//
// runStrict(page) -> { reflow320, zoom200 }
//   reflow320 : horizontal overflow (px) at exactly 320 CSS px (WCAG 1.4.10, exact)
//   zoom200   : horizontal overflow (px) at document zoom 2x    (WCAG 1.4.4 approx)
//
// Leaves the page at viewport 1280x900 on return.
// Pure inspector: takes a Playwright page, returns data.

export async function runStrict(page) {
  const strict = {};
  await page.setViewportSize({ width: 320, height: 800 });
  await page.waitForTimeout(500);
  strict.reflow320 = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300);
  strict.zoom200 = await page.evaluate(async () => {
    document.documentElement.style.zoom = "2";
    await new Promise(r => setTimeout(r, 400));
    const overflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    document.documentElement.style.zoom = "";
    await new Promise(r => setTimeout(r, 200));
    return overflow;
  });
  return strict;
}
```

- [ ] **Step 4: Run the full integration + unit suites**

Run: `npm run test:integration`
Expected: PASS (3 tests) with a browser, or clean SKIP (3 tests) without; 0 failures.

Run: `npm run test:unit`
Expected: PASS — the prior slice's 23 tests still green (no regression).

- [ ] **Step 5: Commit**

```bash
git add src/analyze/strict.mjs test/integration/analyze.test.mjs
git commit -m "feat(analyze): port strict WCAG analyzer (reflow320 + zoom200)"
```

---

## Done criteria

- `src/analyze/layout.mjs` exports `runLayout` + `readViewportMeta`; `src/analyze/strict.mjs` exports `runStrict`; all pure (no file writes, no self-launched browser).
- `test/helpers/browser.mjs` provides `launchBrowser`, `openFixture`, `VIEWPORTS`.
- `test/integration/analyze.test.mjs` un-skipped, self-skipping when no browser, 3 assertions (Phone overflow, viewport-meta null, reflow320) passing when a browser is present.
- `npm run test:integration` green (pass or clean self-skip); `npm run test:unit` still green.
- `axe`/`keyboard` analyzers untouched (throwing stubs) — next slice.
