// Integration test: discoverPages BFS over the local crawl fixtures.
// Self-skips when no Edge/Chrome is available.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../helpers/browser.mjs";
import { discoverPages } from "../../src/crawl.mjs";

const A = new URL("../fixtures/crawl-a.html", import.meta.url).href;

// discoverPages launches its own browser; probe to decide whether to skip.
const probe = await launchBrowser();
if (probe) await probe.close();
const opts = probe ? {} : { skip: "no Edge/Chrome available" };

const basename = u => u.split("/").pop();

test("discoverPages: BFS finds all same-origin pages, skips mail/pdf", opts, async () => {
  const { pages, failed } = await discoverPages({ url: A }, { maxPages: 20, maxDepth: 3 });
  const names = pages.map(p => basename(p.url)).sort();
  assert.deepEqual(names, ["crawl-a.html", "crawl-b.html", "crawl-secret.html"]);
  assert.equal(failed.length, 0);
  // mailto: and the .pdf link were never queued (not in pages, not in failed).
});

test("discoverPages: maxDepth bounds the walk", opts, async () => {
  // depth 0 = A only, depth 1 adds B, depth 2 adds secret. Cap at depth 1.
  const { pages } = await discoverPages({ url: A }, { maxPages: 20, maxDepth: 1 });
  const names = pages.map(p => basename(p.url)).sort();
  assert.deepEqual(names, ["crawl-a.html", "crawl-b.html"]); // secret is depth 2, excluded
});

test("discoverPages: exclude filter prunes a branch", opts, async () => {
  const { pages } = await discoverPages({ url: A }, { maxPages: 20, maxDepth: 3, exclude: "secret" });
  const names = pages.map(p => basename(p.url)).sort();
  assert.deepEqual(names, ["crawl-a.html", "crawl-b.html"]); // secret excluded by regex
});

test("discoverPages: maxPages caps the total", opts, async () => {
  const { pages } = await discoverPages({ url: A }, { maxPages: 2, maxDepth: 3 });
  assert.equal(pages.length, 2);
});

after(() => {});
