# Site crawler

`--crawl` (or a `crawl` config object) discovers and audits every same-origin page
reachable from the start URL via breadth-first search, bounded by `--max-pages`
(default 20) and `--max-depth` (default 3).

## What gets crawled

- Same-origin links only (protocol + host must match the seed).
- URLs normalized for dedupe: hash stripped, trailing slash trimmed (root keeps `/`),
  query strings **kept** (different queries = different targets).
- Skipped extensions: `.pdf .zip .png .jpg .jpeg .svg .webm .mp4 .docx .doc .xlsx`.
- `mailto:` / `tel:` / `javascript:` and non-HTTP(S) schemes skipped.
- Dead links recorded in `<host>/crawl-map.json` `failed[]`; one never kills the crawl.

## Filters — `crawl.include` / `crawl.exclude` (regex)

A link is followed only if it matches `include` (when set) **and** not `exclude`.
Matching semantics (important):

- Tested against the **full normalized URL** (scheme + host + path), e.g.
  `https://example.gov/about?ref=nav` — so `"^/about"` never matches; use `"/about"`.
- **Unanchored** (substring); anchor deliberately with `$` or a path boundary.
- **Case-sensitive** (no `i` flag); use a class like `"[Bb]log"`.
- JSON string → **double every backslash**: literal dot `"\\."`, digit `"\\d"`.
- Filters apply only to discovered links; the seed URL is always audited.

```jsonc
{ "crawl": { "include": "/forms/" } }
{ "crawl": { "exclude": "/(blog|login|account)(/|$)" } }
{ "crawl": { "exclude": "[?&]page=\\d+" } }
```

> Tip: run once with loose filters, inspect `crawl-map.json`, then tighten and rerun.
> An over-broad `exclude` can prune whole branches only reachable through an excluded hub.

`crawl-map.json`'s `pages[]` can be copied into a config to pin a reproducible set.
