// Unit tests for crawler URL normalization.
//
// These assert the contract documented in docs/crawl.md. They import from
// src/crawl.mjs, which is currently a stub — so the suite is written but skipped
// until normalizeUrl is ported. Remove `{ skip: ... }` once implemented.

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl } from "../../src/crawl.mjs";

// normalizeUrl is now ported; run the suite.

test("strips the hash fragment", () => {
  assert.equal(
    normalizeUrl("https://x.gov/a#section", "https://x.gov/"),
    "https://x.gov/a"
  );
});

test("trims a trailing slash but keeps root", () => {
  assert.equal(normalizeUrl("https://x.gov/a/", "https://x.gov/"), "https://x.gov/a");
  assert.equal(normalizeUrl("https://x.gov/", "https://x.gov/"), "https://x.gov/");
});

test("keeps the query string", () => {
  assert.equal(
    normalizeUrl("https://x.gov/a?b=1", "https://x.gov/"),
    "https://x.gov/a?b=1"
  );
});

test("returns null for non-followable links", () => {
  assert.equal(normalizeUrl("mailto:a@x.gov", "https://x.gov/"), null);
  assert.equal(normalizeUrl("tel:+1", "https://x.gov/"), null);
  assert.equal(normalizeUrl("/file.pdf", "https://x.gov/"), null);
});
