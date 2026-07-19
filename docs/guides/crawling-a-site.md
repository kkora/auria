# Crawl a whole site

Discover and audit every same-origin page reachable from a start URL, via
breadth-first search. Semantics reference: [crawl.md](../crawl.md).

## Step 1 — Crawl from a seed URL

```bash
node bin/auria.mjs https://example.gov/ --crawl
```

Auria walks links breadth-first from the seed, bounded by defaults **20 pages** and
**depth 3**, then audits each discovered page with the seed's options.

## Step 2 — Set the bounds

```bash
node bin/auria.mjs https://example.gov/ --crawl --max-pages 50 --max-depth 4
```

- `--max-pages` — hard ceiling on pages audited (default 20).
- `--max-depth` — link hops from the seed (default 3).

## Step 3 — Know what gets followed

- **Same-origin only** — protocol + host must match the seed.
- URLs are normalized for dedupe: hash stripped, trailing slash trimmed (root keeps
  `/`), query strings **kept** (different query = different page).
- **Skipped**: `mailto:` / `tel:` / `javascript:` and asset extensions
  (`.pdf .zip .png .jpg .jpeg .svg .webm .mp4 .docx .doc .xlsx`).
- Dead links never kill the crawl — they're recorded in `crawl-map.json` `failed[]`.

## Step 4 — Filter with include / exclude (config only)

Filters are regexes tested against the **full normalized URL**. A link is followed
only if it matches `include` (when set) **and** not `exclude`.

```jsonc
// crawl.json
{
  "pages": [{ "url": "https://example.gov/" }],
  "crawl": {
    "maxPages": 40,
    "include": "/forms/",
    "exclude": "/(blog|login|account)(/|$)"
  }
}
```

```bash
node bin/auria.mjs --config crawl.json
```

**Matching rules that bite people:**

| Rule | Consequence |
| --- | --- |
| Tested against the full URL (`https://host/path`) | `"^/about"` never matches — use `"/about"`. |
| Unanchored (substring) | Anchor deliberately with `$` or a path boundary. |
| Case-sensitive (no `i` flag) | Use a class: `"[Bb]log"`. |
| JSON string → double every backslash | Literal dot `"\."`, digit `"\d"`. |

The **seed URL is always audited**, even if filters would exclude it.

## Step 5 — Inspect and pin the crawl map

Each crawl writes `<out>/<host>/crawl-map.json`:

```jsonc
{ "start": "...", "date": "2026-07-19", "pages": [ ... ], "failed": [ ... ] }
```

Recommended workflow: run once with loose filters, open `crawl-map.json`, then either
tighten `include`/`exclude` and rerun, or copy its `pages[]` into a config to pin a
reproducible set (see [Audit many pages](auditing-multiple-pages.md)).

> An over-broad `exclude` can prune whole branches only reachable through an excluded
> hub page. Check the map if pages you expected are missing.

## Related

- [Authenticate](authentication.md) — the crawl uses the seed's auth, so private
  areas are reachable when you supply cookies/headers.
