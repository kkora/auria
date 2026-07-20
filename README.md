# Auria

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

Plus optional SARIF/JUnit for CI, annotated screenshots, baseline diffs, a site
crawler, and per-host + global dashboards.

> **Status: P1 CLI complete.** The full engine is ported from the original monolith —
> analysis, all report formats, dashboards, annotated screenshots, whole-site crawl,
> the narrated video (Windows System.Speech, cross-platform espeak-ng, or neural Piper),
> and real NVDA mode. See [docs/PLAN.md](docs/PLAN.md) and [CLAUDE.md](CLAUDE.md).

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

## Docs

| Doc | What |
| --- | --- |
| [docs/guides/](docs/guides/README.md) | **Step-by-step how-to guides for each feature** (start here) |
| [docs/PLAN.md](docs/PLAN.md) | Product & extraction plan, monetization, SaaS architecture |
| [docs/cli.md](docs/cli.md) | Full flag + config reference |
| [docs/crawl.md](docs/crawl.md) | Site crawler + include/exclude filters |
| [docs/nvda.md](docs/nvda.md) | Real NVDA screen-reader mode |
| [docs/wcag-coverage.md](docs/wcag-coverage.md) | Each check mapped to its WCAG SC |
| [docs/interpreting-results.md](docs/interpreting-results.md) | Reading results + limitations |
| [docs/architecture.md](docs/architecture.md) | Module map + data flow |

## License

MIT — see [LICENSE](LICENSE).
