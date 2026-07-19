# Reports & artifacts

Every file a run emits, what it's for, and how to turn each format on. Reference:
[interpreting-results.md](../interpreting-results.md).

## What you get per page

| File | Read it for | Default |
| --- | --- | --- |
| `<page>-report.pdf` | The full human-readable report (axe, per-viewport layout, strict WCAG passes, heading outline, keyboard-order table). | on |
| `<page>-axe.json` | Raw analysis data — machine-readable; feeds baseline diffs. | on |
| `<page>.mp4` / `.webm` | Narrated walkthrough for non-technical stakeholders. | on (`--no-video` off) |
| `<page>-report.md` | Same report as markdown (diff-friendly, PR-review). | off (`--md`) |
| `<page>.sarif` | Code-scanning results (GitHub/Azure security tab). | off (`--sarif`) |
| `<page>-junit.xml` | Test-report dashboards in CI. | off (`--junit`) |
| annotated PNGs | One screenshot per viewport with issues marked. | off (`--screenshots`) |
| `index.html` | Dashboards (per-host + global). | on |

## Step 1 — Turn on the formats you need

```bash
node bin/auria.mjs https://example.gov/checkout \
  --md --sarif --junit --screenshots
```

To turn the PDF off: `--no-pdf`. Config equivalents: `md`, `pdf`, `sarif`, `junit`,
`screenshots`, `video`.

## Step 2 — Where files land

```
<out>/<host>/<page>/
  <page>-report.pdf
  <page>-axe.json
  <page>.mp4
  ...
```

`<out>` defaults to `a11y-audits` (`--out`), `<page>` to a slug of the URL path
(`--name`).

## Which format for which audience

| Audience | Use |
| --- | --- |
| Non-technical stakeholder / legal | `.mp4` |
| Engineer fixing issues | `-report.pdf` or `--md` |
| PR review / version control | `--md` (text diffs cleanly) |
| Security tab / code scanning | `--sarif` |
| CI test dashboard | `--junit` |
| Automation / baseline diffs | `-axe.json` |

## Severity & limitations

axe impact ranks `minor < moderate < serious < critical`. Every report also prints
its own limitations (simulated narration isn't proof of SR behavior; axe can't see
cross-origin iframes; sub-12px text is advisory). Full detail:
[interpreting-results.md](../interpreting-results.md) and
[wcag-coverage.md](../wcag-coverage.md).

## Related

- [CI gating & baselines](ci-gating-and-baselines.md) — act on the results in CI.
- [Dashboards](dashboards.md) — roll the artifacts up across pages.
