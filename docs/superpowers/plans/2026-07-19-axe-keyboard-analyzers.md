# Axe + Keyboard Analyzers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `runAxe` into `src/analyze/axe.mjs` and `walkTabOrder` + `detectKeyboardTrap` into `src/analyze/keyboard.mjs`, completing the analyze/* layer, with browser-backed integration tests that reuse the existing self-skip harness.

**Architecture:** Faithful extraction from `docs/_source-monolith.mjs.txt`. Analyzers are pure inspectors: drive/read the Playwright `page`, return data, write nothing. `axe.mjs` does one memoized read of the bundled `axe-core/axe.min.js` (a dependency asset, not an artifact). The NVDA driver is injected via `opts.nvda` so no Windows dependency enters `keyboard.mjs`.

**Tech Stack:** Node.js ≥ 20, ESM, `playwright-core` + `axe-core` (both already dependencies), `node:test`. No new dependencies.

## Global Constraints

- ESM only.
- `analyze/*` are pure: drive/read the `page`, return data, write NO files. The only accepted read is `axe.mjs` loading the bundled `axe-core/axe.min.js` (memoized, isolated in `loadAxeSource()`).
- No `@guidepup`/Windows import in `keyboard.mjs` — the NVDA driver arrives only via `opts.nvda` (default `null`).
- Port logic VERBATIM from the monolith. Do NOT change: the widest+narrowest viewport selection, the 400ms axe wait, the 10-node cap, the `scan-failed` fallback shape, the name/role derivation, `maxTabs` default 25, the early-break conditions, the 300-tab trap ceiling, or the `same >= 3` trap threshold.
- `runAxe` must NEVER throw on a scan failure — it returns a `scan-failed` pseudo-violation.
- Tests must not use live network — only the local `file://` fixture. Suite self-skips when no browser (harness already present in `test/integration/analyze.test.mjs`).
- Test runner: `node --test test/integration/analyze.test.mjs`; full suites `npm run test:integration` / `npm run test:unit`.
- Write-safety hook intermittently blocks in-project writes over a `C:`/`c:` drive-letter case mismatch — retry with the opposite case if blocked.

---

## File Structure

- `src/analyze/axe.mjs` — MODIFY. Replace stub with `loadAxeSource` (private, memoized) + `runAxe`.
- `src/analyze/keyboard.mjs` — MODIFY. Replace stub with `walkTabOrder` + `detectKeyboardTrap`.
- `test/integration/analyze.test.mjs` — MODIFY (append only). Add axe + keyboard imports and one test each, after the existing tests and before the `after(...)` hook. Do not alter existing tests or the self-skip harness.

---

### Task 1: Axe-core analyzer

**Files:**
- Modify: `src/analyze/axe.mjs`
- Modify: `test/integration/analyze.test.mjs`

**Interfaces:**
- Consumes: `browser`, `openFixture`, `FIXTURE`, `VIEWPORTS`, and the `opts` self-skip object — all already defined at the top of `test/integration/analyze.test.mjs`.
- Produces:
  - `runAxe(page, viewports) -> Promise<{ [label]: Array<{ id:string, impact:string, help:string, wcag:string[], nodes:string[] }> }>` — runs axe at `viewports[0]` and `viewports[last]`; on a scan throw returns `[{ id:"scan-failed", impact:"unknown", help, wcag:[], nodes:[] }]` for that label.

- [ ] **Step 1: Add the failing axe test**

In `test/integration/analyze.test.mjs`, add this import beside the existing analyzer imports near the top:

```js
import { runAxe } from "../../src/analyze/axe.mjs";
```

And add this test AFTER the existing tests and BEFORE the `after(...)` hook:

```js
test("axe: surfaces the image-alt violation on the broken fixture", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  const axe = await runAxe(page, VIEWPORTS);
  const all = Object.values(axe).flat();
  assert.ok(!all.some(v => v.id === "scan-failed"), "axe scan should not fail on a file:// fixture");
  assert.ok(all.some(v => v.id === "image-alt"), "expected the image-alt violation (fixture <img> has no alt)");
  await page.context().close();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/integration/analyze.test.mjs`
Expected: FAIL on the axe test — `runAxe` throws `"not implemented — scaffold"` (browser present). If the machine has no browser the suite SKIPS; note it and proceed — the implementation is still required.

- [ ] **Step 3: Implement the axe analyzer**

Replace the entire contents of `src/analyze/axe.mjs` with:

```js
// Analyzer: axe-core scan.
//
// runAxe(page, viewports) -> { [viewportLabel]: violation[] }
// Runs axe at the widest and narrowest audited viewport. Each violation is reduced
// to { id, impact, help, wcag[], nodes[] }. A CSP that blocks the scan is reported as
// a single "scan-failed" pseudo-violation, never a throw.
//
// Pure inspector: takes a Playwright page, returns data. The bundled axe-core source
// is read once (memoized) — a dependency asset, not an artifact write.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

let axeSourcePromise = null;
function loadAxeSource() {
  if (!axeSourcePromise) {
    const require = createRequire(import.meta.url);
    axeSourcePromise = readFile(require.resolve("axe-core/axe.min.js"), "utf8");
  }
  return axeSourcePromise;
}

export async function runAxe(page, viewports) {
  const axeSource = await loadAxeSource();
  const out = {};
  // axe at the widest and narrowest audited widths
  for (const vp of [viewports[0], viewports[viewports.length - 1]]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(400);
    try {
      await page.addScriptTag({ content: axeSource });
      const res = await page.evaluate(async () => await axe.run(document, { resultTypes: ["violations"] }));
      out[vp.label] = res.violations.map(v => ({
        id: v.id, impact: v.impact, help: v.help,
        wcag: v.tags.filter(t => /^wcag\d/.test(t)),
        nodes: v.nodes.map(n => n.target.join(" ")).slice(0, 10),
      }));
    } catch (e) {
      out[vp.label] = [{ id: "scan-failed", impact: "unknown", help: `axe could not run (likely CSP): ${e.message}`, wcag: [], nodes: [] }];
    }
  }
  return out;
}
```

Note: inside `page.evaluate(async () => await axe.run(...))`, `axe` is the browser-injected global from `addScriptTag` — it is NOT the Node-side variable. This is correct and intentional.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/integration/analyze.test.mjs`
Expected: PASS (existing tests + the new axe test) with a browser; clean SKIP without. 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/analyze/axe.mjs test/integration/analyze.test.mjs
git commit -m "feat(analyze): port axe-core analyzer (scan-failed safe)"
```

---

### Task 2: Keyboard walk + trap analyzer

**Files:**
- Modify: `src/analyze/keyboard.mjs`
- Modify: `test/integration/analyze.test.mjs`

**Interfaces:**
- Consumes: `browser`, `openFixture`, `FIXTURE`, `opts` from the test module.
- Produces:
  - `walkTabOrder(page, { maxTabs=25, nvda=null }) -> Promise<Array<{ name:string, role:string, nvda?:string }>>`.
  - `detectKeyboardTrap(page) -> Promise<{ status:"pass"|"trap", at?:string, stops:number }>`.

- [ ] **Step 1: Add the failing keyboard test**

In `test/integration/analyze.test.mjs`, add this import beside the other analyzer imports:

```js
import { walkTabOrder, detectKeyboardTrap } from "../../src/analyze/keyboard.mjs";
```

And add this test AFTER the axe test and BEFORE the `after(...)` hook:

```js
test("keyboard: walks tab order and finds no trap on the broken fixture", opts, async () => {
  const page = await openFixture(browser, FIXTURE);
  const stops = await walkTabOrder(page, { maxTabs: 10 });
  assert.ok(stops.length >= 1, "expected at least one tab stop");
  assert.ok(stops.every(s => typeof s.role === "string" && s.role.length > 0), "every stop has a role");
  const trap = await detectKeyboardTrap(page);
  assert.equal(trap.status, "pass");
  await page.context().close();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/integration/analyze.test.mjs`
Expected: FAIL on the keyboard test — `walkTabOrder` throws `"not implemented — scaffold"` (browser present). SKIP if no browser; note and proceed.

- [ ] **Step 3: Implement the keyboard analyzer**

Replace the entire contents of `src/analyze/keyboard.mjs` with (ported verbatim from monolith lines 449–517; the NVDA driver is `opts.nvda`, never imported):

```js
// Analyzer: keyboard order walk + keyboard-trap detection.
//
// walkTabOrder(page, { maxTabs, nvda }) -> tabStops[]  { name, role, nvda? }
//   Tabs through the page capturing each stop's accessible name + role. With an NVDA
//   driver (opts.nvda), presses are issued through it and its spoken phrase is captured
//   per stop; otherwise names/roles are approximated from the DOM.
//
// detectKeyboardTrap(page) -> { status: "pass"|"trap", at?, stops }
//   Tabs the whole page (WCAG 2.1.2); if focus stops moving, users are trapped.
//
// Pure inspector aside from the optional NVDA driver passed in. No Windows import here.

export async function walkTabOrder(page, { maxTabs = 25, nvda = null } = {}) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  if (nvda) await page.bringToFront();
  const tabStops = [];
  for (let i = 0; i < maxTabs; i++) {
    let nvdaPhrase = null;
    if (nvda) {
      await nvda.clearSpokenPhraseLog();
      await nvda.press("Tab");            // NVDA presses the key → speech reflects real focus
      await page.waitForTimeout(600);     // let speech settle
      nvdaPhrase = (await nvda.spokenPhraseLog()).join(" ").replace(/\s+/g, " ").trim() || null;
      if (nvdaPhrase != null && nvdaPhrase.length > 300) nvdaPhrase = `${nvdaPhrase.slice(0, 300)}…`;
    } else {
      await page.keyboard.press("Tab");
    }
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const byId = id => document.getElementById(id)?.textContent.trim();
      let nm = el.getAttribute("aria-label")
        || (el.getAttribute("aria-labelledby") || "").split(/\s+/).map(byId).filter(Boolean).join(" ")
        || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent.trim())
        || (/^(BUTTON|A|SUMMARY)$/.test(el.tagName) && el.textContent.trim())
        || el.getAttribute("alt") || el.getAttribute("title") || el.getAttribute("placeholder") || "";
      const role = el.getAttribute("role")
        || ({ A: "link", BUTTON: "button", SELECT: "combo box", TEXTAREA: "edit" }[el.tagName]
        || (el.tagName === "INPUT" ? ({ radio: "radio button", checkbox: "check box", submit: "button" }[el.type] || "edit") : el.tagName.toLowerCase()));
      const req = el.getAttribute("aria-required") === "true" || el.required ? ", required" : "";
      return { name: nm.replace(/\s+/g, " ").slice(0, 70), role: role + req };
    });
    if (!info) break;
    if (tabStops.length && tabStops[0].name === info.name && tabStops[0].role === info.role) break;
    tabStops.push({ ...info, ...(nvdaPhrase != null && { nvda: nvdaPhrase }) });
  }
  if (nvda && !tabStops.length)
    throw new Error("NVDA walk captured no tab stops — the browser window likely lost OS focus during the walk. Keep the headed browser window foreground while --nvda runs.");
  return tabStops;
}

export async function detectKeyboardTrap(page) {
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  const focusSig = () => page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    const idx = [...document.querySelectorAll(el.tagName)].indexOf(el);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}@${idx}`;
  });
  let first = null, prev = null, same = 0, total = 0, trapAt = null;
  for (let i = 0; i < 300; i++) {
    await page.keyboard.press("Tab");
    const s = await focusSig();
    total++;
    if (s === prev) {
      // Repeats never count as a completed cycle — a trapped element can be the
      // first stop when tabbing resumes mid-page.
      same++;
      if (same >= 3) { trapAt = s; break; }
      continue;
    }
    same = 0;
    if (i === 0) first = s;
    else if (s === first || s === "BODY") break; // full cycle completed
    prev = s;
  }
  return trapAt ? { status: "trap", at: trapAt, stops: total } : { status: "pass", stops: total };
}
```

- [ ] **Step 4: Run the full integration + unit suites**

Run: `node --test test/integration/analyze.test.mjs`
Expected: PASS (all tests: layout, viewport-meta, strict, axe, keyboard) with a browser, or clean SKIP without. 0 failures.

Run: `npm run test:unit`
Expected: PASS — prior slices' 23 unit tests still green (no regression).

- [ ] **Step 5: Commit**

```bash
git add src/analyze/keyboard.mjs test/integration/analyze.test.mjs
git commit -m "feat(analyze): port keyboard walk + trap detection"
```

---

## Done criteria

- `src/analyze/axe.mjs` exports `runAxe`; `src/analyze/keyboard.mjs` exports `walkTabOrder` + `detectKeyboardTrap`; all pure (no file writes; only axe.mjs reads the bundled axe asset; no Windows/@guidepup import in keyboard.mjs).
- `runAxe` returns `scan-failed` rather than throwing on a blocked scan.
- `test/integration/analyze.test.mjs` gains the axe + keyboard tests, still self-skipping when no browser.
- `npm run test:integration` green (pass or clean self-skip); `npm run test:unit` still green.
- The analyze/* layer is complete; nothing out-of-scope (report/dashboard/wiring) added.
