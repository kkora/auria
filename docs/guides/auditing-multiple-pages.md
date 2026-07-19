# Audit many pages (config file)

Run a fixed list of pages in one command, with shared defaults, per-page overrides,
and setup steps. Config reference: [cli.md](../cli.md#config-file).

## Step 1 — Write a config file

Top-level keys are defaults; each entry in `pages[]` can override any of them.

```jsonc
// pages.json
{
  "out": "a11y-audits",
  "format": "mp4",
  "pdf": true,
  "tabs": 10,
  "pages": [
    { "url": "https://example.gov/pay",     "name": "payment-page", "tabs": 14 },
    { "url": "https://example.gov/receipt", "name": "receipt-page" },
    { "url": "https://example.gov/" }
  ]
}
```

A working starter lives at [examples/pages.sample.json](../../examples/pages.sample.json).

## Step 2 — Run it

```bash
node bin/auria.mjs --config pages.json
```

Each page is audited in turn; the dashboards are regenerated once at the end.

## Step 3 — Understand precedence

Every property resolves in this order — **memorize this, it never changes**:

```
per-page value  →  top-level config value  →  built-in default
```

In the example above the payment page uses `tabs: 14` (per-page), the receipt page
uses `tabs: 10` (config), and if neither set it, the default `25` would apply.

## Step 4 — Put a page into the right state before auditing (`steps`)

Some issues only appear after interaction (validation errors, an expanded panel). Use
`steps` to drive the page first. One action key per entry, plus optional `wait` (ms):

```jsonc
{
  "pages": [{
    "url": "https://example.gov/pay",
    "steps": [
      { "click": "#pay-by-card" },
      { "fill": "#amount", "value": "0" },
      { "press": "Enter", "wait": 500 },
      { "focus": "#card-number" }
    ]
  }]
}
```

Supported action keys: `click`, `fill` (+ `value`), `select` (+ `value`), `focus`,
`press`. A failing step is logged and skipped — it never aborts the audit.

## Step 5 — Per-page overrides you'll reach for

```jsonc
{
  "colorScheme": "light",          // default for all pages
  "pages": [
    { "url": ".../a", "colorScheme": "dark", "screenshots": true },
    { "url": ".../b", "video": false }         // analysis-only for this page
  ]
}
```

Any flag has a config equivalent (`format`, `pdf`, `video`, `viewports`,
`reducedMotion`, `voice`, `rate`, `auth`, `baseline`, `failOn`, `sarif`, `junit`,
`nvda`). See [cli.md](../cli.md#config-file).

## Related

- [Crawl a whole site](crawling-a-site.md) — discover pages instead of listing them.
- [Authenticate](authentication.md) — add an `auth` block for logged-in pages.
