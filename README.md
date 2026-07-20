# Auria

[![CI](https://github.com/kkora/auria/actions/workflows/ci.yml/badge.svg)](https://github.com/kkora/auria/actions/workflows/ci.yml)
[![latest tag](https://img.shields.io/github/v/tag/kkora/auria?sort=semver&label=release)](https://github.com/kkora/auria/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen)](package.json)

**See and hear your accessibility gaps.**

Point Auria at a URL — or a whole site — and for each page it produces automated
accessibility + responsive-layout findings and, uniquely, a **narrated video** you
can hand to anyone: engineers, accessibility coordinators, or legal.

For each page:

- **`<page>.mp4`** — a narrated video (synthesized voice + captions) that announces
  the axe-core results, layout verdicts per device, heading structure, and walks the
  keyboard order screen-reader-style across desktop / tablet / phone.
- **`<page>-report.pdf`** — a print-styled A4 report: a numbered step-by-step script,
  full axe findings, per-viewport layout checks, strict WCAG passes, heading outline,
  and keyboard-order table.
- **`<page>-report.md`** *(opt-in)* — the same report as markdown.
- **`<page>-axe.json`** — the raw analysis data.
- **`<page>-vpat.{md,pdf,json}`** *(`--vpat`)* — a draft VPAT® 2 / ACR conformance report.

Plus optional SARIF/JUnit for CI, annotated screenshots, baseline diffs, a site
crawler, and per-host + global dashboards.

> **Status: P1–P3 complete (`v0.2.0`).** The full engine is ported from the original
> monolith and runs headless in a Linux container; the compliance layer (VPAT/ACR,
> conformance trend, regression gate) ships on top. Narrated video via Windows
> System.Speech, cross-platform espeak-ng, or neural Piper; real NVDA mode on Windows.
> See [docs/PLAN.md](docs/PLAN.md) and [CLAUDE.md](CLAUDE.md).

## Compliance (VPAT® / ACR)

The first thing procurement asks for. `--vpat` turns an audit into a draft
**Accessibility Conformance Report** in the ITI VPAT® 2 format — WCAG 2.2 A/AA,
Revised Section 508, and EN 301 549 — as Markdown, PDF, and machine-readable JSON:

```bash
node bin/auria.mjs https://example.com/page --vpat            # per-page report
node bin/auria.mjs https://example.com/ --crawl --vpat        # + one product-level report
node bin/auria.mjs https://example.com/page --fail-on-regression  # CI gate on conformance drops
```

Automated testing finds *failures*, not *conformance*, so criteria Auria can't evaluate
are marked **Not Evaluated** for a human reviewer. Each run also tracks a conformance
**trend** (regressions vs fixes) and history. See
[docs/guides/compliance.md](docs/guides/compliance.md).

## Quickstart

```bash
npm install
node bin/auria.mjs https://example.com/payment-page
```

Analysis-only fast loop (no video), a whole site, or many pages from a config:

```bash
node bin/auria.mjs https://example.com/payment-page --no-video
node bin/auria.mjs https://example.com/ --crawl --max-pages 20
node bin/auria.mjs --config examples/pages.sample.json
```

## Requirements

- Node.js ≥ 22 (the `node:test` runner's glob patterns need ≥ 21)
- Edge or Chrome installed (Auria drives your installed browser — no download)
- Windows for the default narration voice and for real-NVDA mode; the audit and
  reports themselves are cross-platform. See [CLAUDE.md](CLAUDE.md#platform-note).

## Docker

The audit engine (including the narrated video via espeak-ng) runs headless in a Linux
container — no local browser or Node needed:

```bash
docker run --rm -v "$PWD/audits:/audits" ghcr.io/kkora/auria:0.2.0 \
  https://example.com/page --vpat --out /audits
```

See [docs/guides/docker.md](docs/guides/docker.md) and
[docs/guides/deployment.md](docs/guides/deployment.md).

## Docs

| Doc | What |
| --- | --- |
| [docs/guides/](docs/guides/README.md) | **Step-by-step how-to guides for each feature** (start here) |
| [docs/guides/compliance.md](docs/guides/compliance.md) | VPAT® / ACR generation, conformance trend, CI regression gate |
| [docs/PLAN.md](docs/PLAN.md) | Product & extraction plan, monetization, SaaS architecture |
| [docs/cli.md](docs/cli.md) | Full flag + config reference |
| [docs/crawl.md](docs/crawl.md) | Site crawler + include/exclude filters |
| [docs/nvda.md](docs/nvda.md) | Real NVDA screen-reader mode |
| [docs/wcag-coverage.md](docs/wcag-coverage.md) | Each check mapped to its WCAG SC |
| [docs/interpreting-results.md](docs/interpreting-results.md) | Reading results + limitations |
| [docs/architecture.md](docs/architecture.md) | Module map + data flow |

## License

MIT — see [LICENSE](LICENSE).
