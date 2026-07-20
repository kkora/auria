# Getting started

Install Auria and run your first accessibility audit.

## Prerequisites

- **Node.js ≥ 22** — check with `node --version`.
- **Edge or Chrome installed.** Auria drives your installed browser via
  `playwright-core` (it tries `msedge`, then `chrome`); it does **not** download one.
- **Windows** if you want the default narrated video or `--nvda`. The audit and
  reports themselves run on any OS.

## Step 1 — Install

```bash
git clone <repo-url> auria
cd auria
npm install
```

`ffmpeg` (via `ffmpeg-static`), `axe-core`, and `playwright-core` come from
`package.json`. Nothing else to install for the CLI.

## Step 2 — Run your first audit

Point Auria at any URL:

```bash
node bin/auria.mjs https://example.com/payment-page
```

This runs the full pipeline: analyze → narrate → record video → write reports →
update the dashboard.

## Step 3 — Run the fast loop (no video)

Recording the narrated video is the slow part. While iterating, skip it:

```bash
node bin/auria.mjs https://example.com/payment-page --no-video
```

You still get the PDF report, `-axe.json`, and the dashboard — just no `.mp4`. This
is the recommended inner loop while fixing issues.

## Step 4 — Find the output

Results land under `a11y-audits/<host>/<page>/` by default:

```
a11y-audits/
  example.com/
    payment-page/
      payment-page.mp4          ← narrated walkthrough (unless --no-video)
      payment-page-report.pdf   ← full human-readable report
      payment-page-axe.json     ← raw analysis data (feeds baseline diffs)
    index.html                  ← per-host dashboard
  index.html                    ← global dashboard across all hosts
```

Change the base folder with `--out <dir>` and the page folder name with
`--name <label>`.

## What each artifact is for

See [Reports & artifacts](reports-and-artifacts.md) for the full list. The two you'll
open most: the **`-report.pdf`** (everything, human-readable) and, to share with
non-technical stakeholders, the **`.mp4`**.

## Next steps

- [Audit a single page](auditing-a-single-page.md) — viewports, emulation, options.
- [Audit many pages](auditing-multiple-pages.md) — drive a list from a config file.
- [Crawl a whole site](crawling-a-site.md) — discover pages automatically.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Neither Edge nor Chrome is available` | Install Microsoft Edge or Google Chrome. |
| No `.mp4` produced | Narrated video needs Windows TTS; on other OSes use `--no-video` or the cross-platform TTS path. |
| `scan-failed` in the report | The page's CSP blocked the axe scan — see [interpreting-results.md](../interpreting-results.md). |
