# Design: CI report serializers (SARIF + JUnit)

Date: 2026-07-19
Status: Draft (pending approval)

## Goal

Port the two CI-facing report serializers from the monolith
(`docs/_source-monolith.mjs.txt`) into `src/report/sarif.mjs` and
`src/report/junit.mjs` as **pure functions** (analysis data → string/object, no file
writes), with unit tests. Faithful extraction — no behavior change.

This is the first `report/*` slice. It is deliberately scoped to the two reporters
whose inputs are already produced by the completed `analyze/*` layer.

## Why only SARIF + JUnit (not Markdown/PDF yet)

`buildMarkdown` (and the PDF that renders it) depend on data this build does not yet
produce: the narration `plan` (step-by-step script), `analysis.headings` (no heading
analyzer ported), the baseline `diff`, `emu`/`auth` metadata, `analysis.screenshots`,
and `outVideo`. A faithful markdown port is therefore blocked until those land.
SARIF and JUnit depend **only** on `analysis.axe`, `analysis.strict`, and
`analysis.keyboardTrap` — all produced today — so they are the correct next slice.

## Scope

### In scope

`src/report/sarif.mjs` — pure serializer (monolith lines 861–892, minus the
`if (job.sarif)` gate and the file write):
- `buildSarif(analysis, { url }) -> object` — SARIF 2.1.0 object. Walks
  `analysis.axe` (`{ [state]: violation[] }`); dedupes rules by `id`
  (`{ id, shortDescription:{text:help}, properties:{wcag} }`); one result per axe node
  with `level` mapped from impact (`critical|serious → error`, `moderate → warning`,
  `minor → note`, default `warning`), `message.text = "<help> [<state> width]"`, and a
  location whose `artifactLocation.uri = url` and `logicalLocations[0].fullyQualifiedName = node`.
  Returns the object `{ $schema, version:"2.1.0", runs:[{ tool:{driver:{name,version,rules}}, results }] }`.
  The caller stringifies + writes `${name}.sarif`.

`src/report/junit.mjs` — pure serializer (monolith lines 895–913, minus gate + write):
- `buildJunit(analysis, { url }) -> string` — JUnit XML string. One `<testcase>` per
  axe rule per viewport state (a `<failure>` with help+impact and newline-joined nodes;
  an empty `axe scan` testcase when a state has no violations), plus three strict/keyboard
  cases via a `strictCase` helper: `reflow-320px` (fail when `strict.reflow320 > 0`),
  `zoom-200pct` (fail when `strict.zoom200 > 0`), `keyboard-trap` (fail when
  `keyboardTrap.status === "trap"`). `tests` = case count, `failures` = count of
  `<failure` occurrences. All text XML-escaped via the ported `xmlEsc`.
  The caller writes `${name}-junit.xml`.

Tests — new `test/unit/report.test.mjs` (pure, no browser):
- Build a small representative `analysis` fixture inline: `axe` with a `critical` and a
  `minor` violation at one state (plus an empty state), `strict:{reflow320:12, zoom200:0}`,
  `keyboardTrap:{status:"pass", stops:3}`.
- SARIF: assert `$schema`/`version`, that rules are deduped by id, the impact→level
  mapping (`critical → error`, `minor → note`), the `message.text` includes the state,
  and the location `uri` equals the passed `url`.
- JUnit: assert the string is well-formed-ish (`<testsuite … tests="N" failures="M">`),
  that `failures` counts only `<failure` cases (the `reflow-320px` failure present,
  `zoom-200pct` + `keyboard-trap` passing), and that XML-escaping is applied (feed a
  help string containing `<`/`&`/`"`).

### Out of scope (later slices)

- `buildMarkdown` / PDF / screenshots (blocked on narration plan, headings analyzer,
  baseline diff, emulation/auth metadata, video).
- `dashboard.mjs`, `runAudit`/`runJobs` wiring, `bin/`.
- The `--sarif`/`--junit` gating and the actual file writes — those live in the caller
  (`runAudit`, a later slice); these functions only serialize.

## Interfaces

```
buildSarif(analysis, { url }) -> {
  $schema: string, version: "2.1.0",
  runs: [{ tool: { driver: { name, version, rules: Rule[] } }, results: Result[] }]
}
buildJunit(analysis, { url }) -> string   // "<?xml …?>\n<testsuite …>…</testsuite>\n"
```

Both read: `analysis.axe` (both), `analysis.strict.{reflow320,zoom200}` + `analysis.keyboardTrap.{status,at,stops}` (JUnit only).

## Boundaries (from CLAUDE.md)

- `report/*` never open a browser. These two are pure serializers that also do **no
  file writes** — the caller persists them. (The architecture table permits report/*
  to write files, but keeping the serializer pure makes it unit-testable and lets
  `runAudit` own all file I/O; the PDF/screenshot reporters that genuinely need a
  renderer will be the ones that touch disk/browser.)
- **Security invariant:** auth values never appear in any report. SARIF/JUnit here only
  ever read `analysis.*` findings and the page `url`; they never touch cookies/headers.
- Port logic verbatim — do not change the impact→level map, the `message.text` format,
  the empty-state `axe scan` testcase, the `failures` counting, or the XML-escape set.
- ESM only; each file well under ~300 lines.

## Testing strategy

- Pure unit tests in `test/unit/report.test.mjs` — no browser, no fixture HTML, no file
  I/O. Construct the `analysis` object literally so the reporters are exercised in
  isolation and `npm run test:unit` stays fast and green everywhere.
- `npm run test:integration` remains unaffected (still 5 analyzer tests).

## Acceptance criteria

- [ ] `buildSarif(analysis, { url })` exported from `src/report/sarif.mjs`, returns the
      SARIF 2.1.0 object, ported verbatim; no file writes, no browser.
- [ ] `buildJunit(analysis, { url })` exported from `src/report/junit.mjs`, returns the
      JUnit XML string, ported verbatim; no file writes, no browser.
- [ ] `test/unit/report.test.mjs` added: SARIF (schema, rule dedupe, level mapping,
      state in message, url location) + JUnit (testsuite counts, failure counting,
      XML-escaping) assertions passing.
- [ ] `npm run test:unit` green (prior 23 + new report tests); `npm run test:integration`
      unaffected.
