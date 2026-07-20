# Changelog

All notable changes to Auria are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow SemVer.

## [Unreleased]

_Nothing yet._

## [0.2.0] - 2026-07-20

Compliance release. Auria now produces procurement-ready conformance reporting and
tracks it over time, and the analyzer set is broader.

### Added
- **VPAT® 2 / ACR generator** (`src/report/vpat.mjs`, `--vpat`): a draft Accessibility
  Conformance Report as **Markdown + PDF + JSON** covering WCAG 2.2 Level A/AA (55
  criteria), Revised Section 508 (Ch. 3–6), and EN 301 549. axe violations map to their
  success criterion (Partially Supports); Auria's own checks and axe-passed criteria drive
  Supports; everything else is Not Evaluated for a human reviewer. Product metadata via
  config. Whole-site (product-level) aggregation for `--crawl`.
- **Compliance trend & history** (`src/report/trend.mjs`): every `--vpat` run diffs
  conformance against the previous run (`<name>-vpat-trend.md` — regressions vs fixes) and
  appends a rolling `<name>-vpat-history.json`. Same for the site-wide report.
- **`--fail-on-regression`**: CI gate (exit 2) when conformance drops versus the previous
  run; implies `--vpat`.
- **Dashboard conformance**: a Conformance column (criteria failing + Not Evaluated), a
  `vpat` link, and — once a page has history — an inline SVG trend sparkline with a
  ▲ more / ▼ fewer failing delta chip.
- **ARIA landmark analyzer** (`src/analyze/landmarks.mjs`): landmark region map with
  native→ARIA role resolution and HTML-AAM scoping; structure checks (missing/duplicate
  `main`, unlabeled same-role landmarks) feeding the report and the VPAT (2.4.1, 1.3.1).
- **Color-contrast summary** (`contrastSummary` in `src/analyze/axe.mjs`): measured ratios
  from axe's color-contrast rule — worst offenders and a normal (4.5:1) vs large/bold (3:1)
  split — as a report section.

### Changed
- `runAxe` returns `{ byViewport, passedSc, contrast }`; with `{ passes: true }` it collects
  axe's passed WCAG criteria for the VPAT.
- The axe-rule → WCAG SC mapping (`scFromTag`) is extracted, explicit about out-of-scope
  criteria (AAA, obsolete 4.1.1), and guarded by a test against axe-core's own metadata.

## [0.1.0] - 2026-07-20

First release. The full P1 CLI is ported from the original monolith — every `src/`
module is implemented — and it runs headless in a Linux container (P2), narrated video
and all.

### Added
- **Config & CLI** (`src/config.mjs`, `bin/auria.mjs`): `parseCli` / `parseConfigFile`
  → normalized job list (per-page → config → default precedence), `normalizeAuth`
  (auth values never emitted to reports), usage-error handling, exit codes
  (0 ok / 1 all-failed / 2 fail-on breach).
- **Analyzers** (`src/analyze/*`): axe-core scan (`scan-failed`-safe), per-viewport
  layout/reflow + `readViewportMeta`, strict WCAG (reflow-320 / zoom-200), keyboard
  walk + trap detection (NVDA-driver seam), heading outline.
- **Narration** (`src/narrate/plan.mjs`): pure `buildNarration` driving both the
  report script and the video.
- **Reports** (`src/report/*`): canonical Markdown, A4 PDF (`markdownToHtml` +
  Playwright print), SARIF 2.1.0, JUnit XML, annotated per-viewport screenshots.
- **Dashboard** (`src/dashboard.mjs`): global + per-host `index.html`.
- **Crawler** (`src/crawl.mjs`): BFS `discoverPages` + `expandCrawl` (`--crawl`),
  `crawl-map.json`.
- **Engine** (`src/index.mjs`, `src/browser.mjs`): `runAudit` / `runJobs` wiring
  analysis → optional baseline diff → reports → video → dashboards; `fail-on` gating;
  video failures fall back to reports-only.
- **Narrated video** (`src/record.mjs`, `src/narrate/tts-*.mjs`): timeline WAV
  assembly, caption overlay, adaptive scroll, ffmpeg mux. Three TTS engines behind the
  `getTts()` seam — Windows System.Speech, cross-platform espeak-ng, and **neural
  Piper** (auto-selected via `PIPER_VOICE`; auto-detects the classic vs. piper1-gpl CLI
  flags).
- **Real NVDA mode** (`src/nvda.mjs`, `--nvda`): captures real spoken phrases into the
  keyboard walk and re-voices them in the video; clear guidance when NVDA is absent.
- **Container (P2)** — a `Dockerfile` (Node 22 + Chromium + espeak-ng + ffmpeg-static)
  that runs the whole pipeline, including the narrated video, headless on Linux; a
  `container` CI job proves it every push and uploads the output as an artifact.
- **Deployment** — a GHCR `publish.yml` workflow (versioned + `latest` image on tags;
  third-party actions pinned to commit SHAs) and `docs/guides/deployment.md`
  (VM / Cloud Run / ECS / k8s recipes).
- **CI** — Linux (unit + integration) + Windows (unit) + container jobs on Node 22;
  ESLint flat config + lint gate.
- Tests: 72 unit + 22 integration (browser suites self-skip without a browser).

### Changed
- Rebranded the SARIF driver name and JUnit testsuite prefix to `auria`.
- Calmer default cross-platform (espeak) narration pace (~150 WPM).

### Fixed
- Redact setup-step `fill`/`select` values in reports (credential/PII channel).
- Per-page `out` override; query-string-safe output folders (no silent clobbering).
- Keyboard-trap false positives on pages with no focusable elements.
- NVDA preflight before browser launch (clear guidance even headless); `recordVideo`
  cleans up intermediates on failure; guard a missing-ffmpeg error.

### Notes
- Verified end-to-end: analysis + all report formats, `--crawl`, System.Speech + neural
  Piper video (Windows), and the full narrated-video audit inside a Linux container.
  The NVDA-installed capture path is ported but requires NVDA to exercise.
