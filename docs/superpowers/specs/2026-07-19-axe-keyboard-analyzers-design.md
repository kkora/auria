# Design: Axe + keyboard analyzers port

Date: 2026-07-19
Status: Draft (pending approval)

## Goal

Port the remaining two page inspectors from the monolith
(`docs/_source-monolith.mjs.txt`) into `src/analyze/axe.mjs` and
`src/analyze/keyboard.mjs`, completing the `analyze/*` layer. Extend the existing
browser-backed integration suite to cover them. Faithful extraction — no behavior
change.

This is the third porting slice. It reuses the browser test helper and self-skip
harness from the layout+strict slice. After it, the whole `analyze/*` surface is
implemented and the `report/*` layer (pure, no browser) is fully unblocked.

## Scope

### In scope

`src/analyze/axe.mjs` — axe-core scan (monolith lines 335–350, plus the axe-source
load at line 171):
- `runAxe(page, viewports) -> { [label]: violation[] }` — runs axe at the **widest and
  narrowest** audited viewport (`viewports[0]` and `viewports[at end]`). Each violation
  reduced to `{ id, impact, help, wcag: string[], nodes: string[] }` (wcag = tags
  matching `/^wcag\d/`; nodes = `target.join(" ")`, capped at 10). A scan that throws
  (e.g. CSP blocks injection) yields a single `scan-failed` pseudo-violation, **never a
  throw**.
- Axe source is loaded via a memoized module-level helper `loadAxeSource()` that reads
  `axe-core/axe.min.js` resolved with `createRequire(import.meta.url).resolve("axe-core/axe.min.js")`.
  Signature stays the documented 2-arg `runAxe(page, viewports)`.

`src/analyze/keyboard.mjs` — keyboard walk + trap detection (monolith lines 449–517):
- `walkTabOrder(page, opts) -> tabStops[]` where `opts = { maxTabs = 25, nvda = null }`.
  Blurs + scrolls to top, then tabs up to `maxTabs` times. Per stop, captures the
  accessible **name** (aria-label → aria-labelledby → `<label for>` → button/link/summary
  text → alt/title/placeholder) and **role** (role attr → tag/type mapping, plus
  `, required`). Stops early when focus returns to `document.body`/null or loops back to
  the first stop. When an `nvda` driver is passed, each Tab is issued **through the
  driver** and its spoken phrase is captured per stop (`nvda` field); otherwise names are
  DOM-approximated. Throws only in the NVDA case when zero stops were captured (lost OS
  focus) — matching the monolith.
- `detectKeyboardTrap(page) -> { status: "pass"|"trap", at?, stops }` — tabs up to 300
  times using a focus signature; if focus stalls on one element ≥3 times it reports a
  trap, otherwise pass on a completed cycle (WCAG 2.1.2).

Tests — extend `test/integration/analyze.test.mjs` (reusing `launchBrowser`/`openFixture`/
`opts` self-skip already there):
- `axe`: `runAxe(page, VIEWPORTS)` on the broken fixture surfaces the `image-alt`
  violation (the fixture has an `<img>` with no `alt`) at a viewport — assert it is
  present and that no viewport reports `scan-failed`.
- `keyboard`: `walkTabOrder(page, { maxTabs: 10 })` returns ≥1 stop, each with a
  non-empty `role`; `detectKeyboardTrap(page)` returns `status: "pass"` on the fixture
  (its two focusable controls form a completable cycle).

### Out of scope (later slices)

- The real NVDA driver (`src/nvda.mjs`) — this slice only keeps the `opts.nvda` seam;
  it is never exercised here (tests pass `nvda` unset → DOM approximation).
- `report/*`, `dashboard`, `runAudit`/`runJobs` wiring, `bin/`, narration/video.
- Heading-outline extraction (monolith 332–333) — belongs with report/analysis wiring,
  not these two inspectors; not part of the documented axe/keyboard contracts.

## Interfaces (data shapes downstream code relies on)

```
runAxe(page, viewports) -> {
  [label]: Array<{ id:string, impact:string, help:string, wcag:string[], nodes:string[] }>
}   // impact one of minor|moderate|serious|critical|unknown; scan-failed => id:"scan-failed", impact:"unknown"

walkTabOrder(page, { maxTabs=25, nvda=null }) -> Array<{ name:string, role:string, nvda?:string }>
detectKeyboardTrap(page) -> { status:"pass"|"trap", at?:string, stops:number }
```

## Boundaries (from CLAUDE.md)

- `analyze/*` are pure inspectors: drive/read the `page`, return data, **write no
  artifacts**. `axe.mjs` performs a one-time **read** of the bundled `axe-core/axe.min.js`
  dependency asset (memoized) — reading a package asset is not writing an artifact, and
  it keeps the documented 2-arg signature; this is the single accepted file read and is
  isolated in `loadAxeSource()`.
- The NVDA dependency stays **out** of the analyzer: the driver is injected via
  `opts.nvda`. No `@guidepup`/Windows import in `keyboard.mjs`. This preserves the
  cross-platform core (only `src/nvda.mjs`, a later slice, is Windows-bound).
- Port logic verbatim — do not change the node cap (10), name/role derivation, the
  early-break conditions, the 300-tab trap ceiling, or the `same >= 3` trap threshold.
- ESM only; each file well under ~300 lines.

## Testing strategy

- Reuse the layout+strict slice's browser helper + self-skip: the new axe/keyboard
  tests run against the real Edge/Chrome and the local `file://` fixture, or self-skip
  when no browser is present, so `npm run test:integration` stays green everywhere.
- Assertions are tolerant to rendering/engine variance: check for a specific well-known
  axe rule (`image-alt`, which the fixture unambiguously violates) rather than exact
  counts, and check `role` non-empty / trap `status === "pass"` rather than exact stop
  lists.
- `npm run test:unit` must stay green (no regression to prior slices).

## Acceptance criteria

- [ ] `runAxe` exported from `src/analyze/axe.mjs`; runs at widest+narrowest viewport;
      maps violations to `{ id, impact, help, wcag, nodes }`; `scan-failed` on throw,
      never throws; axe source memoized-read via `createRequire` resolve.
- [ ] `walkTabOrder` + `detectKeyboardTrap` exported from `src/analyze/keyboard.mjs`,
      ported verbatim; NVDA driver only via `opts.nvda`; no Windows/`@guidepup` import.
- [ ] `test/integration/analyze.test.mjs` gains axe (`image-alt` present, no
      `scan-failed`) and keyboard (stops with roles, trap `pass`) tests, still
      self-skipping when no browser.
- [ ] `npm run test:integration` green (pass or clean self-skip); `npm run test:unit`
      still green.
- [ ] `analyze/*` layer complete; nothing out-of-scope (no report/dashboard/wiring) added.
