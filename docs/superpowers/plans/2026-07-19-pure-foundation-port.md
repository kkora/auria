# Pure Foundation Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the pure, browser-free helpers from the source monolith into `src/crawl.mjs` and `src/config.mjs`, with unit tests, so the CLI's foundation layer is implemented and tested.

**Architecture:** Faithful extraction from `docs/_source-monolith.mjs.txt` into two pure ESM modules. The monolith's inline `process.exit` CLI errors become thrown tagged errors (`usageError`) so the logic is unit-testable; a later `bin/` slice will catch them. `discoverPages` (needs Playwright) stays a stub — this slice is browser-free.

**Tech Stack:** Node.js ≥ 20, ESM (`"type": "module"`), `node:test` + `node:assert/strict`. No new dependencies.

## Global Constraints

- ESM only (`"type": "module"`); every file uses `import`/`export`.
- `src/config.mjs` and `src/crawl.mjs` stay **pure**: no `process.exit`, no browser, no file reads/writes. Config-file reading is the caller's job.
- **Security invariant:** auth values (cookies/headers) are only ever assembled into structures for the browser — never serialized into any report/artifact. `normalizeAuth` and the CLI auth assembly must preserve this; tests assert shape only.
- Config resolution order is always **per-page value → top-level config → built-in default** (`??` chains). Preserve exactly.
- Port code **verbatim** from the monolith where quoted; do not "improve" behavior.
- Tests must not use live network or a browser — `npm run test:unit` runs browser-free.
- Test runner: `node --test`. Run a single file with `node --test test/unit/<file>.test.mjs`.

---

## File Structure

- `src/crawl.mjs` — MODIFY. Add pure `normalizeUrl`, `sameOrigin` (+ private `SKIP_EXT`). Keep `discoverPages` as a throwing stub.
- `src/config.mjs` — MODIFY. Replace the stub with the real module: `usageError`, `slugify`, `slugFromUrl`, `normalizeAuth`, `parseConfigFile`, `parseCli`.
- `test/unit/url-normalize.test.mjs` — MODIFY. Remove the `PENDING` skip so the existing 4 tests run.
- `test/unit/config.test.mjs` — CREATE. Unit tests for the config helpers.

---

### Task 1: Port the crawler URL helpers

**Files:**
- Modify: `src/crawl.mjs`
- Modify: `test/unit/url-normalize.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `normalizeUrl(href: string, base: string) -> string | null` — absolute, hash-stripped, trailing-slash-trimmed URL string; `null` for non-`http(s)/file` schemes and skipped asset extensions.
  - `sameOrigin(a: string, b: string) -> boolean` — protocol + host match.

- [ ] **Step 1: Un-skip the existing failing tests**

In `test/unit/url-normalize.test.mjs`, remove the skip so the 4 tests actually run.

Replace:

```js
const PENDING = { skip: "normalizeUrl not yet ported (scaffold)" };
```

with:

```js
// normalizeUrl is now ported; run the suite.
```

Then remove the `PENDING` argument from each `test(...)` call, so each reads e.g.:

```js
test("strips the hash fragment", () => {
  assert.equal(
    normalizeUrl("https://x.gov/a#section", "https://x.gov/"),
    "https://x.gov/a"
  );
});
```

Do this for all four tests ("strips the hash fragment", "trims a trailing slash but keeps root", "keeps the query string", "returns null for non-followable links").

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/unit/url-normalize.test.mjs`
Expected: FAIL — `normalizeUrl` throws `"not implemented — scaffold"`.

- [ ] **Step 3: Implement `normalizeUrl` and `sameOrigin`**

In `src/crawl.mjs`, replace the `normalizeUrl` stub (the `export function normalizeUrl(...) { throw ... }` block) with the ported implementation. Keep the existing file header comment and the `discoverPages` stub untouched. The helper block should read:

```js
const SKIP_EXT = /\.(pdf|zip|png|jpe?g|svg|webm|mp4|docx?|xlsx?)$/i;

// Normalize for dedupe: absolute, hash stripped, trailing slash trimmed (root keeps "/").
// Returns null for links a crawler must not follow (mailto:/tel:/javascript:, assets).
export function normalizeUrl(href, base) {
  let u;
  try { u = new URL(href, base); } catch { return null; }
  if (!/^(https?|file):$/.test(u.protocol)) return null;   // mailto:, tel:, javascript:
  if (SKIP_EXT.test(u.pathname)) return null;
  u.hash = "";
  if (u.pathname !== "/" && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

export const sameOrigin = (a, b) => {
  const A = new URL(a), B = new URL(b);
  return A.protocol === B.protocol && A.host === B.host;
};
```

Leave `discoverPages` as its existing throwing stub with its `TODO(port)` comment.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/unit/url-normalize.test.mjs`
Expected: PASS — 4 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/crawl.mjs test/unit/url-normalize.test.mjs
git commit -m "feat(crawl): port normalizeUrl + sameOrigin, un-skip unit tests"
```

---

### Task 2: Config module scaffold + slug helpers

**Files:**
- Modify: `src/config.mjs`
- Create: `test/unit/config.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `usageError(message: string) -> Error` — an `Error` with `.usage === true`, for user-facing invocation errors.
  - `slugify(s: string) -> string` — filesystem-safe slug; empty input yields `"home"`.
  - `slugFromUrl(u: string) -> string` — `slugify` of the URL's pathname.

- [ ] **Step 1: Write the failing test**

Create `test/unit/config.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, slugFromUrl } from "../../src/config.mjs";

test("slugify: root/empty path becomes 'home'", () => {
  assert.equal(slugify("/"), "home");
  assert.equal(slugify(""), "home");
});

test("slugify: strips extension and lowercases", () => {
  assert.equal(slugify("/Checkout.HTML"), "checkout");
});

test("slugify: collapses non-alphanumerics to single dashes", () => {
  assert.equal(slugify("/pay/step 2"), "pay-step-2");
});

test("slugFromUrl: slugifies the pathname only", () => {
  assert.equal(slugFromUrl("https://x.gov/forms/apply?ref=nav"), "forms-apply");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/unit/config.test.mjs`
Expected: FAIL — `slugify` is not an export (current file only stubs `parseCli`).

- [ ] **Step 3: Write minimal implementation**

Replace the entire contents of `src/config.mjs` with the module scaffold plus the slug helpers (later tasks append more exports below):

```js
// Config & CLI parsing -> normalized job list.
//
// Pure module: no browser, no process.exit, no file writes. Config-file *reading*
// is the caller's job (see parseCli's returned configPath). Resolution order for
// every property is ALWAYS: per-page value -> top-level config -> built-in default.

// Tagged error for bad invocations. bin/ prints the message + usage and exits 1;
// any untagged throw is an unexpected bug.
export function usageError(message) {
  const e = new Error(message);
  e.usage = true;
  return e;
}

export const slugify = s => s.replace(/^\/+|\/+$/g, "")
  .replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "home";

export const slugFromUrl = u => slugify(new URL(u).pathname);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/unit/config.test.mjs`
Expected: PASS — 4 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/config.mjs test/unit/config.test.mjs
git commit -m "feat(config): scaffold module with usageError + slug helpers"
```

---

### Task 3: Port `normalizeAuth`

**Files:**
- Modify: `src/config.mjs`
- Modify: `test/unit/config.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `normalizeAuth(auth: object | undefined, url: string) -> { cookies: Array, headers: object }`. String cookies split on `;` then `=`; array cookies pass through, gaining `url` only when they lack `domain`/`url`; missing `auth` yields `{ cookies: [], headers: {} }`.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/config.test.mjs`:

```js
import { normalizeAuth } from "../../src/config.mjs";

test("normalizeAuth: undefined auth yields empty structures", () => {
  assert.deepEqual(normalizeAuth(undefined, "https://x.gov/"), { cookies: [], headers: {} });
});

test("normalizeAuth: string cookies split into scoped objects", () => {
  const { cookies } = normalizeAuth({ cookies: "a=1; b=2" }, "https://x.gov/");
  assert.deepEqual(cookies, [
    { name: "a", value: "1", url: "https://x.gov/" },
    { name: "b", value: "2", url: "https://x.gov/" },
  ]);
});

test("normalizeAuth: array cookies get url only when domain/url absent", () => {
  const { cookies } = normalizeAuth({
    cookies: [
      { name: "s", value: "x" },
      { name: "d", value: "y", domain: ".x.gov" },
    ],
  }, "https://x.gov/");
  assert.deepEqual(cookies, [
    { name: "s", value: "x", url: "https://x.gov/" },
    { name: "d", value: "y", domain: ".x.gov" },
  ]);
});

test("normalizeAuth: headers pass through, default empty", () => {
  assert.deepEqual(normalizeAuth({ headers: { A: "b" } }, "https://x.gov/").headers, { A: "b" });
  assert.deepEqual(normalizeAuth({ cookies: "a=1" }, "https://x.gov/").headers, {});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/unit/config.test.mjs`
Expected: FAIL — `normalizeAuth` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

Append to `src/config.mjs`:

```js
// Auth: cookies as "n=v; n2=v2" or [{name, value, domain?, path?}]; headers as {Name: value}.
// Values are used only to drive the browser and never appear in reports (counts only).
export function normalizeAuth(auth, url) {
  if (!auth) return { cookies: [], headers: {} };
  let cookies = [];
  if (typeof auth.cookies === "string") {
    cookies = auth.cookies.split(";").map(s => s.trim()).filter(Boolean).map(s => {
      const i = s.indexOf("=");
      return { name: s.slice(0, i).trim(), value: s.slice(i + 1).trim(), url };
    });
  } else if (Array.isArray(auth.cookies)) {
    cookies = auth.cookies.map(c => (c.domain || c.url) ? c : { ...c, url });
  }
  return { cookies, headers: auth.headers || {} };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/unit/config.test.mjs`
Expected: PASS — all config tests green.

- [ ] **Step 5: Commit**

```bash
git add src/config.mjs test/unit/config.test.mjs
git commit -m "feat(config): port normalizeAuth"
```

---

### Task 4: Port `parseConfigFile`

**Files:**
- Modify: `src/config.mjs`
- Modify: `test/unit/config.test.mjs`

**Interfaces:**
- Consumes: `usageError` (Task 2).
- Produces:
  - `parseConfigFile(cfg: object) -> { jobs: object[], crawl: object | null }`. Builds one job per `cfg.pages[]` entry with `per-page ?? cfg ?? undefined` precedence; throws `usageError` when `pages` is empty or a page lacks `url`. Takes already-parsed JSON — no file reading.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/config.test.mjs`:

```js
import { parseConfigFile } from "../../src/config.mjs";
import { readFile } from "node:fs/promises";

test("parseConfigFile: per-page value overrides config default", () => {
  const { jobs } = parseConfigFile({
    tabs: 10,
    pages: [{ url: "https://x.gov/a", tabs: 14 }, { url: "https://x.gov/b" }],
  });
  assert.equal(jobs[0].tabs, 14); // per-page wins
  assert.equal(jobs[1].tabs, 10); // falls back to config
});

test("parseConfigFile: passes crawl through, defaults to null", () => {
  assert.equal(parseConfigFile({ pages: [{ url: "https://x.gov/" }] }).crawl, null);
  assert.deepEqual(
    parseConfigFile({ crawl: { maxPages: 5 }, pages: [{ url: "https://x.gov/" }] }).crawl,
    { maxPages: 5 }
  );
});

test("parseConfigFile: throws usageError on empty pages", () => {
  assert.throws(() => parseConfigFile({ pages: [] }), e => e.usage === true);
});

test("parseConfigFile: throws usageError when a page lacks url", () => {
  assert.throws(() => parseConfigFile({ pages: [{ name: "x" }] }), e => e.usage === true);
});

test("parseConfigFile: the committed sample config parses", async () => {
  const cfg = JSON.parse(await readFile(new URL("../../examples/pages.sample.json", import.meta.url), "utf8"));
  const { jobs } = parseConfigFile(cfg);
  assert.equal(jobs.length, 3);
  assert.equal(jobs[0].name, "payment-page");
  assert.equal(jobs[0].tabs, 14); // per-page override
  assert.equal(jobs[1].tabs, 10); // config default
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/unit/config.test.mjs`
Expected: FAIL — `parseConfigFile` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

Append to `src/config.mjs`:

```js
// Config file -> job list. Takes already-parsed JSON; the caller reads the file.
// Every property resolves per-page ?? top-level config ?? default (undefined here,
// with real defaults applied downstream in runAudit).
export function parseConfigFile(cfg) {
  const pages = cfg.pages || [];
  if (!pages.length) throw usageError("Config file has no `pages` array.");
  const jobs = [];
  for (const p of pages) {
    if (!p.url) throw usageError("Every config page needs a `url`.");
    jobs.push({
      url: p.url,
      name: p.name,
      tabs: p.tabs ?? cfg.tabs,
      format: p.format ?? cfg.format,
      pdf: p.pdf ?? cfg.pdf,
      md: p.md ?? cfg.md,
      video: p.video ?? cfg.video,
      steps: p.steps,
      viewports: p.viewports ?? cfg.viewports,
      colorScheme: p.colorScheme ?? cfg.colorScheme,
      reducedMotion: p.reducedMotion ?? cfg.reducedMotion,
      voice: p.voice ?? cfg.voice,
      rate: p.rate ?? cfg.rate,
      auth: p.auth ?? cfg.auth,
      baseline: p.baseline ?? cfg.baseline,
      failOn: p.failOn ?? cfg.failOn,
      screenshots: p.screenshots ?? cfg.screenshots,
      sarif: p.sarif ?? cfg.sarif,
      junit: p.junit ?? cfg.junit,
      nvda: p.nvda ?? cfg.nvda,
      out: cfg.out,
    });
  }
  return { jobs, crawl: cfg.crawl || null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/unit/config.test.mjs`
Expected: PASS — all config tests green.

- [ ] **Step 5: Commit**

```bash
git add src/config.mjs test/unit/config.test.mjs
git commit -m "feat(config): port parseConfigFile with precedence + sample round-trip"
```

---

### Task 5: Port `parseCli`

**Files:**
- Modify: `src/config.mjs`
- Modify: `test/unit/config.test.mjs`

**Interfaces:**
- Consumes: `usageError` (Task 2).
- Produces:
  - `parseCli(argv: string[]) -> { jobs: object[], crawlOpts: object | null, configPath: string | null }`. When `--config <path>` is present, returns `{ jobs: [], crawlOpts: null, configPath }` (caller reads the file). Otherwise builds one job from the positional URL + flags; throws `usageError` when no URL. `VALUE_FLAGS` ensures a flag value is never mistaken for the positional URL. Repeated `--cookie`/`--header` assemble into `auth`.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/config.test.mjs`:

```js
import { parseCli } from "../../src/config.mjs";

test("parseCli: --config returns the path without reading it", () => {
  const r = parseCli(["--config", "pages.json"]);
  assert.equal(r.configPath, "pages.json");
  assert.deepEqual(r.jobs, []);
});

test("parseCli: a flag value is not mistaken for the URL", () => {
  const { jobs } = parseCli(["--out", "audits", "https://x.gov/pay"]);
  assert.equal(jobs[0].url, "https://x.gov/pay"); // not "audits"
  assert.equal(jobs[0].out, "audits");
});

test("parseCli: --no-video / --md booleans", () => {
  const { jobs } = parseCli(["https://x.gov/", "--no-video", "--md"]);
  assert.equal(jobs[0].video, false);
  assert.equal(jobs[0].md, true);
});

test("parseCli: repeated cookies join and header splits on first colon", () => {
  const { jobs } = parseCli([
    "https://x.gov/", "--cookie", "a=1", "--cookie", "b=2", "--header", "Authorization: Bearer z",
  ]);
  assert.equal(jobs[0].auth.cookies, "a=1; b=2");
  assert.deepEqual(jobs[0].auth.headers, { Authorization: "Bearer z" });
});

test("parseCli: --crawl surfaces crawl bounds", () => {
  const { crawlOpts } = parseCli(["https://x.gov/", "--crawl", "--max-pages", "5"]);
  assert.equal(crawlOpts.maxPages, "5");
});

test("parseCli: no URL throws usageError", () => {
  assert.throws(() => parseCli([]), e => e.usage === true);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/unit/config.test.mjs`
Expected: FAIL — `parseCli` still the throwing stub / not the new signature.

- [ ] **Step 3: Write minimal implementation**

In `src/config.mjs`, replace the remaining `parseCli` stub (the `export function parseCli(/* argv */) { throw ... }` block from the original scaffold, if still present) with the ported implementation. The file should end with:

```js
const VALUE_FLAGS = new Set(["out", "name", "tabs", "format", "config", "color-scheme",
  "voice", "rate", "cookie", "header", "baseline", "fail-on", "max-pages", "max-depth"]);

const USAGE =
  "Usage: node bin/auria.mjs <url> [--out base] [--name page] [--tabs n] [--format mp4|webm] [--no-pdf] [--crawl] [--nvda]\n" +
  "       node bin/auria.mjs --config pages.json";

// CLI flags + positional URL -> { jobs, crawlOpts, configPath }. Pure: no file reads,
// no process.exit. When --config is present the caller reads it and calls parseConfigFile.
export function parseCli(argv) {
  const args = argv;
  const opt = k => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : null; };
  const optAll = k => args.flatMap((a, i) => a === `--${k}` ? [args[i + 1]] : []).filter(Boolean);
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) { if (VALUE_FLAGS.has(a.slice(2))) i++; }
    else positionals.push(a);
  }

  const configPath = opt("config");
  if (configPath) return { jobs: [], crawlOpts: null, configPath };

  const url = positionals[0];
  if (!url) throw usageError(USAGE);

  const jobs = [{
    url,
    name: opt("name"),
    tabs: opt("tabs"),
    format: opt("format"),
    pdf: args.includes("--no-pdf") ? false : undefined,
    md: args.includes("--md") ? true : undefined,
    video: args.includes("--no-video") ? false : undefined,
    colorScheme: opt("color-scheme") || undefined,
    reducedMotion: args.includes("--reduced-motion") ? true : undefined,
    voice: opt("voice") || undefined,
    rate: opt("rate") || undefined,
    auth: (optAll("cookie").length || optAll("header").length) ? {
      cookies: optAll("cookie").join("; "),
      headers: Object.fromEntries(optAll("header").map(h => {
        const i = h.indexOf(":");
        return [h.slice(0, i).trim(), h.slice(i + 1).trim()];
      })),
    } : undefined,
    baseline: opt("baseline") || undefined,
    failOn: opt("fail-on") || undefined,
    screenshots: args.includes("--screenshots") ? true : undefined,
    sarif: args.includes("--sarif") ? true : undefined,
    junit: args.includes("--junit") ? true : undefined,
    nvda: args.includes("--nvda") ? true : undefined,
    out: opt("out"),
  }];

  let crawlOpts = null;
  if (args.includes("--crawl")) {
    crawlOpts = { maxPages: opt("max-pages") ?? undefined, maxDepth: opt("max-depth") ?? undefined };
  }
  return { jobs, crawlOpts, configPath: null };
}
```

- [ ] **Step 4: Run the full unit suite to verify it passes**

Run: `npm run test:unit`
Expected: PASS — url-normalize + config suites, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/config.mjs test/unit/config.test.mjs
git commit -m "feat(config): port parseCli (argv -> jobs, pure, throws usageError)"
```

---

## Done criteria

- `npm run test:unit` is green.
- `src/crawl.mjs` exports `normalizeUrl` + `sameOrigin`; `discoverPages` still a throwing stub with its `TODO(port)`.
- `src/config.mjs` exports `usageError`, `slugify`, `slugFromUrl`, `normalizeAuth`, `parseConfigFile`, `parseCli`; all pure.
- No `process.exit`, browser, or file I/O in either module.
