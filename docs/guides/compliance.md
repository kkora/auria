# Compliance reports (VPAT® / ACR)

Auria can turn an audit into a **draft Accessibility Conformance Report (ACR)** in the
ITI **VPAT® 2** format — the artifact procurement and Section 508 / EN 301 549 reviewers
ask for. Pair it with the narrated video and you have both the paperwork and the
human-legible evidence in one run.

> **It is a draft, on purpose.** Automated testing finds *failures*; it cannot *prove*
> conformance. Auria fills in the criteria it can evaluate and marks the rest **Not
> Evaluated** for a qualified reviewer to complete. Do not submit it as a finished VPAT
> without that manual review.

## Generate one

```bash
node bin/auria.mjs https://example.com/page --vpat --out audits
# writes audits/example.com/page/page-vpat.md  (+ page-vpat.pdf unless --no-pdf)
#      and page-vpat.json (machine-readable — for dashboards, trend tracking, tooling)
```

The **`.json`** form carries the same result as structured data:
`{ format, standard, product, summary: { supports, partiallySupports, … }, criteria: [{ sc, name, level, conformance, remarks }] }` — feed it to a dashboard or diff it over time.

The **dashboard** reads it automatically: when a page has a `-vpat.json`, the generated
`index.html` gains a **Conformance** column (criteria failing + a note of how many remain
Not Evaluated) and a `vpat` link to the report — so a whole-site scan shows compliance at a glance.

In a container: `docker run … --vpat`.

### Whole-site (product-level) report

A VPAT describes a *product*, not a single page — so with `--crawl --vpat` (or a
multi-page config), Auria also writes **one aggregated report** per host at
`<out>/<host>/<host>-vpat.md` (+ PDF), in addition to the per-page ones. A criterion is
marked failing at the product level if it fails on **any** page, and "Supports" only when
some page verified it and none failed. This is the report you hand to procurement.

## Add product metadata

A real VPAT names the product, version, and vendor. Pass them via a config file (the
`--vpat` CLI flag alone uses the page name):

```jsonc
// vpat.json
{
  "vpat": {
    "product": "Acme Citizen Portal",
    "version": "3.2",
    "vendor": "Acme Inc.",
    "contact": "accessibility@acme.example",
    "description": "Public benefits application portal",
    "standard": "WCAG 2.2 Level AA"
  },
  "pages": [{ "url": "https://portal.example.com/" }]
}
```

```bash
node bin/auria.mjs --config vpat.json
```

## What's in the report

- **Table 1 — WCAG 2.2 Report (Level A & AA, 55 criteria).** Auto-filled:
  - axe-core violations → mapped to their success criterion → **Partially Supports** (rule in Remarks).
  - Auria's own checks (reflow, resize, target size, keyboard trap, headings, page title, unnamed controls) → **Supports** when clean, **Partially / Does Not Support** when failing.
  - Everything else → **Not Evaluated** (manual review).
- **Table 2 — Revised Section 508 Report.** Chapter 3 (Functional Performance Criteria) and Chapter 6 (Support Documentation) are listed as **Not Evaluated** (they need AT-based manual testing); Chapter 4 (Hardware) is N/A for web; Chapter 5 (Software) is met via Table 1.
- **Table 3 — EN 301 549 Report.** Chapter 9 (Web) maps to the WCAG table; other chapters need manual review.

## How to finish it

1. Run the audit with `--vpat` (and `--crawl` for a whole site).
2. Have an accessibility specialist work the **Not Evaluated** rows and confirm the
   automated results — the manual side of [wcag-coverage.md](../wcag-coverage.md).
3. Replace the draft remarks with real conformance statements; ship the PDF (and the
   narrated video as supporting evidence).

See [wcag-coverage.md](../wcag-coverage.md) for exactly which criteria Auria evaluates
automatically versus what always needs a human.
