# Changelog

All notable changes to Auria are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow SemVer.

## [Unreleased]

### Added
- Initial repository scaffold extracted from `cpp-payment-ui/tools/a11y-video-audit.mjs`.
- Module structure under `src/` (analyze / narrate / report / crawl / dashboard).
- Pluggable TTS seam (`src/narrate/tts.mjs`) to enable headless cross-platform narration.
- Docs: PLAN, architecture, CLI, crawl, NVDA, WCAG coverage, interpreting results.
- Test scaffold (unit + integration) with a broken-page fixture.

### Notes
- Most `src/` modules are stubs pending the port from the original monolith.
- See `docs/PLAN.md` for open decisions (name gate, module split, TTS engine).
