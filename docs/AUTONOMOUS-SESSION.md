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

_(newest last; each entry: slice — commits — tests — notes)_

## Decisions I made autonomously

_(things I chose without asking; override any you disagree with)_

## Needs your review / approval

_(nothing blocking yet)_

## Future enhancements (deferred, not bugs)

- Rebrand the SARIF driver name and JUnit testsuite prefix from `"a11y-video-audit"` to `"auria"` (kept verbatim during the port to avoid behavior change; do as a deliberate, tested change).
