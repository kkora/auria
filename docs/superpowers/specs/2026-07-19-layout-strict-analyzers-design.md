# Design: Layout + strict analyzers port

Date: 2026-07-19
Status: Draft (pending approval)

## Goal

Port the responsive-layout and strict-WCAG inspectors from the monolith
(`docs/_source-monolith.mjs.txt`) into `src/analyze/layout.mjs` and
`src/analyze/strict.mjs`, and un-skip the existing integration test
(`test/integration/analyze.test.mjs`) that already targets them against the
`test/fixtures/broken-page.html` fixture. Faithful extraction — no behavior change.

This is the next slice after the pure-foundation port. It is the first slice to use
a real browser (Playwright + installed Edge/Chrome), and it defines the
`analysis.layout` / `analysis.strict` data shapes that the future `report/*` layer
consumes.

## Scope

### In scope

`src/analyze/layout.mjs` — pure inspector (monolith lines 353–393):
- `runLayout(page, viewports) -> { [label]: { overflowPx, overflowing[], smallTargets[], tinyText[] } }`
  For each viewport: sets the viewport size, waits 500ms, then evaluates in-page —
  horizontal overflow px (`scrollWidth - clientWidth`, floored at 0), per-element
  `overflowing` / `smallTargets` (interactive < 24px, WCAG 2.5.8) / `tinyText`
  (< 12px with a text child). SR-only (≤1×1) and `display:none`/`visibility:hidden`
  elements excluded; each list deduped by element key and capped at 8. The in-page
  `short` / `dedup` helpers stay inside the `page.evaluate` block, ported verbatim.
- `readViewportMeta(page) -> string | null` — the `<meta name="viewport">` content
  (monolith line 353–354), exported separately per the stub's documented interface.

`src/analyze/strict.mjs` — pure inspector (monolith lines 433–447):
- `runStrict(page) -> { reflow320, zoom200 }`
  `reflow320`: sets viewport to 320×800, waits 500ms, measures overflow px (WCAG
  1.4.10 exact). `zoom200`: restores 1280×900, applies `document.documentElement.style.zoom = "2"`,
  waits 400ms, measures overflow, then clears zoom. Leaves the page at 1280×900 on
  return (matching the monolith, which then runs the keyboard walk).

Test helper — `test/helpers/browser.mjs` (new):
- `launchBrowser() -> browser | null` — tries channel `msedge` then `chrome`;
  returns `null` if neither launches (no throw).
- `openFixture(browser, fileUrl) -> page` — new context + page, `goto(fileUrl, { waitUntil: "load" })`.
- Exposes the default `VIEWPORTS` (Desktop 1280×900, Tablet 820×1080, Phone 375×812)
  so the test can pass a viewport list without duplicating it.

Tests — un-skip and complete `test/integration/analyze.test.mjs`:
- Replace the `PENDING` skip with a **browser-availability self-skip**: if
  `launchBrowser()` returns `null`, skip the suite (mirrors the Windows-only
  self-skip convention in CLAUDE.md), so `npm run test:integration` stays green on a
  machine without Edge/Chrome.
- `layout`: on the broken fixture, `runLayout(page, VIEWPORTS).Phone.overflowPx > 1`.
- `strict`: `runStrict(page).reflow320 > 0` on the broken fixture.
- Add: `readViewportMeta` returns the fixture's viewport meta (or asserts `null`
  handling) — small, confirms the separate export.

### Out of scope (later slices)

- `axe` and `keyboard` analyzers (separate slice — axe-core injection, NVDA seam).
- The annotated-screenshot block (monolith 395–429) — that is `report/screenshots`
  + `--screenshots` gating, not the layout analyzer.
- `runAudit`/`runJobs` wiring, `bin/`, reports, dashboard.
- Emulation (`colorScheme`/`reducedMotion`) and auth — set up by `runAudit`, not these
  inspectors.

## Interfaces (data shapes downstream code will rely on)

```
runLayout(page, viewports) -> {
  [label]: {
    overflowPx: number,
    overflowing:  Array<{ el: string, px: number }>,   // ≤ 8, desc by px
    smallTargets: Array<{ el: string, size: string }>,  // ≤ 8, e.g. "20×18"
    tinyText:     Array<{ el: string, px: number }>,    // ≤ 8
  }
}
readViewportMeta(page) -> string | null
runStrict(page) -> { reflow320: number, zoom200: number }
```

## Boundaries (from CLAUDE.md)

- `analyze/*` are pure inspectors: take a Playwright `page`, return data. **No file
  writes.** They MAY read/drive the page (set viewport, evaluate) — that is what an
  inspector does — but must not write artifacts or open their own browser (the
  caller owns the browser lifecycle; the test helper owns it in tests).
- Port logic verbatim from the monolith; do not change thresholds (24px, 12px, the
  ±1px overflow tolerance, the 4000-element cap, the 8-item cap) or timings
  (500/400ms waits) — these are tuned WCAG/timing decisions.
- ESM only. Keep each file focused and well under ~300 lines.

## Testing strategy

- `npm run test:integration` runs the analyze suite; it **self-skips** cleanly when
  no browser is available, and otherwise launches the installed Edge/Chrome against
  the local `file://` fixture (no network).
- The fixture `test/fixtures/broken-page.html` already exists and is intended to
  exhibit phone-width overflow and 320px reflow overflow; the assertions use `> 1` /
  `> 0` rather than exact px so they are robust to platform rendering differences.
- Unit-level purity of the in-page helpers is not separately unit-tested — they run
  inside `page.evaluate` and are covered by the integration assertions, matching the
  monolith's structure.

## Acceptance criteria

- [ ] `runLayout` + `readViewportMeta` exported from `src/analyze/layout.mjs`, ported
      verbatim; no file writes.
- [ ] `runStrict` exported from `src/analyze/strict.mjs`, ported verbatim; leaves the
      page at 1280×900.
- [ ] `test/helpers/browser.mjs` provides `launchBrowser`, `openFixture`, `VIEWPORTS`.
- [ ] `test/integration/analyze.test.mjs` un-skipped, self-skipping when no browser,
      with the layout + strict + viewport-meta assertions passing when a browser is
      present.
- [ ] `npm run test:integration` is green (pass or clean self-skip); `npm run test:unit`
      remains green.
