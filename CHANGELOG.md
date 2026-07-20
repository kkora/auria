# Changelog

All notable changes to Auria are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow SemVer.

## [Unreleased]

_Nothing yet._

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
