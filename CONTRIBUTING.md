# Contributing to Auria

Thanks for helping. Please read [CLAUDE.md](CLAUDE.md) first — it has setup, the
repository map, and the working rules. This file is the short version.

## Setup

```bash
npm install
npm test
```

## Ground rules

- **ESM only**, Node ≥ 20. Match the terse, comment-the-*why* style of the source.
- **Respect module boundaries** (see [docs/architecture.md](docs/architecture.md)):
  `analyze/*` don't write files; `report/*` and `dashboard.mjs` don't open a browser;
  `bin/` only parses args.
- **Never emit auth values** (cookies/headers) into any report — counts only.
- **Keep the core cross-platform.** OS-specific code belongs only in
  `src/narrate/tts-windows.mjs` and `src/nvda.mjs`.
- **Tests with changes.** New analyzer logic → a fixture + integration test; pure
  helpers → a unit test. No live network in tests.

## Pull requests

1. Branch from `main`.
2. Keep PRs focused; update docs and `CHANGELOG.md` under `[Unreleased]`.
3. `npm test` must pass.
