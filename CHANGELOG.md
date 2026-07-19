# Changelog

All notable changes to Auria are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow SemVer.

## [Unreleased]

The full P1 CLI is now ported from the original monolith. Every `src/` module is
implemented; the analysis-only pipeline and the narrated video both run end-to-end.

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
- Tests: 65 unit + 15 integration (browser suites self-skip without Edge/Chrome).

### Changed
- Rebranded the SARIF driver name and JUnit testsuite prefix to `auria`.

### Notes
- Verified end-to-end on Windows: analysis + all report formats, `--crawl`, System.Speech
  video, and neural Piper video. Not yet exercised here: espeak-ng video (Linux) and the
  NVDA-installed capture path.
