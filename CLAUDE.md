# CLAUDE.md — Auria

Guidance for Claude Code (and human contributors) working in this repository.
Read this before making changes. For product strategy, see [docs/PLAN.md](docs/PLAN.md).

## What Auria is

A web **accessibility + responsive-layout auditor**. Given a URL (or a whole site),
it runs axe-core, per-viewport layout checks, strict WCAG passes, and a keyboard
walk, then emits a **narrated video**, reports (MD/PDF/JSON/SARIF/JUnit), annotated
screenshots, and dashboards. Origin: `tools/a11y-video-audit.mjs` in the
`cpp-payment-ui` project, being extracted here into an independent, testable package.

> **Current state:** this repo is a **scaffold**. Most `src/` files are stubs with a
> responsibility comment and a `TODO`. The working implementation still lives in the
> original monolith; port it into these modules per [docs/architecture.md](docs/architecture.md).

## Prerequisites

- **Node.js ≥ 22** (uses ESM + `node:test`; the runner's glob patterns need ≥ 21).
- **Edge or Chrome installed** — the tool drives your installed browser via
  `playwright-core` (channel `msedge`, then `chrome`). No browser download.
- **Windows** for the default narration (`System.Speech` via `assets/gen-voice.ps1`)
  and for `--nvda` (real screen reader). The audit + reports run cross-platform;
  only Windows-native narration and NVDA are OS-bound. See the platform note below.
- **NVDA** (optional, Windows) for `--nvda`: install from nvaccess.org, then run
  `npx @guidepup/setup` once.

## Setup

```bash
npm install
```

`ffmpeg` ships via `ffmpeg-static`; `axe-core`, `playwright-core`, and
`@guidepup/guidepup` come from `package.json`. Nothing else to install for the CLI.

## Run

```bash
# Single page
node bin/auria.mjs https://example.gov/payment-page

# Analysis only (fast, no video) — the iteration loop
node bin/auria.mjs https://example.gov/payment-page --no-video

# Many pages / a whole site
node bin/auria.mjs --config examples/pages.sample.json
node bin/auria.mjs https://example.gov/ --crawl --max-pages 20
```

Full flag + config reference: [docs/cli.md](docs/cli.md).

## Test

```bash
npm test                 # all node:test suites
npm run test:unit        # pure logic, no browser (fast)
npm run test:integration # analyzers against local fixtures
```

Windows-only suites (TTS, NVDA availability) self-skip on non-Windows machines.

## Repository map

| Path | Responsibility |
| --- | --- |
| `bin/auria.mjs` | CLI entry — **arg parsing only**, delegates to `src/index.mjs`. |
| `src/config.mjs` | Flags + config file → normalized job list (precedence: page → config → default). |
| `src/crawl.mjs` | BFS page discovery, URL normalization, include/exclude filters. |
| `src/analyze/*` | Pure page inspectors — take a Playwright `page`, return data. No I/O. |
| `src/narrate/*` | Narration script + **pluggable TTS** (`tts.mjs` is the cross-platform seam). |
| `src/record.mjs` | Playwright video record + caption overlay + ffmpeg mux. |
| `src/nvda.mjs` | Windows-only real NVDA driver. |
| `src/report/*` | Analysis data → MD / PDF / SARIF / JUnit / screenshots. No browser. |
| `src/dashboard.mjs` | Global + per-host `index.html`. |
| `assets/gen-voice.ps1` | Windows TTS renderer (called by `tts-windows.mjs`). |

## Rules

**Architecture**
- Keep module boundaries clean: `analyze/*` never write files; `report/*` and
  `dashboard.mjs` never open a browser; `bin/` only parses args.
- All narration/video code depends on the **`tts.mjs` interface**, never on
  `System.Speech` directly — this is what lets the engine run headless on Linux for
  the SaaS. Do not reintroduce a hard Windows dependency outside `tts-windows.mjs`
  and `nvda.mjs`.
- Config resolution order is always **per-page value → top-level config → built-in
  default**. Preserve it.

**Security & privacy**
- **Never write auth values (cookies, headers) into any report or artifact** — only
  counts. This is a hard invariant carried over from the original tool.
- Don't commit audit output (`a11y-audits/`, `audits/`), `.wav`/`.mp4` intermediates,
  or `node_modules`. See `.gitignore`.

**Code style**
- ESM only (`"type": "module"`). Match the existing terse, comment-the-*why* style of
  the source — explain non-obvious decisions (timing, WCAG thresholds), not the obvious.
- Prefer small focused files; if a file grows past ~300 lines it is probably doing
  too much — split it.

**Testing**
- New analyzer logic ships with a fixture + integration test. Pure helpers ship with
  a unit test. Don't rely on live network in tests — use `test/fixtures/`.
- Run `npm test` before considering a change done.

**Process**
- This is a scaffold pending direction (see [docs/PLAN.md](docs/PLAN.md) §9 open
  items). Don't build the SaaS layer (API, queue, web app) into this repo without
  confirming the phase — P1 is "extract & harden the CLI".

## Platform note

The audit engine, reports, dashboards, crawler, and (with cross-platform TTS) even
the narrated video are OS-independent. **Only** `tts-windows.mjs` and `nvda.mjs` are
Windows-bound. When adding features, keep them in the cross-platform core unless they
genuinely require the OS, so the same code can run in a Linux SaaS worker.
