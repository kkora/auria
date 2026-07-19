# Interpreting results

## Artifacts per page

| File | Read it for |
| --- | --- |
| `<page>.mp4` | A narrated walkthrough to share with non-technical stakeholders. |
| `<page>-report.pdf` | The full human-readable report (axe, layout, strict, keyboard). |
| `<page>-report.md` | Same report as markdown (opt-in with `--md`). |
| `<page>-axe.json` | Raw analysis data — machine-readable, feeds baseline diffs. |
| `<page>.sarif` / `<page>-junit.xml` | CI code-scanning / test dashboards (opt-in). |
| `index.html` (out-base + per host) | Dashboard across all audited pages. |

## Severity

axe impact ranks: `minor < moderate < serious < critical`. `--fail-on <level>`
exits code 2 when any violation at or above that level exists — use it as a CI gate.

## Baseline diffs

`--baseline auto` compares this run to the page's previous `-axe.json` and reports
**new / fixed / unchanged** violations, turning a snapshot into regression tracking.

## Limitations (also printed in every report)

- **Simulated narration is not proof of screen-reader behavior** — it reads the
  page's ARIA + axe output. Use `--nvda` for real NVDA output on the keyboard walk,
  and replay the step list with NVDA + VoiceOver for compliance.
- axe **cannot see cross-origin iframes** (hosted card fields, embeds). A strict CSP
  can block the scan entirely (reported as `scan-failed`).
- Accessible names in the keyboard walk are **approximated** from the DOM; the
  browser's real accessibility tree is authoritative.
- Sub-12px text is an advisory readability signal, not a WCAG pass/fail.
