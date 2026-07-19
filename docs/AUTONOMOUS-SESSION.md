# Autonomous build session — 2026-07-19

Kanchan asked me to build the remaining Auria features autonomously: one feature at a
time, TDD, commit → merge to `develop` → push, without waiting for approval. This doc
is the running record to review on return. Anything needing a decision or flagged as a
future enhancement is in the two lists at the bottom.

**Commit policy:** all commits are `kkora <kora.kanchan@hotmail.com>` only — no
`Co-Authored-By` trailer. `master` is locked; `develop` is default; work flows through
short-lived `feat/*` branches merged into `develop` and pushed.

## Roadmap (dependency order)

1. narration plan (`narrate/plan.mjs`) + heading extraction (`analyze/headings.mjs`) — unblocks the Markdown report.
2. Markdown report (`report/markdown.mjs`) — the single-source human report.
3. PDF report (`report/pdf.mjs`) — renders the Markdown/HTML to A4 PDF (browser).
4. Dashboard (`dashboard.mjs`) — global + per-host `index.html` from the output tree.
5. Annotated screenshots (`report/screenshots.mjs`) — per-viewport PNGs (browser).
6. First runnable wiring: `runAudit`/`runJobs` (`src/index.mjs`) + `bin/auria.mjs` for the analysis-only (`--no-video`) path — makes `node bin/auria.mjs <url> --no-video` produce artifacts end-to-end.
7. Crawl `discoverPages` (`crawl.mjs`) — browser BFS.
8. Video path (`narrate/tts*`, `record.mjs`) — Windows TTS + ffmpeg mux (platform-specific).
9. Baseline diff, real NVDA driver (`nvda.mjs`) — later.

## Build log (what I built)

_(newest last; each entry: slice — tests — notes)_

1. **Narration plan + heading inspector** — `src/narrate/plan.mjs` (`buildNarration`, pure), `src/analyze/headings.mjs` (`readHeadings`, browser). Unit +9, integration +1. Unblocked the Markdown report.
2. **Markdown report** — `src/report/markdown.mjs` (`buildMarkdown`, pure single-source report). Unit +7 incl. a security test that auth values never leak.
3. **PDF report** — `src/report/pdf.mjs` (`markdownToHtml` pure + `renderPdf` browser, warn-not-throw). Unit +5, integration +1 (real %PDF magic-byte check).
4. **Dashboard** — `src/dashboard.mjs` (`collectRows`, `renderDashboard`, `writeDashboards`, fs only). Unit +4.
5. **Annotated screenshots** — `src/report/screenshots.mjs` (`captureScreenshots`, browser+fs). Integration +1 (PNG magic bytes, marked offenders).
6. **Runnable wiring** — `src/browser.mjs` (`launchBrowser`, `applySteps`), `src/index.mjs` (`runAudit` analysis-only pipeline + `runJobs`), `bin/auria.mjs` (parseCli/parseConfigFile → runJobs, usage-error handling). Integration +2 end-to-end. **The CLI now runs**: `node bin/auria.mjs <url> --no-video --sarif --junit --md` produces axe.json + MD + PDF + SARIF + JUnit + dashboards. Verified against the local fixture (10 axe violations, exit 0). Includes optional baseline diff and fail-on gating.

Totals after slice 6: **unit 50, integration 10, all green.**

## Decisions I made autonomously

_(things I chose without asking; override any you disagree with)_

- **Reports return values; the engine writes files.** `buildSarif`/`buildJunit`/`buildMarkdown`/`markdownToHtml` are pure and return objects/strings; `runAudit` (`src/index.mjs`) owns all file writes. Keeps reporters unit-testable and centralizes I/O.
- **NVDA driver injected, never imported** in `analyze/keyboard.mjs` (via `opts.nvda`) so the core stays cross-platform.
- **`runAudit` currently runs analysis-only.** Video is ON by default in the flags, but the video pipeline isn't wired yet, so a video-requested run prints a one-line note and produces reports only (no failure). `--nvda` throws a clear "not wired yet" error rather than silently degrading.
- **`--crawl` is parsed but not executed yet** (`discoverPages` pending); `bin/` prints a note and audits the seed page(s) only.
- **`renderPdf` warns and continues on failure** (matches the original) rather than aborting the audit.
- **Fast implementation path:** for these verbatim ports I implemented directly with TDD + full-suite verification rather than the multi-subagent review flow, to keep throughput. A formal review pass can still be run later if you want one.

## Needs your review / approval

- Nothing blocking. When you're back, decide whether to (a) wire the **video pipeline** (`narrate/tts*` + `record.mjs`, Windows-TTS + ffmpeg — platform-specific and the biggest remaining piece), (b) wire the **crawler** (`discoverPages`), or (c) leave the tool at the analysis-only milestone (which is fully working). My recommendation: crawler next (small, high value, no OS dependency), then the video pipeline.

## Future enhancements (deferred, not bugs)

- Rebrand the SARIF driver name and JUnit testsuite prefix from `"a11y-video-audit"` to `"auria"` (kept verbatim during the port to avoid behavior change; do as a deliberate, tested change).
