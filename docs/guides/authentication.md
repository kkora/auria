# Authenticate (audit pages behind a login)

Supply cookies or headers so Auria can reach logged-in pages. The same auth is used
for the crawl and every audit.

> **Security invariant.** Auth values (cookies, headers) are used only to drive the
> browser. They are **never written into any report or artifact** — reports record
> only *counts* (e.g. "2 cookies, 1 header"). This is a hard rule carried over from
> the original tool; keep it when contributing.

## Option A — CLI flags (quick, single page)

Both flags are **repeatable**:

```bash
node bin/auria.mjs https://example.com/account \
  --cookie "session=abc123" \
  --cookie "csrf=xyz789" \
  --header "Authorization: Bearer <token>"
```

- Repeated `--cookie` values are joined into one cookie string.
- `--header "Key: Value"` splits on the first `:`; whitespace is trimmed.

## Option B — Config file (many pages, reusable)

Add an `auth` block. Put it top-level to apply to all pages, or per-page to override.

### Cookies as a string

```jsonc
{
  "auth": { "cookies": "session=abc123; csrf=xyz789",
            "headers": { "Authorization": "Bearer <token>" } },
  "pages": [{ "url": "https://example.com/account" }]
}
```

### Cookies as objects (control domain / path)

```jsonc
{
  "auth": {
    "cookies": [
      { "name": "session", "value": "abc123", "domain": ".example.com", "path": "/" }
    ]
  },
  "pages": [{ "url": "https://example.com/account" }]
}
```

When a cookie object omits `domain`/`url`, Auria scopes it to the page URL
automatically.

## Step-by-step: audit a logged-in flow

1. Log in manually in your browser and copy the session cookie(s) from DevTools →
   Application → Cookies (or capture the `Authorization` header from a request).
2. Put them in an `auth` block (Option B) so they're reusable across pages.
3. Add any `steps` needed to reach the audited state (see
   [Audit many pages](auditing-multiple-pages.md)).
4. Run `node bin/auria.mjs --config pages.json`.
5. Confirm the report header shows the expected auth **counts** (never values).

## Crawling behind auth

`--crawl` uses the seed job's `auth`, so private sections are discovered too — just
supply the auth on the seed. See [Crawl a whole site](crawling-a-site.md).

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Redirected to a login page in the audit | Cookie expired or wrong domain — recapture; use an object cookie with explicit `domain`. |
| Header ignored | Check the `Key: Value` format — split is on the first colon only. |
