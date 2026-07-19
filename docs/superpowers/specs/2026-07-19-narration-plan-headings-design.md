# Design: Narration plan + heading extraction

Date: 2026-07-19
Status: Draft (pending approval)

## Goal

Port the narration/action planner into `src/narrate/plan.mjs` (pure) and the heading
outline inspector into a new `src/analyze/headings.mjs` (browser), from the monolith
(`docs/_source-monolith.mjs.txt`). Together these produce the two remaining inputs the
Markdown report needs (`plan[]` for the step-by-step script, `analysis.headings` for
the heading outline), unblocking a faithful `buildMarkdown` port in a later slice.
Faithful extraction — no behavior change.

## Scope

### In scope

`src/narrate/plan.mjs` — pure planner (monolith lines 545–600):
- `buildNarration(analysis, opts) -> plan[]` where each entry is
  `{ text, pad, action }` and `action` is `null | { type: "tab" } | { type: "layout", vp }`.
  `opts = { viewports, host, diff = null, scrollMs = 7000 }`.
  Emits, in order: an intro line (nvda vs simulated), per-axe-viewport summaries, an
  optional baseline line (only when `diff` is passed), a headings line (main-heading or
  "no level-one heading"), a keyboard-walk intro + one `{type:"tab"}` entry per tab
  stop, an optional missing-viewport-meta warning, a strict-reflow line, a
  keyboard-trap line, one `{type:"layout", vp}` entry per viewport (pad `scrollMs`), and
  a closing line. Ported verbatim; reads only the analysis object + opts.
  - The documented stub signature is `buildNarration(analysis, { viewports })`; this
    extends `opts` with `host` (speech fallback when `analysis.title` is empty — the
    monolith's `host` var), `diff` (optional baseline, `null` here since no baseline is
    built yet), and `scrollMs` (the monolith `SCROLL_MS`, default 7000).

`src/analyze/headings.mjs` — NEW browser inspector (monolith lines 330–333):
- `readHeadings(page) -> Array<{ level:number, text:string }>` — visible `h1`–`h6`
  (`offsetParent !== null`), `level` = the tag digit, `text` normalized + capped at 80
  chars. Pure inspector: reads the page, writes nothing. Ported verbatim (including the
  visibility filter).

Tests:
- **New** `test/unit/narration.test.mjs` (pure, no browser): a hand-built `analysis`
  fixture drives `buildNarration`; assert the intro line + pad, per-viewport axe lines
  (a populated + an empty state), the "no level-one heading" line when `headings` has no
  h1, one `{type:"tab"}` entry per tab stop, the missing-viewport-meta warning when
  `viewportMeta` is null, one `{type:"layout", vp}` entry per viewport with pad =
  `scrollMs`, and the closing line + pad 1200.
- **Extend** `test/integration/analyze.test.mjs` (reusing the browser self-skip harness):
  `readHeadings(page)` on the broken fixture returns exactly one heading `{level:2, …}`
  and no `level:1` (the fixture deliberately has an `<h2>` and no `<h1>`).

### Out of scope (later slices)

- `buildMarkdown` / PDF (next slice — now unblocked once this lands).
- TTS/recording/video (`narrate/tts*`, `record.mjs`) — the plan is consumed there, but
  the plan itself is pure and independent.
- Baseline `diff` production, page-`title` extraction wiring (a trivial `page.title()`
  the caller makes in `runAudit`), emulation metadata — all caller/runAudit concerns.

## Interfaces

```
buildNarration(analysis, { viewports, host, diff = null, scrollMs = 7000 })
  -> Array<{ text: string, pad: number, action: null | {type:"tab"} | {type:"layout", vp} }>

readHeadings(page) -> Array<{ level: number, text: string }>
```

`buildNarration` reads: `analysis.{nvdaUsed, title, axe, headings, tabStops, viewportMeta, strict, keyboardTrap, layout}`.

## Boundaries (from CLAUDE.md)

- `narrate/plan.mjs` is **pure**: no browser, no TTS, no I/O — a pure function of the
  analysis object. This is the seam that lets the report and video describe the same
  page state.
- `analyze/*` are pure inspectors: read the page, write nothing.
- **Security invariant:** narration never includes auth values — `buildNarration` reads
  only `analysis.*` findings + opts; no cookies/headers.
- Port verbatim — do not change the phrasing, pad values (800/900/700/500/400/1200/
  `scrollMs`), the `{type}` action tags, the heading visibility filter, or the 80-char
  heading cap.
- ESM only; each file well under ~300 lines.

## Testing strategy

- `buildNarration` is unit-tested pure (no browser) with a literal `analysis` fixture,
  so `npm run test:unit` stays fast and green everywhere.
- `readHeadings` is integration-tested against the local fixture via the existing
  self-skip harness, so `npm run test:integration` stays green with or without a browser.

## Acceptance criteria

- [ ] `buildNarration(analysis, opts)` exported from `src/narrate/plan.mjs`, ported
      verbatim, pure (no browser/TTS/I/O), reads no auth data.
- [ ] `readHeadings(page)` exported from `src/analyze/headings.mjs`, ported verbatim
      including the `offsetParent` visibility filter; no writes.
- [ ] `test/unit/narration.test.mjs` added (intro, axe lines, no-h1 line, tab entries,
      viewport-meta warning, layout entries w/ scrollMs pad, closing line).
- [ ] `test/integration/analyze.test.mjs` gains a `readHeadings` assertion (one h2, no
      h1 on the fixture), still self-skipping when no browser.
- [ ] `npm run test:unit` green (prior 25 + new narration tests); `npm run test:integration`
      green (prior 5 + headings).
