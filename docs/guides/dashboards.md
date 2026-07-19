# Dashboards

Browse findings across every audited page in one place. Auria writes an `index.html`
dashboard automatically at the end of each run — you don't enable anything.

## Step 1 — Run any audit

```bash
node bin/auria.mjs --config pages.json --no-video
```

## Step 2 — Open the dashboards

Two levels are generated under your output base:

```
a11y-audits/
  index.html            ← GLOBAL: every host, every page
  example.gov/
    index.html          ← PER-HOST: every page on example.gov
    checkout/ ...
    receipt/  ...
```

Open either in a browser:

```bash
# Windows
start a11y-audits/index.html
# macOS
open a11y-audits/index.html
# Linux
xdg-open a11y-audits/index.html
```

## Step 3 — What the dashboard shows

For each page it rolls up the key numbers (violation counts by impact, layout/reflow
verdicts, keyboard-walk result) and links straight to that page's PDF, video, and raw
`-axe.json`. It's the fastest way to see, across a site, which pages are worst.

## How it works

`dashboard.mjs` **scans the whole output-base tree** after the audits finish and
regenerates both index files from what it finds. Because it reads the tree (not just
the current run), pages from previous runs into the same `--out` folder stay listed —
the dashboard reflects the full folder, not only today's pages.

- It **never opens a browser** and only writes the `index.html` files (see the
  boundaries table in [architecture.md](../architecture.md)).
- Point runs at the same `--out` to accumulate one growing dashboard; use different
  `--out` folders to keep separate reports.

## Related

- [Reports & artifacts](reports-and-artifacts.md) — the per-page files the dashboard links to.
- [Crawl a whole site](crawling-a-site.md) — populate a per-host dashboard in one command.
