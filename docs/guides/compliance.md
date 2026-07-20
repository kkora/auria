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
```

Works with everything else — `--crawl --vpat` produces one per page; in a container,
`docker run … --vpat`.

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
