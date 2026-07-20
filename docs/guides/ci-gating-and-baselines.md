# CI gating & baselines

Fail a build when accessibility regresses, and diff each run against the last.

## Step 1 — Gate the build on severity (`--fail-on`)

```bash
node bin/auria.mjs https://example.com/checkout --no-video --fail-on serious
```

The process **exits code 2** when any violation at or above the given level exists.
Levels, low → high: `minor`, `moderate`, `serious`, `critical`. Use `--no-video` in
CI to keep runs fast.

```bash
# In a CI step, a non-zero exit fails the job automatically.
node bin/auria.mjs --config pages.json --fail-on critical
```

Config equivalent: `"failOn": "serious"` (top-level or per-page).

## Step 2 — Emit machine-readable results

```bash
node bin/auria.mjs https://example.com/checkout --no-video --sarif --junit
```

- `--sarif` → `<page>.sarif` for GitHub/Azure **code-scanning / Security** tabs.
- `--junit` → `<page>-junit.xml` for **test-report** dashboards.

## Step 3 — Track regressions with a baseline

`--baseline auto` compares this run to the page's previous `-axe.json` and reports
each violation as **new / fixed / unchanged** — turning a snapshot into regression
tracking.

```bash
node bin/auria.mjs https://example.com/checkout --no-video --baseline auto
```

Or pin a specific file:

```bash
node bin/auria.mjs https://example.com/checkout --baseline ./golden/checkout-axe.json
```

Config equivalent: `"baseline": "auto"`.

## Step 4 — A minimal CI pipeline

```yaml
# .github/workflows/a11y.yml (sketch)
- run: npm install
- run: node bin/auria.mjs --config pages.json --no-video --fail-on serious --sarif --baseline auto
- uses: github/codeql-action/upload-sarif@v3
  with: { sarif_file: a11y-audits }   # picks up the emitted .sarif files
```

The `--fail-on` exit code fails the job; the SARIF upload surfaces findings inline on
the PR; `--baseline auto` shows what changed vs the previous run.

## Notes

- Keep `--no-video` in CI — narration/recording needs a TTS engine and is slow.
- Don't commit audit output (`a11y-audits/`) — it's git-ignored. Store baselines
  deliberately (e.g. a `golden/` folder) if you want pinned diffs.

## Related

- [Reports & artifacts](reports-and-artifacts.md) · [interpreting-results.md](../interpreting-results.md)
