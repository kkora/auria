# Design: Pure foundation port (`config.mjs` + `crawl.mjs` helpers)

Date: 2026-07-19
Status: Approved (design), pending implementation plan

## Goal

Port the pure, browser-free logic from the monolith
(`docs/_source-monolith.mjs.txt`) into the `src/config.mjs` and `src/crawl.mjs`
stubs, matching the contracts documented in `docs/crawl.md` and `docs/cli.md`, and
un-skip the unit test suite. This is a faithful extraction with **no behavior
change** from the monolith, plus one hardening improvement: inline `process.exit`
CLI code becomes pure functions that return data or throw.

This is the dependency-correct first slice of the P1 "extract & harden the CLI"
phase (per `CLAUDE.md`): nothing downstream (analyze, report, dashboard, the
`runJobs` wiring) can be built until config produces a job list and crawl can
normalize/dedupe URLs.

## Scope

### In scope

`src/crawl.mjs` — pure parts only (monolith lines 58–70):
- `normalizeUrl(href, base)` — absolute, hash-stripped, trailing-slash-trimmed
  (root keeps `/`); returns `null` for non-`http(s)/file` schemes and for skipped
  extensions. Ported verbatim.
- `sameOrigin(a, b)` — protocol + host match. Ported verbatim.
- `SKIP_EXT` regex stays module-private (not exported).
- `discoverPages` **remains a stub** that throws — it needs Playwright and belongs
  to the next slice. Its `TODO(port)` comment stays intact.

`src/config.mjs` — pure parts (monolith lines 33–145, 191–203):
- `slugify(s)`, `slugFromUrl(u)` — ported verbatim (lines 54–56).
- `normalizeAuth(auth, url)` — ported verbatim (lines 191–203). Produces cookie /
  header structures for Playwright only.
- `parseConfigFile(cfg)` → `{ jobs, crawl }` — the config-file branch (lines
  83–111) as a pure function that takes **already-parsed JSON** (file reading stays
  in the caller, per the architecture note that config may only read the config
  file, and to keep this function unit-testable without the filesystem).
- `parseCli(argv)` → `{ jobs, crawlOpts }` — the positional/flag branch (lines
  33–145) refactored to take `argv` and **return data instead of calling
  `process.exit`**. Preserves the per-page → config → default precedence exactly.

Tests:
- **Un-skip** `test/unit/url-normalize.test.mjs` (remove the `PENDING` skip). Passes
  as-is against the real `normalizeUrl`.
- **New** `test/unit/config.test.mjs` covering `slugify` edge cases, `normalizeAuth`
  variants, and `parseCli` / `parseConfigFile` precedence.

### Out of scope (later slices)

`discoverPages` + browser, `analyze/*`, `narrate/*`, `record.mjs`, `report/*`,
`dashboard.mjs`, `runAudit`/`runJobs` wiring, and `bin/auria.mjs` arg wiring.
Nothing is end-to-end runnable from this slice — that is expected and intended.

## Error handling

The monolith's CLI branch calls `console.error(...)` + `process.exit(1)` inline for
usage errors (missing URL, unreadable/empty config, page without a `url`). To keep
`config.mjs` pure and testable, these become **thrown errors**:

- Introduce a tagged error (a plain `Error` with a `usage = true` property, e.g. via
  a small `usageError(message)` helper) for user-facing usage problems.
- `bin/auria.mjs` (a later slice) will catch it: `usage`-tagged → print the message
  (and usage string) and exit 1; any other throw is an unexpected crash.

This distinguishes "bad invocation → print usage, exit 1" from an internal bug,
preserving the monolith's observable behavior while making the logic unit-testable.

## Boundaries (unchanged from architecture.md)

- `config.mjs` and `crawl.mjs` stay pure: no `process.exit`, no browser, no file
  writes. Config-file *reading* (`readFile` + `JSON.parse`) is the caller's job;
  `parseConfigFile` receives the already-parsed object.
- Security invariant carried over: `normalizeAuth` only builds cookie/header
  structures for Playwright. No code in this slice serializes auth values into any
  report or artifact. The config unit test asserts the returned shape.

## Testing strategy

- `npm run test:unit` must pass with the url-normalize suite un-skipped and the new
  config suite added. No browser required, so it runs in CI and locally in
  milliseconds.
- Precedence tests assert: a per-page value wins over a top-level config value,
  which wins over the built-in default, for a representative property (e.g. `tabs`
  or `format`).
- `normalizeAuth` tests cover: string cookies (`"a=1; b=2"`), array cookies (with
  and without an explicit domain/url), headers object, and the empty/undefined case
  returning `{ cookies: [], headers: {} }`.

## Acceptance criteria

- [ ] `normalizeUrl` and `sameOrigin` exported from `src/crawl.mjs`; `discoverPages`
      still a throwing stub with its `TODO(port)`.
- [ ] `slugify`, `slugFromUrl`, `normalizeAuth`, `parseConfigFile`, `parseCli`
      exported from `src/config.mjs`, all pure (no `process.exit`, no browser).
- [ ] `test/unit/url-normalize.test.mjs` un-skipped and passing.
- [ ] `test/unit/config.test.mjs` added and passing.
- [ ] `npm run test:unit` green.
